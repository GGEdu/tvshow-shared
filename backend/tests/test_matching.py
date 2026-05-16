"""Unit tests for tvshow_common.matching.* — title cleaning, fuzzy, and
the SeriesMatcher cascade orchestration.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from tvshow_common.llm.client import LLMClient, LLMError
from tvshow_common.matching import series_matcher as sm
from tvshow_common.matching.fuzzy import fuzzy_match_best
from tvshow_common.matching.series_matcher import MatchOutcome, SeriesMatcher
from tvshow_common.matching.title_cleaning import (
    candidate_queries,
    clean_title,
    find_noise_tokens,
)


# ─── title_cleaning ───────────────────────────────────────────────────


def test_clean_title_strips_live_action_suffix() -> None:
    assert clean_title("Bleach Live Action").strip() == "Bleach"
    assert clean_title("Tokyo Ghoul Live Action 2").strip() == "Tokyo Ghoul 2"


def test_clean_title_keeps_clean_titles() -> None:
    assert clean_title("Naruto Shippuden") == "Naruto Shippuden"


def test_clean_title_strips_uppercase_noise_inline() -> None:
    # Pre-fix `str.replace` was case-sensitive and missed uppercase variants.
    assert clean_title("Himouto! Umaru-chan OVA 2") == "Himouto! Umaru-chan 2"


def test_find_noise_tokens_detects_live_action() -> None:
    assert "live action" in find_noise_tokens("Bleach Live Action")


def test_find_noise_tokens_empty_for_clean_title() -> None:
    assert find_noise_tokens("Naruto Shippuden") == frozenset()
    assert find_noise_tokens("") == frozenset()


def test_candidate_queries_emits_prefix_before_noise_token() -> None:
    """Inline noise leaves orphan subtitles; the prefix variant rescues TMDB."""
    series = {"title": "Death Note Live Action 2: The Last Name"}
    qs = candidate_queries(series)
    assert "Death Note" in qs
    # The full cleaned form is also kept (richest query first).
    assert qs[0] == "Death Note 2: The Last Name"


def test_candidate_queries_strips_trailing_year() -> None:
    series = {"title": "Spriggan (1998)"}
    qs = candidate_queries(series)
    assert "Spriggan" in qs


def test_candidate_queries_splits_subtitle() -> None:
    """For "Title: Subtitle" we also emit "Title"."""
    series = {"title": "Rockman.EXE Movie: Hikari to Yami no Program"}
    qs = candidate_queries(series)
    # After noise-strip + subtitle split we should see "Rockman.EXE"
    assert any(q.startswith("Rockman.EXE") and ":" not in q for q in qs)


def test_candidate_queries_keeps_clean_title_unchanged() -> None:
    """Happy path: a clean title produces a single query, no fallbacks."""
    series = {"title": "Naruto"}
    assert candidate_queries(series) == ["Naruto"]


def test_candidate_queries_dedupes_across_variants() -> None:
    """If two variants produce the same string we don't repeat it."""
    series = {"title": "Bleach Live Action", "titulo": "Bleach"}
    qs = candidate_queries(series)
    assert qs == ["Bleach"]


def test_candidate_queries_dedupes_case_insensitive() -> None:
    series = {"title": "Naruto", "titulo": "naruto", "original_name": "NARUTO"}
    queries = candidate_queries(series)
    assert len(queries) == 1


def test_candidate_queries_skips_empty_fields() -> None:
    series = {"title": "Bleach", "titulo": None, "original_name": ""}
    queries = candidate_queries(series)
    assert queries == ["Bleach"]


# ─── fuzzy ────────────────────────────────────────────────────────────


def test_fuzzy_match_best_returns_exact_match() -> None:
    series = {"titulo": "Naruto Shippuden", "title": None, "original_name": None}
    candidates = [
        {"tmdb_id": 31910, "title": "Naruto: Shippuuden", "original_name": "Naruto Shippuden"},
        {"tmdb_id": 1, "title": "Random Other Series", "original_name": "Otra"},
    ]
    best, score, field = fuzzy_match_best(series, candidates)
    assert best is not None
    assert best["tmdb_id"] == 31910
    assert score >= 95
    assert field in {"title", "original_name"}


def test_fuzzy_match_best_returns_low_score_on_unrelated() -> None:
    series = {"titulo": "Demon Slayer", "title": None, "original_name": None}
    candidates = [
        {"tmdb_id": 1, "title": "One Piece", "original_name": "One Piece"},
        {"tmdb_id": 2, "title": "Bleach", "original_name": "Bleach"},
    ]
    _best, score, _field = fuzzy_match_best(series, candidates)
    assert score < 70


def test_fuzzy_match_best_handles_empty_candidates() -> None:
    series = {"titulo": "Naruto"}
    best, score, field = fuzzy_match_best(series, [])
    assert best is None
    assert score == 0
    assert field == "none"


