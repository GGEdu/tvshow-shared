"""LLM prompt templates for series-title matching.

Kept separate from the matcher so apps can inject custom system messages
or user-template overrides without touching the orchestration code.
"""

from __future__ import annotations


DEFAULT_SYSTEM_PROMPT = (
    "You are a series-matching expert for an anime/TV tracking platform. "
    "Given a scraped series (with possibly noisy title) and a list of TMDB "
    "candidates, decide which TMDB entry it maps to and what kind of "
    "relationship it is. Reply with strict JSON only — no prose, no fences."
)


def build_classify_user_prompt(series: dict, candidates: list[dict]) -> str:
    """Render the user-side prompt with the inputs and the JSON schema.

    Candidates may be a mix of TV shows and movies (when the caller passed
    ``include_movies=True`` to ``gather_tmdb_candidates``). The
    ``media_type`` field on each candidate ("tv" | "movie") is surfaced
    here so the LLM can distinguish films from TV entries — necessary
    because a scraped row like "Dragon Ball Z Pelicula 09" maps to a
    /movie/{id} on TMDB, not a /tv/{id}.
    """
    cands_json = "[\n" + ",\n".join(
        f"  {{"
        f'"tmdb_id": {c["tmdb_id"]}, '
        f'"media_type": {repr(c.get("media_type") or "tv")}, '
        f'"title": {repr(c.get("title") or "")}, '
        f'"original_name": {repr(c.get("original_name") or "")}, '
        f'"first_air_date": {repr(c.get("first_air_date") or "")}, '
        f'"overview": {repr((c.get("overview") or "")[:300])}, '
        f'"origin_country": {c.get("origin_country") or []}, '
        f'"popularity": {c.get("popularity") or 0}'
        f"}}"
        for c in candidates[:10]
    ) + "\n]"
    return f"""SCRAPED SERIES:
- titulo: {series.get("titulo") or series.get("title") or ""}
- original_name: {series.get("original_name") or ""}
- url_serie: {series.get("url_serie") or ""}
- first_air_date_db: {series.get("first_air_date") or ""}
- episodes_in_db: {series.get("n_eps", 0)}
- sinopsis: {(series.get("sinopsis") or "")[:400]}

TMDB CANDIDATES (top 10, sorted by popularity):
{cands_json}

TASK:
Pick the best TMDB candidate (or none) and classify the relationship.
Candidates can be TV shows OR movies — read each candidate's
"media_type" field. A scraped row like "Dragon Ball Z Pelicula 09" or
"Akira (1988)" will map to a movie candidate, not a TV one.

  - "same_series": this IS the TMDB entry (just wasn't linked yet).
       Applies to BOTH tv and movie candidates. When the candidate is a
       movie, also set target_media_type="movie" so the caller can fetch
       /movie/{id} for poster + metadata.
  - "season_of_existing": this row is a season of another series already in
       the TMDB candidate (e.g. scraped as "BNHA 7th Season" but TMDB has it
       as season 7 of "Boku no Hero Academia"). MUST also set
       target_season_number. Only valid for media_type=tv candidates.
  - "spinoff_or_special": related but distinct TMDB entry (own tmdb_id);
       not a season of another series. Either media_type works.
  - "new_unique_series": TMDB has this exact series/film under its own id.
       Equivalent to "same_series" but used when no_confident_match was the
       initial hypothesis; rarely used — prefer same_series.
  - "no_confident_match": no candidate matches well (>= 70% certainty).

Respond ONLY with this JSON shape:
{{
  "kind": "<one of the strings above>",
  "target_tmdb_id": <int or null>,
  "target_media_type": "<tv or movie, or null>",
  "target_season_number": <int or null>,
  "confidence": <float between 0.0 and 1.0>,
  "reasoning": "<one short sentence>"
}}"""
