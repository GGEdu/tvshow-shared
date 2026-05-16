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
from tvshow_common.matching.title_cleaning import candidate_queries, clean_title


# ─── title_cleaning ───────────────────────────────────────────────────


def test_clean_title_strips_live_action_suffix() -> None:
    assert clean_title("Bleach Live Action").strip() == "Bleach"
    assert clean_title("Tokyo Ghoul Live Action 2").strip() == "Tokyo Ghoul 2"


def test_clean_title_keeps_clean_titles() -> None:
    assert clean_title("Naruto Shippuden") == "Naruto Shippuden"


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
