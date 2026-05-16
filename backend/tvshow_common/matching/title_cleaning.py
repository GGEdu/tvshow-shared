"""Title cleaning and candidate-query generation.

Strips noise tokens ("Live Action", "Movie", "OVA", …) from series titles
so the TMDB search API gets a clean query, and dedupes near-identical
queries so we don't fan out unnecessarily.
"""

from __future__ import annotations

import re


_YEAR_SUFFIX_RE = re.compile(r"\s*\(\d{4}\)\s*$")
_SUBTITLE_SEPARATORS: tuple[str, ...] = (":", " - ", " – ", " — ")


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
            # Case-insensitive inline strip: "Himouto! Umaru-chan OVA 2" must
            # also lose "OVA" (str.replace is case-sensitive and used to miss
            # uppercase variants).
            pattern = re.compile(re.escape(token), re.IGNORECASE)
            s = pattern.sub(" ", s)
            s = " ".join(s.split()).rstrip(" -:")
            low = s.lower()
    return s


def _truncate_before_noise_token(t: str) -> str | None:
    """Return the prefix of `t` before the first noise token, or None.

    For "Death Note Live Action 2: The Last Name" → "Death Note". Useful
    because `clean_title` strips noise inline but leaves orphan subtitles
    ("2: The Last Name") that TMDB can't match.
    """
    if not t:
        return None
    low = t.lower()
    earliest = -1
    for token in _NOISE_TOKENS:
        idx = low.find(token)
        if idx > 0 and (earliest == -1 or idx < earliest):
            earliest = idx
    if earliest <= 0:
        return None
    head = t[:earliest].rstrip(" -:–—")
    return head or None


def _strip_year_suffix(t: str) -> str | None:
    """For "Spriggan (1998)" → "Spriggan". Returns None if nothing to strip."""
    stripped = _YEAR_SUFFIX_RE.sub("", t).strip()
    return stripped if stripped and stripped != t.strip() else None


def _split_before_subtitle(t: str) -> str | None:
    """For "Title: Subtitle" → "Title". Returns None if no separator found."""
    for sep in _SUBTITLE_SEPARATORS:
        if sep in t:
            head = t.split(sep, 1)[0].strip()
            if head and head != t.strip():
                return head
    return None


def _query_variants(raw: str) -> list[str]:
    """Generate ordered query variants for one raw title field.

    Order matters: the SeriesMatcher walks queries left-to-right and stops
    accumulating once TMDB has produced enough candidates. We put the
    "richest" (full-cleaned) form first and progressively shorter / more
    permissive forms after, so a precise match wins when available but a
    truncated fallback still rescues over-specified titles.
    """
    out: list[str] = []
    seen: set[str] = set()

    def _add(s: str | None) -> None:
        if not s:
            return
        key = s.lower()
        if key in seen:
            return
        out.append(s)
        seen.add(key)

    cleaned = clean_title(raw)
    _add(cleaned)
    _add(_truncate_before_noise_token(raw))
    if cleaned:
        _add(_strip_year_suffix(cleaned))
        _add(_split_before_subtitle(cleaned))
    return out


def candidate_queries(series: dict) -> list[str]:
    """Generate de-duped, ranked query strings for TMDB /search/tv.

    Accepts a dict with optional keys: title, titulo, original_name. For
    each, emits the cleaned form plus permissive fallbacks (prefix before
    noise tokens, trailing year stripped, subtitle removed) so TMDB still
    finds the main entry when the raw title is over-specified.
    """
    raw_fields = [
        series.get("title"),
        series.get("titulo"),
        series.get("original_name"),
    ]
    queries: list[str] = []
    seen: set[str] = set()
    for q in raw_fields:
        if not q:
            continue
        for variant in _query_variants(q):
            key = variant.lower()
            if key in seen:
                continue
            queries.append(variant)
            seen.add(key)
    return queries
