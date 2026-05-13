"""Shared auth router factory.

Usage in consumer's main.py or app/api/v1/auth.py:

    from app.core.database import get_db
    from tvshow_common.api.auth import create_auth_router

    router = create_auth_router(get_db)
    app.include_router(router, prefix="/api/v1")
"""

from collections.abc import Callable

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from tvshow_common.schemas.auth import LoginRequest, Token
from tvshow_common.schemas.user import UserCreate
from tvshow_common.services.auth_service import AuthService


def create_auth_router(get_db: Callable) -> APIRouter:
    """Build the auth router with the consumer's DB session dependency.

    The `get_db` callable is the consumer's FastAPI dependency that yields
    an AsyncSession bound to the consumer's engine.
    """
    router = APIRouter(prefix="/auth", tags=["auth"])

    @router.post("/register", response_model=Token, status_code=201)
    async def register(
        data: UserCreate, db: AsyncSession = Depends(get_db)
    ) -> Token:
        return await AuthService(db).register(data)

    @router.post("/login", response_model=Token)
    async def login(
        data: LoginRequest, db: AsyncSession = Depends(get_db)
    ) -> Token:
        return await AuthService(db).login(data.email, data.password)

    return router
