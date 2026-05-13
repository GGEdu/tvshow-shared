from datetime import date

from pydantic import BaseModel


class EpisodeCreate(BaseModel):
    season_id: int
    episode_number: int
    name: str | None = None
    overview: str | None = None
    still_path: str | None = None
    air_date: date | None = None
    runtime: int | None = None


class EpisodeRead(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    season_id: int
    episode_number: int
    name: str | None
    overview: str | None
    still_path: str | None
    air_date: date | None
    runtime: int | None
    languages: list[str] = []