def test_fuzzy_match_best_handles_empty_series_titles() -> None:
    series = {"titulo": None, "title": None, "original_name": None}
    candidates = [{"tmdb_id": 1, "title": "Naruto", "original_name": None}]
    best, score, field = fuzzy_match_best(series, candidates)
    assert best is None
    assert score == 0


# ─── SeriesMatcher orchestration ──────────────────────────────────────


@pytest.fixture
def mock_llm() -> LLMClient:
    return LLMClient(
        provider="litellm",
        api_key="test",
        model="agent",
        base_url="http://example/4000",
    )


@pytest.fixture
def matcher(mock_llm: LLMClient) -> SeriesMatcher:
    return SeriesMatcher(
        llm_client=mock_llm,
        tmdb_api_key="dummy-tmdb-key",
        fuzzy_skip_llm_threshold=85,
    )


@pytest.fixture
def fake_series_row() -> dict:
    return {
        "title": "Boku no Hero Academia 7th Season",
        "titulo": "Boku no Hero Academia 7th Season",
        "original_name": "Boku no Hero Academia",
        "sinopsis": "Deku continues his hero training.",
        "url_serie": "https://animeflv.net/anime/bnha-7",
        "first_air_date": None,
        "n_eps": 0,
    }


@pytest.fixture
def fake_candidates() -> list[dict]:
    return [
        {
            "tmdb_id": 65930,
            "title": "My Hero Academia",
            "original_name": "Boku no Hero Academia",
            "first_air_date": "2016-04-03",
            "overview": "A boy without superpowers ...",
            "popularity": 200.0,
            "vote_average": 8.5,
            "origin_country": ["JP"],
        }
    ]


async def test_match_returns_no_candidates_when_titles_empty(
    matcher: SeriesMatcher,
) -> None:
    outcome = await matcher.match({"title": None, "titulo": None, "original_name": None})
    assert outcome.kind == "no_confident_match"
    assert outcome.via == "none"
    assert outcome.target_tmdb_id is None


async def test_match_returns_no_match_when_tmdb_empty(
    matcher: SeriesMatcher, fake_series_row: dict
) -> None:
    with patch.object(sm, "gather_tmdb_candidates", AsyncMock(return_value=[])):
        outcome = await matcher.match(fake_series_row)

    assert outcome.kind == "no_confident_match"
    assert outcome.candidates == []


async def test_match_short_circuits_llm_on_high_fuzzy(
    matcher: SeriesMatcher,
    fake_series_row: dict,
    fake_candidates: list[dict],
    mock_llm: LLMClient,
) -> None:
    """fuzzy score >= 85 → return same_series via=fuzzy, no LLM call."""
    with (
        patch.object(sm, "gather_tmdb_candidates", AsyncMock(return_value=fake_candidates)),
        patch.object(mock_llm, "complete_json", AsyncMock()) as llm_mock,
    ):
        outcome = await matcher.match(fake_series_row)

    assert outcome.kind == "same_series"
    assert outcome.target_tmdb_id == 65930
    assert outcome.via == "fuzzy"
    assert outcome.confidence >= 0.85
    llm_mock.assert_not_awaited()


async def test_noise_tokens_force_llm_tier(
    matcher: SeriesMatcher,
    mock_llm: LLMClient,
) -> None:
    """Source title with 'Live Action' must not auto-apply via fuzzy.

    Regression for the Bleach Live Action ↔ Bleach anime false-positive:
    token_set_ratio returns 100 because the candidate is a token subset, but
    the productions are different. The matcher should defer to the LLM.
    """
    live_action = {
        "title": "Bleach Live Action",
        "titulo": "Bleach Live Action",
        "original_name": None,
    }
    anime_candidates = [
        {
            "tmdb_id": 30984,
            "title": "Bleach",
            "original_name": "Bleach",
            "popularity": 50.0,
        }
    ]
    llm_response = {
        "kind": "spinoff_or_special",
        "target_tmdb_id": None,
        "target_season_number": None,
        "confidence": 0.92,
        "reasoning": "Live-action film, distinct from the anime.",
    }
    with (
        patch.object(
            sm, "gather_tmdb_candidates", AsyncMock(return_value=anime_candidates)
        ),
        patch.object(
            mock_llm, "complete_json", AsyncMock(return_value=llm_response)
        ) as llm_mock,
    ):
        outcome = await matcher.match(live_action)

    assert outcome.via == "llm"
    assert outcome.kind == "spinoff_or_special"
    llm_mock.assert_awaited_once()


