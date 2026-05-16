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


def _normalize_tv_result(r: dict) -> dict[str, Any]:
    """Normalise a /search/tv row to the stable candidate shape."""
    return {
        "tmdb_id": r.get("id"),
        "media_type": "tv",
        "title": r.get("name"),
        "original_name": r.get("original_name"),
        "first_air_date": r.get("first_air_date"),
        "overview": r.get("overview"),
        "popularity": r.get("popularity"),
        "vote_average": r.get("vote_average"),
        "origin_country": r.get("origin_country") or [],
        # F6-bis B.1: surface poster_path so the admin UI's
        # <TmdbSearchSelector/> can show thumbnails without another lookup.
        "poster_path": r.get("poster_path"),
    }


def _normalize_movie_result(r: dict) -> dict[str, Any]:
    """Normalise a /search/movie row to the same shape as TV results.

    Maps movie-only fields (title/release_date) onto the TV-equivalent
    keys (title/first_air_date) so downstream code (fuzzy + LLM) keeps
    working without per-media-type branching. Adds `media_type='movie'`
    so callers / consumers that DO care (poster sync, catalog refresh)
    can dispatch to the right TMDB endpoint.
    """
    return {
        "tmdb_id": r.get("id"),
        "media_type": "movie",
        "title": r.get("title"),
        # Movies don't have a separate original_name field — they use
        # `original_title`. Surface it under the TV key for the matcher.
        "original_name": r.get("original_title"),
        # Map release_date → first_air_date so existing prompts and
        # fuzzy logic don't need to learn a second date field.
        "first_air_date": r.get("release_date"),
        "overview": r.get("overview"),
        "popularity": r.get("popularity"),
        "vote_average": r.get("vote_average"),
        # /search/movie doesn't return origin_country; surface empty list
        # so the caller's shape assumptions hold.
        "origin_country": [],
        "poster_path": r.get("poster_path"),
    }


async def gather_tmdb_candidates(
    queries: list[str],
    *,
    api_key: str,
    language: str = "es-ES",
    top_per_query: int = 5,
    timeout_seconds: float = 15.0,
    include_movies: bool = False,
) -> list[dict[str, Any]]:
    """Call TMDB /search/tv (and optionally /search/movie) per query.

    With ``include_movies=False`` (default) only `/search/tv` is queried —
    behaviour identical to v0.10.x. With ``include_movies=True`` each
    query is sent to both endpoints and the results are merged.

    Output rows are normalised to a stable shape regardless of source
    (tv-vs-movie) so downstream code (fuzzy + LLM matcher) doesn't need
    to know the difference. The extra ``media_type`` field on each row
    lets callers that DO care (poster sync, /tv/{id} vs /movie/{id}
    catalog refresh) route correctly. Dedup key is ``(media_type,
    tmdb_id)`` so a movie and a tv show with the same numeric id are
    never collapsed.
    """
    if not queries:
        return []
    params, headers = tmdb_auth(api_key, language=language)

    # key = (media_type, tmdb_id) so movie/tv id collisions don't collapse.
    candidates_by_key: dict[tuple[str, int], dict[str, Any]] = {}
    endpoints: list[tuple[str, callable]] = [
        (f"{TMDB_API_BASE}/search/tv", _normalize_tv_result),
    ]
    if include_movies:
        endpoints.append((f"{TMDB_API_BASE}/search/movie", _normalize_movie_result))

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        for q in queries:
            for url, normalizer in endpoints:
                try:
                    resp = await client.get(
                        url,
                        params={**params, "query": q, "include_adult": False},
                        headers=headers,
                    )
                    if resp.status_code != 200:
                        continue
                    results = resp.json().get("results") or []
                except httpx.HTTPError:
                    continue
                for r in results[:top_per_query]:
                    normalized = normalizer(r)
                    tid = normalized.get("tmdb_id")
                    mtype = normalized.get("media_type")
                    if not tid or not mtype:
                        continue
                    key = (mtype, tid)
                    if key in candidates_by_key:
                        continue
                    candidates_by_key[key] = normalized
    return sorted(
        candidates_by_key.values(),
        key=lambda c: (-(c.get("popularity") or 0.0), c.get("title") or ""),
    )


async def fetch_tmdb_detail(
    tmdb_id: int,
    *,
    media_type: str = "tv",
    api_key: str,
    language: str = "es-ES",
    timeout_seconds: float = 15.0,
) -> dict[str, Any] | None:
    """Fetch a single TMDB entry's detail page (/tv/{id} or /movie/{id}).

    Returns the parsed JSON dict on 200, or ``None`` on any failure
    (404, network, parse). Used after the reconciler applies a decision
    so the caller can immediately populate `poster_path`, `overview`,
    `first_air_date` etc. on the series row.

    The endpoint is dispatched by ``media_type`` — passing the right
    value matters: hitting /tv/{12233} where 12233 is a movie id returns
    a stale or wrong entry. This is the v0.11.0 fix for movie-id rows
    that previously got matched against /search/tv only.
    """
    if not tmdb_id:
        return None
    if media_type not in ("tv", "movie"):
        media_type = "tv"
    params, headers = tmdb_auth(api_key, language=language)
    url = f"{TMDB_API_BASE}/{media_type}/{tmdb_id}"
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.get(url, params=params, headers=headers)
        if resp.status_code != 200:
            return None
        return resp.json()
    except httpx.HTTPError:
        return None
