from datetime import datetime
from enum import StrEnum

from sqlalchemy import Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tvshow_common.core.base import Base


class ListType(StrEnum):
    WATCHING = "watching"
    WATCHLIST = "watchlist"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class UserList(Base):
    __tablename__ = "user_lists"
    __table_args__ = (UniqueConstraint("user_id", "series_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    series_id: Mapped[int] = mapped_column(ForeignKey("series.id"), index=True, nullable=False)
    list_type: Mapped[ListType] = mapped_column(
        Enum(ListType, create_constraint=False, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="lists")  # noqa: F821
    series: Mapped["Series"] = relationship(back_populates="user_lists")  # noqa: F821
