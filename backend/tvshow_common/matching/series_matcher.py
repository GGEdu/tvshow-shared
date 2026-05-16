"""SeriesMatcher — cascade-based TMDB matching for scraped series.

The orchestration:

  1. Generate candidate queries from `series.titulo` / `title` / `original_name`,
     cleaning live-action / movie / OVA noise.
  2. Hit TMDB `/search/tv` with each query, dedupe by tmdb_id (top 10 by
     popularity).
  3. Tier 1 — `rapidfuzz.fuzzy_match_best` against the candidate set.
     If best_score >= fuzzy_skip_llm_threshold, return as `kind=same_series`
     with `via='fuzzy'`. Free + sub-millisecond.
  4. Tier 2 — LLM classification (Anthropic / OpenRouter / LiteLLM). Used
     only when fuzzy isn't confident enough.

Consumer apps wrap this with their own `_apply_decision` (AgenticTV uses
MergeService for `season_of_existing`; TelegramTV writes EpisodeStream).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Literal

from tvshow_common.llm.client import LLMClient, LLMError
from tvshow_common.matching.fuzzy import fuzzy_match_best
from tvshow_common.matching.prompts import (
    DEFAULT_SYSTEM_PROMPT,
    build_classify_user_prompt,
)
from tvshow_common.matching.title_cleaning import (
    candidate_queries,
    find_noise_tokens,
)
from tvshow_common.matching.tmdb_search import gather_tmdb_candidates

logger = logging.getLogger(__name__)


MatchKind = Literal[
    "same_series",
    "season_of_existing",
    "spinoff_or_special",
    "new_unique_series",
    "no_confident_match",
]


@dataclass
class MatchOutcome:
    """Result returned by SeriesMatcher.match()."""

    kind: MatchKind
    target_tmdb_id: int | None = None
    target_season_number: int | None = None
    # v0.11.0 — media_type of the chosen TMDB target. 'tv' (default) for
    # backward compatibility; 'movie' when the matcher resolved to a
    # /movie/{id} entry. Persisted as series.tmdb_media_type so future
    # catalog syncs hit /tv/{id} vs /movie/{id} correctly.
    target_media_type: str = "tv"
    confidence: float = 0.0
    reasoning: str = ""
    candidates: list[dict[str, Any]] = field(default_factory=list)
    via: str = "none"  # 'fuzzy' | 'llm' | 'none'
    error: str | None = None

    def should_auto_apply(self, threshold: float = 0.85) -> bool:
        """True if this outcome is confident enough to apply automatically."""
        return (
            self.kind != "no_confident_match"
            and self.target_tmdb_id is not None
            and self.confidence >= threshold
        )


class SeriesMatcher:
    """Match a scraped series to a TMDB entry using the fuzzy → LLM cascade."""

    def __init__(
        self,
        *,
        llm_client: LLMClient,
        tmdb_api_key: str,
        fuzzy_skip_llm_threshold: int = 85,
        tmdb_language: str = "es-ES",
        llm_system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        llm_max_tokens: int = 512,
        llm_temperature: float = 0.0,
        include_movies: bool = False,
    ) -> None:
        self.llm_client = llm_client
        self.tmdb_api_key = tmdb_api_key
        self.fuzzy_skip_llm_threshold = fuzzy_skip_llm_threshold
        self.tmdb_language = tmdb_language
        self.llm_system_prompt = llm_system_prompt
        self.llm_max_tokens = llm_max_tokens
        self.llm_temperature = llm_temperature
        # v0.11.0 — when True, the matcher also hits /search/movie. Useful
        # for catalogs that mix anime films with TV series (e.g. "Dragon
        # Ball Z Pelicula 09"). Default False keeps v0.10.x behaviour.
        self.include_movies = include_movies

    async def match(
        self, series: dict, *, include_movies: bool | None = None
    ) -> MatchOutcome:
        """Run the full cascade. Returns a MatchOutcome (never raises).

        ``include_movies`` overrides the instance default for a single
        call — useful when the caller knows the row is a movie (e.g. the
        scraped title contains "pelicula", "movie", "film"…).
        """
        effective_include_movies = (
            include_movies if include_movies is not None else self.include_movies
        )
        # 1) Candidate queries
        queries = candidate_queries(series)
        if not queries:
            return MatchOutcome(
                kind="no_confident_match",
                reasoning="No usable title fields on series row.",
                via="none",
            )

        # 2) TMDB candidates
        try:
            candidates = await gather_tmdb_candidates(
                queries,
                api_key=self.tmdb_api_key,
                language=self.tmdb_language,
                include_movies=effective_include_movies,
            )
        except Exception as exc:  # noqa: BLE001 — degrade gracefully
            logger.warning("TMDB candidate gather failed: %s", exc)
            return MatchOutcome(
                kind="no_confident_match",
                reasoning=f"TMDB search failed: {exc}",
                via="none",
                error=f"tmdb_search_failed: {exc}",
            )

        if not candidates:
            return MatchOutcome(
                kind="no_confident_match",
                reasoning="TMDB returned no candidates for any query variant.",
                candidates=[],
                via="none",
            )

        # 3) Tier 1 — rapidfuzz
        best_fuzz, fuzz_score, fuzz_field = fuzzy_match_best(series, candidates)
        if (
            best_fuzz is not None
            and fuzz_score >= self.fuzzy_skip_llm_threshold
            and not _has_unmatched_noise_tokens(series, best_fuzz)
        ):
            return MatchOutcome(
                kind="same_series",
                target_tmdb_id=best_fuzz["tmdb_id"],
                target_season_number=None,
                # Surface the candidate's media_type so callers can pick
                # the right TMDB detail endpoint downstream (v0.11.0).
                target_media_type=best_fuzz.get("media_type") or "tv",
                confidence=fuzz_score / 100.0,
                reasoning=(
                    f"rapidfuzz score {fuzz_score} matched on "
                    f"{fuzz_field}='{best_fuzz.get(fuzz_field) or ''}'"
                ),
                candidates=candidates,
                via="fuzzy",
            )

        if (
            best_fuzz is not None
            and fuzz_score >= self.fuzzy_skip_llm_threshold
        ):
            # Fuzzy was confident but the source title carries noise tokens
            # (e.g. "Live Action", "Movie") that the candidate lacks — the
            # token_set_ratio metric ignores those extras, so this is a likely
            # false positive ("Bleach Live Action" vs "Bleach" anime).
            # Defer to the LLM tier instead of auto-applying.
            logger.info(
                "Fuzzy score %d for series '%s' suppressed — unmatched noise "
                "tokens vs candidate '%s'; deferring to LLM.",
                fuzz_score,
                series.get("titulo") or series.get("title"),
                best_fuzz.get("title"),
            )

        # 4) Tier 2 — LLM
        try:
            decision = await self.llm_client.complete_json(
                system=self.llm_system_prompt,
                user=build_classify_user_prompt(series, candidates),
                max_tokens=self.llm_max_tokens,
                temperature=self.llm_temperature,
            )
        except LLMError as exc:
            return MatchOutcome(
                kind="no_confident_match",
                candidates=candidates,
                error=f"llm_error: {exc}",
                via="none",
            )

        # Resolve target_media_type — prefer the LLM's explicit choice;
        # otherwise look it up in the candidate list by tmdb_id; fall back
        # to "tv" for compatibility with v0.10.x prompts.
        llm_media_type = decision.get("target_media_type")
        target_tmdb_id = decision.get("target_tmdb_id")
        if not llm_media_type and target_tmdb_id is not None:
            for c in candidates:
                if c.get("tmdb_id") == target_tmdb_id:
                    llm_media_type = c.get("media_type")
                    break
        target_media_type = llm_media_type if llm_media_type in ("tv", "movie") else "tv"

        return MatchOutcome(
            kind=decision.get("kind", "no_confident_match"),
            target_tmdb_id=target_tmdb_id,
            target_season_number=decision.get("target_season_number"),
            target_media_type=target_media_type,
            confidence=float(decision.get("confidence", 0.0)),
            reasoning=str(decision.get("reasoning", "")),
            candidates=candidates,
            via="llm",
        )


def _has_unmatched_noise_tokens(
    series: dict, candidate: dict[str, Any]
) -> bool:
    """True if `series` titles contain noise tokens absent from `candidate`.

    rapidfuzz's `token_set_ratio` happily returns 100 when the candidate is a
    strict subset of the source ("Bleach" ⊂ "Bleach Live Action"). When the
    extra tokens are domain-significant ("Live Action", "Movie", "OVA"), that
    100 is misleading — the two refer to different productions. Detect this
    case so the caller can fall through to the LLM tier.
    """
    series_tokens: set[str] = set()
    for fld in ("titulo", "title", "original_name"):
        value = series.get(fld)
        if value:
            series_tokens |= find_noise_tokens(value)
    if not series_tokens:
        return False

    candidate_tokens: set[str] = set()
    for fld in ("title", "original_name"):
        value = candidate.get(fld)
        if value:
            candidate_tokens |= find_noise_tokens(value)
    return bool(series_tokens - candidate_tokens)