async def test_noise_tokens_in_both_sides_still_uses_fuzzy(
    matcher: SeriesMatcher,
    mock_llm: LLMClient,
) -> None:
    """If both source and candidate carry the noise token, fuzzy is fine."""
    series = {
        "title": "Bleach Live Action",
        "titulo": "Bleach Live Action",
        "original_name": None,
    }
    matching_candidates = [
        {
            "tmdb_id": 999999,
            "title": "Bleach Live Action",
            "original_name": "Bleach",
            "popularity": 5.0,
        }
    ]
    with (
        patch.object(
            sm, "gather_tmdb_candidates", AsyncMock(return_value=matching_candidates)
        ),
        patch.object(mock_llm, "complete_json", AsyncMock()) as llm_mock,
    ):
        outcome = await matcher.match(series)

    assert outcome.via == "fuzzy"
    assert outcome.target_tmdb_id == 999999
    llm_mock.assert_not_awaited()


async def test_clean_titles_still_use_fuzzy(
    matcher: SeriesMatcher,
    mock_llm: LLMClient,
) -> None:
    """No noise tokens in source → happy path unchanged, fuzzy auto-applies."""
    series = {"title": "Naruto", "titulo": "Naruto", "original_name": None}
    candidates = [
        {"tmdb_id": 46260, "title": "Naruto", "original_name": "Naruto", "popularity": 200.0}
    ]
    with (
        patch.object(sm, "gather_tmdb_candidates", AsyncMock(return_value=candidates)),
        patch.object(mock_llm, "complete_json", AsyncMock()) as llm_mock,
    ):
        outcome = await matcher.match(series)

    assert outcome.via == "fuzzy"
    assert outcome.target_tmdb_id == 46260
    llm_mock.assert_not_awaited()


async def test_match_falls_through_to_llm_when_fuzzy_low(
    matcher: SeriesMatcher,
    fake_candidates: list[dict],
    mock_llm: LLMClient,
) -> None:
    """fuzzy < threshold → LLM is invoked."""
    obscure_series = {
        "title": "totally unrelated obscure animation",
        "titulo": "totally unrelated obscure animation",
        "original_name": None,
    }
    llm_response = {
        "kind": "same_series",
        "target_tmdb_id": 65930,
        "target_season_number": None,
        "confidence": 0.91,
        "reasoning": "LLM matched",
    }
    with (
        patch.object(sm, "gather_tmdb_candidates", AsyncMock(return_value=fake_candidates)),
        patch.object(mock_llm, "complete_json", AsyncMock(return_value=llm_response)) as llm_mock,
    ):
        outcome = await matcher.match(obscure_series)

    assert outcome.kind == "same_series"
    assert outcome.via == "llm"
    assert outcome.confidence == 0.91
    llm_mock.assert_awaited_once()


async def test_match_handles_llm_error_gracefully(
    matcher: SeriesMatcher,
    fake_candidates: list[dict],
    mock_llm: LLMClient,
) -> None:
    """LLM raises → MatchOutcome.error set, kind=no_confident_match."""
    obscure_series = {"title": "obscure title that won't fuzzy match"}
    with (
        patch.object(sm, "gather_tmdb_candidates", AsyncMock(return_value=fake_candidates)),
        patch.object(
            mock_llm, "complete_json", AsyncMock(side_effect=LLMError("boom"))
        ),
    ):
        outcome = await matcher.match(obscure_series)

    assert outcome.kind == "no_confident_match"
    assert outcome.error is not None
    assert "boom" in outcome.error
    assert outcome.via == "none"


async def test_match_handles_tmdb_failure_gracefully(
    matcher: SeriesMatcher, fake_series_row: dict
) -> None:
    """TMDB raises → error returned, no LLM call."""
    with patch.object(
        sm, "gather_tmdb_candidates", AsyncMock(side_effect=Exception("tmdb down"))
    ):
        outcome = await matcher.match(fake_series_row)

    assert outcome.kind == "no_confident_match"
    assert outcome.error is not None
    assert "tmdb down" in outcome.error


def test_should_auto_apply_threshold_logic() -> None:
    high = MatchOutcome(
        kind="same_series", target_tmdb_id=1, confidence=0.9, via="fuzzy"
    )
    low = MatchOutcome(
        kind="same_series", target_tmdb_id=1, confidence=0.5, via="llm"
    )
    no_match = MatchOutcome(
        kind="no_confident_match", target_tmdb_id=None, confidence=0.95, via="none"
    )

    assert high.should_auto_apply() is True
    assert low.should_auto_apply() is False
    assert no_match.should_auto_apply() is False


# ─── v0.11.0 — movies + media_type ────────────────────────────────────


def test_looks_like_movie_detects_pelicula_token() -> None:
    from tvshow_common.matching.title_cleaning import looks_like_movie

    assert looks_like_movie("Dragon Ball Z Pelicula 09") is True
    assert looks_like_movie("Akira (1988) Movie") is True
    assert looks_like_movie("Akira", "Akira: La Película") is True


