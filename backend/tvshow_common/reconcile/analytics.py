"""Reconcile-pending analytics aggregator (shared backend logic).

Both apps host a `reconcile_pending` table with identical shape:

    columns: id, series_id, kind, candidates JSONB, ai_proposal JSONB,
             status, created_at, resolved_at, resolved_by

The admin UI's `<AnalyticsTab/>` (F6-bis B.2) calls
`GET /admin/reconcile/analytics` on either app, expects the same JSON
shape (`ReconcileAnalyticsResponse`), and renders three panels:

  * donut chart by `ai_proposal->>'via'` (fuzzy / llm / none)
  * histogram of confidence buckets
  * top-N reasoning groups, clickable to filter the pendings table

Keeping the SQL here means both apps get the same buckets, the same
confidence ranges and the same "no-reason" fallback string, so future
UI tweaks need no per-app coordination.
"""

from __future__ import annotations

from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from tvshow_common.schemas.reconcile import (
    ReconcileAnalyticsResponse,
    ReconcileReasoningGroup,
)


# Confidence buckets are fixed at the same boundaries used by the
# matcher cascade (0.85 is the auto-apply threshold). The buckets cover
# the closed interval [0, 1].
_CONFIDENCE_BUCKETS = [
    ("0.00 (no candidates)", 0.0, 0.0),
    ("0.01-0.50", 0.01, 0.50),
    ("0.51-0.84", 0.51, 0.84),
    ("0.85-0.94", 0.85, 0.94),
    ("0.95-1.00", 0.95, 1.00),
]


_BY_VIA_SQL = sa_text(
    """
    SELECT COALESCE(ai_proposal->>'via', 'none') AS via, COUNT(*) AS n
      FROM reconcile_pending
     WHERE status = 'pending'
     GROUP BY via
     ORDER BY n DESC
    """
)


_TOP_REASONINGS_SQL = sa_text(
    """
    SELECT
        COALESCE(NULLIF(ai_proposal->>'reasoning', ''), '(no reasoning)') AS reasoning,
        COALESCE(ai_proposal->>'via', 'none') AS via,
        COUNT(*) AS n
      FROM reconcile_pending
     WHERE status = 'pending'
     GROUP BY reasoning, via
     ORDER BY n DESC
     LIMIT :limit
    """
)


_BY_CONFIDENCE_SQL = sa_text(
    """
    SELECT
        CASE
            WHEN (ai_proposal->>'confidence') IS NULL THEN '0.00 (no candidates)'
            WHEN (ai_proposal->>'confidence')::float = 0.0 THEN '0.00 (no candidates)'
            WHEN (ai_proposal->>'confidence')::float <= 0.50 THEN '0.01-0.50'
            WHEN (ai_proposal->>'confidence')::float <= 0.84 THEN '0.51-0.84'
            WHEN (ai_proposal->>'confidence')::float <= 0.94 THEN '0.85-0.94'
            ELSE '0.95-1.00'
        END AS bucket,
        COUNT(*) AS n
      FROM reconcile_pending
     WHERE status = 'pending'
     GROUP BY bucket
     ORDER BY bucket
    """
)


async def get_reconcile_analytics(
    db: AsyncSession, *, top_reasonings_limit: int = 10,
) -> ReconcileAnalyticsResponse:
    """Compute the analytics snapshot for the admin UI.

    Three SQL aggregations run sequentially (each takes a few ms on the
    current ~200-row pending table; cardinality stays bounded by admin
    review throughput, so no parallelisation needed).
    """
    via_rows = (await db.execute(_BY_VIA_SQL)).all()
    by_via = {row.via: int(row.n) for row in via_rows}

    conf_rows = (await db.execute(_BY_CONFIDENCE_SQL)).all()
    # Pre-seed all buckets at 0 so the UI gets a stable shape even when a
    # bucket has no rows.
    by_confidence: dict[str, int] = {b[0]: 0 for b in _CONFIDENCE_BUCKETS}
    for row in conf_rows:
        by_confidence[row.bucket] = int(row.n)

    top_rows = (
        await db.execute(
            _TOP_REASONINGS_SQL, {"limit": top_reasonings_limit}
        )
    ).all()
    top_reasonings = [
        ReconcileReasoningGroup(reasoning=r.reasoning, via=r.via, n=int(r.n))
        for r in top_rows
    ]

    total_pending = sum(by_via.values())

    return ReconcileAnalyticsResponse(
        total_pending=total_pending,
        by_via=by_via,
        by_confidence=by_confidence,
        top_reasonings=top_reasonings,
    )
