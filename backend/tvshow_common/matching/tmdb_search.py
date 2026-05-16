"""TMDB /search/tv wrapper used by the matcher cascade.

Centralises the v3-vs-Bearer auth quirk (TMDB v4 read-token is Bearer;
v3 key is a query param) and the basic result ranking. Both AgenticTVShow
and TelegramTVShow had near-identical copies of this logic.
"""

from __future__ import annotations

from typing import Any

import httpx


TMDB_API_BASE = "https://api.themoviedb.org/3"

# TMDB genre id for "Animation" — applied as a soft preference when caller
# sets prefer_animation=True (anime catalog).
TMDB_ANIMATION_GENRE_ID = 16


def tmdb_auth(api_key: str, language: str = "es-ES") -> tuple[dict, dict]:
    """Build (params, headers) for TMDB requests.

    TMDB has two auth flavours: a v3 API key (short, query param) and a v4
    read access token (long JWT, Bearer header). We detect by length.
    """
    if not api_key:
        raise ValueError("TMDB api_key is required")
    if len(api_key) <= 64:
        return {"api_key": api_key, "language": language}, {}
    return {"language": language}, {"Authorization": f"Bearer {api_key}"}


def _rank_search_results(
    results: list[dict],
    origin_country: str | None = None,
    prefer_animation: bool = False,
    limit: int = 10,
) -> list[dict]:
    """Filter + rank raw TMDB /search/tv results. Pure function (testable)."""
    if origin_country:
        normalized = origin_country.upper()
        results = [
            r for r in results
            if normalized in (r.get("origin_country") or [])
        ]
    if prefer_animation:
        animated = [
            r for r in results
            if TMDB_ANIMATION_GENRE_ID in (r.get("genre_ids") or [])
        ]
        if animated:
            results = animated

    return sorted(
        results,
        key=lambda r: -(r.get("popularity") or 0.0),
    )[:limit]


async def gather_tmdb_candidates(
    queries: list[str],
    *,
    api_key: str,
    language: str = "es-ES",
    top_per_query: int = 5,
    timeout_seconds: float = 15.0,
) -> list[dict[str, Any]]:
    """Call TMDB /search/tv for each query, dedupe by tmdb_id, return top hits.

    Output rows are normalised to a stable shape so downstream code (fuzzy
    + LLM matcher) doesn't depend on TMDB's exact field names.
    """
    if not queries:
        return []
    params, headers = tmdb_auth(api_key, language=language)

    candidates_by_id: dict[int, dict[str, Any]] = {}
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for q in queries:
            try:
                resp = await client.get(
                    f"{TMDB_API_BASE}/search/tv",
                    params={**params, "query": q, "include_adult": False},
                    headers=headers,
                )
                if resp.status_code != 200:
                    continue
                results = resp.json().get("results") or []
            except httpx.HTTPError:
                continue
            for r in results[:top_per_query]:
                tid = r.get("id")
                if not tid or tid in candidates_by_id:
                    continue
                candidates_by_id[tid] = {
                    "tmdb_id": tid,
                    "title": r.get("name"),
                    "original_name": r.get("original_name"),
                    "first_air_date": r.get("first_air_date"),
                    "overview": r.get("overview"),
                    "popularity": r.get("popularity"),
                    "vote_average": r.get("vote_average"),
                    "origin_country": r.get("origin_country") or [],
                    # F6-bis B.1: surface poster_path so the admin UI's
                    # <TmdbSearchSelector/> can show thumbnails without
                    # another TMDB lookup.
                    "poster_path": r.get("poster_path"),
                }
    return sorted(
        candidates_by_id.values(),
        key=lambda c: (-(c.get("popularity") or 0.0), c.get("title") or ""),
    )
