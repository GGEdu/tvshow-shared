"""TMDB title matching utilities.

Cascade in 2 tiers used by the AgenticTVShow Reconciler and TelegramTVShow
ingest pipeline:

  1. rapidfuzz string-similarity (local, sub-ms, $0) — catches the trivial
     "Naruto Shippuden" ↔ TMDB "Naruto: Shippuuden" duplicates.
  2. LLM (Claude Haiku via LiteLLM gateway) — semantic matching for hard
     cases like "BNHA" → "My Hero Academia" or season-of-existing routing.
"""

from tvshow_common.matching.fuzzy import fuzzy_match_best
from tvshow_common.matching.series_matcher import MatchKind, MatchOutcome, SeriesMatcher
from tvshow_common.matching.title_cleaning import candidate_queries, clean_title
from tvshow_common.matching.tmdb_search import (
    TMDB_API_BASE,
    gather_tmdb_candidates,
    tmdb_auth,
)

__all__ = [
    "MatchKind",
    "MatchOutcome",
    "SeriesMatcher",
    "candidate_queries",
    "clean_title",
    "fuzzy_match_best",
    "gather_tmdb_candidates",
    "tmdb_auth",
    "TMDB_API_BASE",
]
