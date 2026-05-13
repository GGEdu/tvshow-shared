"""Declarative Base shared across consumers.

Consumers (AgenticTVShow, TelegramTVShow) keep their own engine/session
configuration but inherit from this single Base so all models share the
same SQLAlchemy metadata registry.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. All ORM models inherit from this."""
