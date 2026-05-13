from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tvshow_common.core.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, session: AsyncSession, model_class: type[ModelT]) -> None:
        self.session = session
        self.model_class = model_class

    async def get_by_id(self, obj_id: int) -> ModelT | None:
        return await self.session.get(self.model_class, obj_id)

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[ModelT]:
        result = await self.session.execute(
            select(self.model_class).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    # Fields that must never be overwritten via update().
    _PROTECTED_FIELDS: frozenset[str] = frozenset({"id", "created_at"})

    async def update(self, obj: ModelT, data: dict[str, Any]) -> ModelT:
        for key, value in data.items():
            if key in self._PROTECTED_FIELDS:
                raise ValueError(f"Field '{key}' is immutable and cannot be updated")
            if not hasattr(obj, key):
                raise ValueError(f"Unknown field '{key}' on {type(obj).__name__}")
            setattr(obj, key, value)
        await self.session.flush()
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.flush()
