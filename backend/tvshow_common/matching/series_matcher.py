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
from tvshow_common.matching.title_cleaning import candidate_queries
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
    ) -> None:
        self.llm_client = llm_client
        self.tmdb_api_key = tmdb_api_key
        self.fuzzy_skip_llm_threshold = fuzzy_skip_llm_threshold
        self.tmdb_language = tmdb_language
        self.llm_system_prompt = llm_system_prompt
        self.llm_max_tokens = llm_max_tokens
        self.llm_temperature = llm_temperature

    async def match(self, series: dict) -> MatchOutcome:
        """Run the full cascade. Returns a MatchOutcome (never raises)."""
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
        ):
            return MatchOutcome(
                kind="same_series",
                target_tmdb_id=best_fuzz["tmdb_id"],
                target_season_number=None,
                confidence=fuzz_score / 100.0,
                reasoning=(
                    f"rapidfuzz score {fuzz_score} matched on "
                    f"{fuzz_field}='{best_fuzz.get(fuzz_field) or ''}'"
                ),
                candidates=candidates,
                via="fuzzy",
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

        return MatchOutcome(
            kind=decision.get("kind", "no_confident_match"),
            target_tmdb_id=decision.get("target_tmdb_id"),
            target_season_number=decision.get("target_season_number"),
            confidence=float(decision.get("confidence", 0.0)),
            reasoning=str(decision.get("reasoning", "")),
            candidates=candidates,
            via="llm",
        )
