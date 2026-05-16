"""DDL snippets shared across AgenticTVShow + TelegramTVShow migrations.

Each app embeds these strings inside its own Alembic migration so the
table layout stays in sync. We expose them as constants (not Alembic ops)
because each project owns its migration history and revision graph.
"""

# Drop-in SQL for `CREATE TABLE reconcile_pending` — used by Reconciler
# and Manual Match UI in both apps.
RECONCILE_PENDING_DDL = """
CREATE TABLE IF NOT EXISTS reconcile_pending (
    id              SERIAL PRIMARY KEY,
    series_id       INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL DEFAULT 'series',
    candidates      JSONB NOT NULL,
    ai_proposal     JSONB,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT,
    CONSTRAINT uq_reconcile_pending_series_kind UNIQUE (series_id, kind),
    CONSTRAINT reconcile_pending_kind_check
        CHECK (kind IN ('series','url_discovery','url_dead')),
    CONSTRAINT reconcile_pending_status_check
        CHECK (status IN ('pending','accepted','rejected','discarded'))
);
CREATE INDEX IF NOT EXISTS idx_reconcile_pending_status
    ON reconcile_pending (status, created_at);
"""

# Series-row columns set when the Reconciler resolves a duplicate.
RECONCILE_SERIES_COLUMNS_DDL = """
ALTER TABLE series ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE series ADD COLUMN IF NOT EXISTS reconcile_method TEXT;
ALTER TABLE series ADD COLUMN IF NOT EXISTS ai_matched_at TIMESTAMPTZ;
"""

__all__ = ["RECONCILE_PENDING_DDL", "RECONCILE_SERIES_COLUMNS_DDL"]
