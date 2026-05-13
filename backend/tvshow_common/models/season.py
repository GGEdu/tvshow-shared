from datetime import date

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tvshow_common.core.base import Base


class Season(Base):
    __tablename__ = "seasons"
    __table_args__ = (UniqueConstraint("series_id", "season_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    series_id: Mapped[int] = mapped_column(ForeignKey("series.id"), index=True, nullable=False)
    season_number: Mapped[int] = mapped_column(nullable=False)
    name: Mapped[str | None]
    overview: Mapped[str | None]
    poster_path: Mapped[str | None]
    episode_count: Mapped[int] = mapped_column(default=0)
    air_date: Mapped[date | None]

    series: Mapped["Series"] = relationship(back_populates="seasons")  # noqa: F821
    episodes: Mapped[list["Episode"]] = relationship(  # noqa: F821
        back_populates="season", cascade="all, delete-orphan", order_by="Episode.episode_number"
    )
