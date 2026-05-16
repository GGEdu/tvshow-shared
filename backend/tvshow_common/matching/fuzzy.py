"""Rapidfuzz tier — local string similarity scoring.

Used as the first cascade step before invoking the LLM. ~80% of catalog
duplicates resolve here trivially ("Naruto Shippuden" ↔ "Naruto: Shippuuden"
score ~95+).
"""

from __future__ import annotations

from typing import Any

from rapidfuzz import fuzz, utils as fuzz_utils


def fuzzy_match_best(
    series: dict, candidates: list[dict[str, Any]]
) -> tuple[dict[str, Any] | None, int, str]:
    """Score every candidate against the scraped series titles.

    Compares each (series.titulo | title | original_name) against each
    (candidate.title | original_name) using the max of token_set_ratio,
    token_sort_ratio, and partial_ratio. The rapidfuzz `default_process`
    helper lowercases, removes punctuation and strips whitespace before
    scoring.

    Returns (best_candidate, score 0-100, candidate_field).
    `candidate_field` is 'title' or 'original_name' (or 'none' on empty
    inputs), used for the reasoning message.
    """
    if not candidates:
        return None, 0, "none"

    series_titles = [
        t
        for t in (
            series.get("titulo"),
            series.get("title"),
            series.get("original_name"),
        )
        if t
    ]
    if not series_titles:
        return None, 0, "none"

    processed_series = [fuzz_utils.default_process(t) for t in series_titles]

    best: dict[str, Any] | None = None
    best_score = 0
    best_field = "title"
    for c in candidates:
        for field in ("title", "original_name"):
            cand_value = c.get(field)
            if not cand_value:
                continue
            processed_cand = fuzz_utils.default_process(cand_value)
            for ps in processed_series:
                score = max(
                    fuzz.token_set_ratio(ps, processed_cand),
                    fuzz.token_sort_ratio(ps, processed_cand),
                    fuzz.partial_ratio(ps, processed_cand),
                )
                if score > best_score:
                    best_score = int(score)
                    best = c
                    best_field = field
    return best, best_score, best_field
