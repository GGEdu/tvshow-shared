from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tvshow_common.core.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)
    is_admin: Mapped[bool] = mapped_column(
        nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    lists: Mapped[list["UserList"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
    watched_episodes: Mapped[list["WatchedEpisode"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
