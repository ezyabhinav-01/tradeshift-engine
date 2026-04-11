from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime

from .runtime_guards import TTLCache


@dataclass
class SessionIdentity:
    user_id: int
    email: str
    expires_at: datetime


SESSION_CACHE_TTL_SECONDS = max(int(os.getenv("SESSION_CACHE_TTL_SECONDS", "900")), 30)
_session_cache = TTLCache(ttl_seconds=SESSION_CACHE_TTL_SECONDS, max_entries=20000)


def cache_session_identity(session_token: str, user_id: int, email: str, expires_at: datetime) -> None:
    ttl_seconds = max((expires_at - datetime.utcnow()).total_seconds(), 1.0)
    _session_cache.set(
        session_token,
        SessionIdentity(user_id=user_id, email=email, expires_at=expires_at),
        ttl_seconds=ttl_seconds,
    )


def get_cached_session_identity(session_token: str | None) -> SessionIdentity | None:
    if not session_token:
        return None
    identity = _session_cache.get(session_token)
    if identity is None:
        return None
    if identity.expires_at <= datetime.utcnow():
        invalidate_session_identity(session_token)
        return None
    return identity


def invalidate_session_identity(session_token: str | None) -> None:
    if session_token:
        _session_cache.pop(session_token)


def clear_session_identity_cache() -> None:
    _session_cache.clear()
