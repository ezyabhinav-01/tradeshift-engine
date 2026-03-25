from fastapi import APIRouter, Depends, HTTPException, status, Response, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import User
from .database import get_db
from .schemas import UserCreate, UserLogin, Token, User as UserSchema
import bcrypt
from datetime import datetime, timedelta
import jwt
import os
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["auth"])

# --- AUTH LOGIC ---

def verify_password(plain_password, hashed_password):
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

def get_password_hash(password):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

from typing import Optional

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/register", response_model=UserSchema)
async def register(
    user: UserCreate, 
    response: Response, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # 1. Check if user exists
    result = await db.execute(select(User).filter(User.email == user.email))
    db_user = result.scalars().first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 2. Create User
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email, 
        hashed_password=hashed_password, 
        full_name=user.full_name,
        dob=user.dob,
        experience_level=user.experience_level,
        investment_goals=user.investment_goals,
        preferred_instruments=user.preferred_instruments,
        risk_tolerance=user.risk_tolerance,
        occupation=user.occupation,
        city=user.city,
        security_pin=user.security_pin
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 3. Auto-Login (Set Cookie)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email}, expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    # 4. Trigger Inngest Workflow
    import inngest
    from app.inngest.client import inngest_client
    
    try:
        await inngest_client.send(
            inngest.Event(
                name="app/user.created",
                data={
                    "email": new_user.email,
                    "firstName": new_user.full_name.split()[0] if new_user.full_name else "Trader",
                    "fullname": new_user.full_name,
                    "dob": new_user.dob,
                    "experience_level": new_user.experience_level,
                    "investment_goals": new_user.investment_goals,
                    "preferred_instruments": new_user.preferred_instruments,
                    "risk_tolerance": new_user.risk_tolerance,
                    "occupation": new_user.occupation,
                    "city": new_user.city
                }
            )
        )
        print(f"✅ Inngest event sent for {new_user.email}")
    except Exception as e:
        print(f"❌ Failed to send Inngest event: {e}")

    return new_user

@router.post("/login", response_model=UserSchema) # Return User schema, not just Token
async def login(
    user: UserLogin, 
    response: Response, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == user.email))
    db_user = result.scalars().first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": db_user.email}, expires_delta=access_token_expires)
    
    # Set HttpOnly Cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    # Return User Profile for LocalStorage (Hybrid Approach)
    return db_user

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}

# Import dependencies inside function/module to avoid circular import issues if placed at top
from .dependencies import get_current_user

@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
