"""Reconciler-side shared services (analytics, helpers).

Most of the reconciler logic lives in `tvshow_common.matching` (LLM +
fuzzy cascade) and in each app's `app/services/reconciler_service.py`
(domain-specific persistence). This sub-package collects the small
helpers that are pure SQL and benefit from living in one place so both
AgenticTVShow and TelegramTVShow share them verbatim.
"""

from .analytics import get_reconcile_analytics

__all__ = ["get_reconcile_analytics"]
