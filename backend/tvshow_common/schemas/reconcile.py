"""Shared Pydantic schemas for the Reconciler / Manual-Match admin flows.

Both AgenticTVShow and TelegramTVShow expose `/admin/reconcile/*` endpoints
that move rows through the same `reconcile_pending` table. Sharing the
schemas avoids drift between the two apps.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


ReconcileKind = Literal[
    "same_series",
    "season_of_existing",
    "spinoff_or_special",
    "new_unique_series",
    "no_confident_match",
]


class ReconcileRunRequest(BaseModel):
    """Body for POST /admin/reconcile/run-full."""

    limit: int | None = Field(
        None,
        ge=1,
        le=2000,
        description="Cap number of series to reconcile in this run.",
    )
    dry_run: bool = Field(
        False,
        description=(
            "If true, classify with the LLM but DON'T apply changes or "
            "enqueue review items. Useful for cost estimation."
        ),
    )


class ReconcileOutcomeResponse(BaseModel):
    series_id: int
    kind: ReconcileKind
    target_tmdb_id: int | None = None
    target_season_number: int | None = None
    confidence: float = 0.0
    auto_applied: bool = False
    via: str = "none"  # 'fuzzy' | 'llm' | 'none'
    error: str | None = None


class ReconcileBatchResponse(BaseModel):
    started_at: datetime
    finished_at: datetime | None
    candidates: int
    applied_auto: int
    queued_for_review: int
    errored: int
    outcomes: list[ReconcileOutcomeResponse]
    duration_seconds: float | None


class ReconcileSingleResponse(BaseModel):
    """Returned by POST /admin/reconcile/series/{id}."""

    series_id: int
    kind: ReconcileKind
    target_tmdb_id: int | None
    target_season_number: int | None
    confidence: float
    reasoning: str
    auto_applied: bool
    via: str = "none"
    candidates: list[dict[str, Any]]
    error: str | None = None


class ReconcilePendingItem(BaseModel):
    """One row of GET /admin/reconcile/pending."""

    id: int
    series_id: int
    series_title: str | None
    series_url: str | None
    kind: str
    status: str
    candidates: list[dict[str, Any]]
    ai_proposal: dict[str, Any] | None
    created_at: datetime
    resolved_at: datetime | None = None


class ReconcileAcceptRequest(BaseModel):
    """Body for POST /admin/reconcile/pending/{id}/accept.

    Admin can override the LLM proposal. If empty, the AI proposal applies as-is.
    """

    target_tmdb_id: int | None = None
    target_season_number: int | None = None
    kind: ReconcileKind | None = None


class ReconcileDiscardRequest(BaseModel):
    """Body for POST /admin/reconcile/pending/{id}/discard."""

    reason: str | None = None


# ─── F6-bis B.1: shared schemas for analytics + TMDB search ─────────────


class ReconcileReasoningGroup(BaseModel):
    """One row of the `top_reasonings` aggregation."""

    reasoning: str
    via: str = "none"  # 'fuzzy' | 'llm' | 'none'
    n: int


class ReconcileAnalyticsResponse(BaseModel):
    """Response body of `GET /admin/reconcile/analytics`.

    Drives the admin UI's <AnalyticsTab/>:
      - donut by `via` (fuzzy / llm / none)
      - histogram by confidence bucket
      - top-N reasoning groups (clickable to filter pendings table)

    All three sections live under one endpoint so the UI fetches the
    snapshot in a single round-trip.
    """

    total_pending: int
    by_via: dict[str, int]
    by_confidence: dict[str, int]
    top_reasonings: list[ReconcileReasoningGroup]


class TmdbSearchResult(BaseModel):
    """One row from `GET /admin/tmdb-search?q=…`.

    Same shape as `gather_tmdb_candidates` normalised output (so the admin
    UI gets the exact rows the matcher would have fed the LLM). The UI's
    <TmdbSearchSelector/> renders a poster grid and lets the admin pick
    one to feed into `POST /admin/reconcile/pending/{id}/accept`.
    """

    tmdb_id: int
    title: str | None = None
    original_name: str | None = None
    first_air_date: str | None = None
    overview: str | None = None
    popularity: float | None = None
    vote_average: float | None = None
    origin_country: list[str] = []
    poster_path: str | None = None


class TmdbSearchResponse(BaseModel):
    query: str
    total: int
    results: list[TmdbSearchResult]