def test_looks_like_movie_ignores_clean_titles() -> None:
    from tvshow_common.matching.title_cleaning import looks_like_movie

    assert looks_like_movie("Naruto") is False
    assert looks_like_movie("Bleach Live Action") is False  # not a movie token
    assert looks_like_movie(None, "", None) is False


def test_match_outcome_defaults_media_type_to_tv() -> None:
    """v0.10.x callers that don't set target_media_type still get 'tv'."""
    o = MatchOutcome(kind="same_series", target_tmdb_id=42)
    assert o.target_media_type == "tv"


@pytest.mark.asyncio
async def test_match_resolves_media_type_from_llm_decision(
    matcher: SeriesMatcher, fake_series_row: dict
) -> None:
    """LLM returns target_media_type='movie' → outcome reflects it."""
    candidates = [
        {
            "tmdb_id": 12233,
            "media_type": "movie",
            "title": "Dragon Ball Z: Bojack Unbound",
            "original_name": "ドラゴンボールZ 燃えつきろ!!熱戦・烈戦・超激戦",
            "first_air_date": "1993-07-10",
            "overview": "",
            "popularity": 10.0,
            "origin_country": [],
        }
    ]
    with patch.object(
        sm, "gather_tmdb_candidates", AsyncMock(return_value=candidates)
    ), patch.object(
        matcher.llm_client,
        "complete_json",
        AsyncMock(
            return_value={
                "kind": "same_series",
                "target_tmdb_id": 12233,
                "target_media_type": "movie",
                "target_season_number": None,
                "confidence": 0.95,
                "reasoning": "Direct DBZ movie 9 match",
            }
        ),
    ):
        outcome = await matcher.match(
            {"titulo": "Dragon Ball Z Pelicula 09"}, include_movies=True
        )

    assert outcome.kind == "same_series"
    assert outcome.target_tmdb_id == 12233
    assert outcome.target_media_type == "movie"


@pytest.mark.asyncio
async def test_match_falls_back_to_candidate_media_type_when_llm_omits_it(
    matcher: SeriesMatcher, fake_series_row: dict
) -> None:
    """LLM forgot to set target_media_type → matcher looks it up in candidates."""
    candidates = [
        {
            "tmdb_id": 999,
            "media_type": "movie",
            "title": "Some Movie",
            "first_air_date": "2010-01-01",
            "popularity": 5.0,
            "origin_country": [],
        }
    ]
    with patch.object(
        sm, "gather_tmdb_candidates", AsyncMock(return_value=candidates)
    ), patch.object(
        matcher.llm_client,
        "complete_json",
        AsyncMock(
            return_value={
                "kind": "same_series",
                "target_tmdb_id": 999,
                # target_media_type omitted on purpose
                "confidence": 0.9,
                "reasoning": "test",
            }
        ),
    ):
        outcome = await matcher.match(fake_series_row, include_movies=True)

    assert outcome.target_media_type == "movie"


@pytest.mark.asyncio
async def test_match_passes_include_movies_to_gather(
    matcher: SeriesMatcher, fake_series_row: dict
) -> None:
    """Per-call ``include_movies=True`` reaches gather_tmdb_candidates."""
    gather_mock = AsyncMock(return_value=[])
    with patch.object(sm, "gather_tmdb_candidates", gather_mock):
        await matcher.match(fake_series_row, include_movies=True)
    _args, kwargs = gather_mock.call_args
    assert kwargs["include_movies"] is True


def test_normalize_movie_result_maps_release_date_to_first_air_date() -> None:
    from tvshow_common.matching.tmdb_search import _normalize_movie_result

    raw = {
        "id": 12233,
        "title": "Dragon Ball Z: Bojack Unbound",
        "original_title": "ドラゴンボールZ",
        "release_date": "1993-07-10",
        "overview": "...",
        "popularity": 8.7,
        "vote_average": 7.5,
        "poster_path": "/foo.jpg",
    }
    out = _normalize_movie_result(raw)
    assert out["tmdb_id"] == 12233
    assert out["media_type"] == "movie"
    assert out["title"] == "Dragon Ball Z: Bojack Unbound"
    assert out["original_name"] == "ドラゴンボールZ"
    assert out["first_air_date"] == "1993-07-10"
    assert out["origin_country"] == []
    assert out["poster_path"] == "/foo.jpg"


def test_normalize_tv_result_carries_media_type_tv() -> None:
    from tvshow_common.matching.tmdb_search import _normalize_tv_result

    out = _normalize_tv_result(
        {
            "id": 31910,
            "name": "Naruto: Shippuuden",
            "first_air_date": "2007-02-15",
            "origin_country": ["JP"],
            "popularity": 100,
        }
    )
    assert out["media_type"] == "tv"
    assert out["tmdb_id"] == 31910
