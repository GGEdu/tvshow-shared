"""JWT + password hashing utilities.

Consumers must call `configure()` at startup with their settings object
(which must expose SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES).

Usage in consumer's main.py:

    from tvshow_common.core import security as common_security
    from app.core.config import settings

    common_security.configure(settings)
"""

import datetime
from datetime import timedelta
from typing import Protocol

import bcrypt
from jose import JWTError, jwt


class SecuritySettings(Protocol):
    """Protocol that the consumer's settings object must satisfy."""

    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int


_settings: SecuritySettings | None = None


def configure(settings: SecuritySettings) -> None:
    """Wire the consumer's settings into the security module. Call once at startup."""
    global _settings
    _settings = settings


def _get_settings() -> SecuritySettings:
    if _settings is None:
        raise RuntimeError(
            "tvshow_common.core.security is not configured. "
            "Call tvshow_common.core.security.configure(settings) at startup."
        )
    return _settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    s = _get_settings()
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.UTC) + (
        expires_delta or timedelta(minutes=s.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, s.SECRET_KEY, algorithm=s.ALGORITHM)


def decode_access_token(token: str) -> dict:
    s = _get_settings()
    try:
        return jwt.decode(token, s.SECRET_KEY, algorithms=[s.ALGORITHM])
    except JWTError:
        return {}
