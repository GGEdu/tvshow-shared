from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from tvshow_common.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from tvshow_common.models.user import User
from tvshow_common.repositories.user_repository import UserRepository
from tvshow_common.schemas.auth import Token
from tvshow_common.schemas.user import UserCreate


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = UserRepository(db)

    async def register(self, data: UserCreate) -> Token:
        if await self.repo.get_by_email(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        if await self.repo.get_by_username(data.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )

        user = User(
            email=data.email,
            username=data.username,
            hashed_password=get_password_hash(data.password),
        )
        user = await self.repo.create(user)
        access_token = create_access_token({"sub": str(user.id)})
        return Token(access_token=access_token)

    async def login(self, email: str, password: str) -> Token:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        access_token = create_access_token({"sub": str(user.id)})
        return Token(access_token=access_token)
