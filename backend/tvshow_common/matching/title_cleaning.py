"""Title cleaning and candidate-query generation.

Strips noise tokens ("Live Action", "Movie", "OVA", …) from series titles
so the TMDB search API gets a clean query, and dedupes near-identical
queries so we don't fan out unnecessarily.
"""

from __future__ import annotations


# Common suffixes that contaminate scraped titles from animeonline/animeflv.
# Each entry is matched case-insensitively as a whole-word tail or inline.
_NOISE_TOKENS: frozenset[str] = frozenset(
    {
        "live action",
        "live-action",
        "movie",
        "the movie",
        "ova",
        "sin censura",
        "uncensored",
    }
)


def find_noise_tokens(t: str) -> frozenset[str]:
    """Return the noise tokens (live action, movie, OVA, …) present in `t`.

    Case-insensitive substring match. Empty result means the title is "clean"
    from the SeriesMatcher's perspective.
    """
    if not t:
        return frozenset()
    low = t.lower()
    return frozenset(token for token in _NOISE_TOKENS if token in low)


def clean_title(t: str) -> str:
    """Strip live-action / movie / OVA noise from a title for searching."""
    s = t.strip()
    low = s.lower()
    for token in _NOISE_TOKENS:
        if low.endswith(" " + token):
            s = s[: -(len(token) + 1)].rstrip(" -:")
            low = s.lower()
        elif token in low:
            s = s.replace(token, " ").replace(token.title(), " ")
            s = " ".join(s.split())
            low = s.lower()
    return s


def candidate_queries(series: dict) -> list[str]:
    """Generate de-duped, ranked query strings for TMDB /search/tv.

    Accepts a dict with optional keys: title, titulo, original_name.
    Cleans each, drops empties, returns case-insensitive uniques.
    """
    raw = [
        series.get("title"),
        series.get("titulo"),
        series.get("original_name"),
    ]
    queries: list[str] = []
    seen: set[str] = set()
    for q in raw:
        if not q:
            continue
        cleaned = clean_title(q)
        if not cleaned or cleaned.lower() in seen:
            continue
        queries.append(cleaned)
        seen.add(cleaned.lower())
    return queries
