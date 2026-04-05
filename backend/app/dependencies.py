from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .database import get_db
from .models import User, UserSession
from .config import SECRET_KEY, ALGORITHM
import jwt
from datetime import datetime, timedelta

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    session_token = request.cookies.get("session_id")
    
    if session_token:
        # 1. Try Session-based auth
        result = await db.execute(
            select(UserSession)
            .filter(UserSession.session_token == session_token)
            .filter(UserSession.expires_at > datetime.utcnow())
        )
        session = result.scalars().first()
        
        if session:
            result = await db.execute(select(User).filter(User.id == session.user_id))
            user = result.scalars().first()
            if user:
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
