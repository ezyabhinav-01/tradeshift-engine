from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .database import get_db
from .models import User, UserSession
from .config import SECRET_KEY, ALGORITHM
from .session_store import get_cached_session_identity, cache_session_identity
import jwt
from datetime import datetime
import hmac
import os

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    session_token = request.cookies.get("session_id")
    
    if session_token:
        cached_identity = get_cached_session_identity(session_token)
        if cached_identity:
            result = await db.execute(select(User).filter(User.id == cached_identity.user_id))
            user = result.scalars().first()
            if user:
                return user
            # Stale cache entry if the user row is gone.

        result = await db.execute(
            select(User, UserSession)
            .join(UserSession, UserSession.user_id == User.id)
            .filter(UserSession.session_token == session_token)
            .filter(UserSession.expires_at > datetime.utcnow())
            .limit(1)
        )
        row = result.first()
        if row:
            user, session = row
            cache_session_identity(session.session_token, user.id, user.email, session.expires_at)
            return user
    
    # 2. Fallback: JWT Access Token (for backward compatibility / internal tools)
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
            
        result = await db.execute(select(User).filter(User.email == email))
        user = result.scalars().first()
        if user:
            return user
    except jwt.PyJWTError:
         pass
    
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")


def has_internal_admin_key(request: Request) -> bool:
    """
    Allow trusted internal services like the admin backend to hit protected
    engine endpoints without requiring a browser session.
    """
    expected = os.getenv("ADMIN_SERVICE_KEY", "tradeshift-local-admin")
    provided = request.headers.get("X-Admin-Service-Key", "")
    return bool(provided) and hmac.compare_digest(provided, expected)


async def admin_required(current_user: User = Depends(get_current_user)):
    """
    Dependency to restrict access to specialized admin-only functions.
    Hardcoded to 'admin@gmail.com' for the current MVP.
    """
    if current_user.email != "admin@gmail.com":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Forbidden: Admin access required."
        )
    return current_user


async def admin_or_internal(request: Request, db: AsyncSession = Depends(get_db)):
    if has_internal_admin_key(request):
        return None

    current_user = await get_current_user(request, db)
    return await admin_required(current_user)
