from fastapi import APIRouter, Depends, HTTPException, status, Response, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import User
from .database import get_db
from .schemas import (
    UserCreate, UserLogin, Token, User as UserSchema, 
    PinVerifyRequest, PinIdentityRequest, PinResetRequest,
    ForgotPasswordRequest, OtpVerifyRequest, ResetPasswordRequest,
    UserProfileUpdate
)
import bcrypt
from datetime import datetime, timedelta
import jwt
import os
import logging
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from .services.email_service import (
    send_welcome_email,
    send_pin_verified_email,
    send_pin_reset_email,
    send_login_alert_email,
    send_pin_created_email,
)

logger = logging.getLogger(__name__)
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

import random
def generate_demat_id() -> str:
    categories = ["Bull", "Edge", "Bear", "Tick", "Yolo"]
    category = random.choice(categories)
    random_code = f"{random.randint(0, 9999):04d}"
    return f"RS-{category}-{random_code}"

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
        logger.warning(f"Registration failed: Email {user.email} already exists")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 2. Create User
    hashed_password = get_password_hash(user.password)


         
    new_user = User(
        email=user.email, 
        hashed_password=hashed_password, 
        full_name=user.full_name,
        dob=user.dob,
        phone_number=user.phone_number,
        experience_level=user.experience_level,
        investment_goals=user.investment_goals,
        preferred_instruments=user.preferred_instruments,
        risk_tolerance=user.risk_tolerance,
        occupation=user.occupation,
        city=user.city,
        security_pin=user.security_pin,
        demat_id=generate_demat_id()
    )
    
    # Generate Refresh Token
    refresh_token = create_access_token(
        data={"sub": user.email, "type": "refresh"}, 
        expires_delta=timedelta(days=7)
    )
    new_user.refresh_token = refresh_token

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 3. Auto-Login (Set Cookies)
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
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60 # 7 days
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

    # 5. Send welcome email and PIN status in background
    background_tasks.add_task(send_welcome_email, new_user.email, new_user.full_name or "Trader", new_user.demat_id)
    
    if new_user.security_pin:
        background_tasks.add_task(send_pin_created_email, new_user.email, new_user.full_name or "Trader")

    return new_user

@router.post("/login", response_model=UserSchema)
async def login(
    user: UserLogin, 
    response: Response,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == user.email))
    db_user = result.scalars().first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": db_user.email}, expires_delta=access_token_expires)
    
    refresh_token = create_access_token(
        data={"sub": db_user.email, "type": "refresh"}, 
        expires_delta=timedelta(days=7)
    )
    db_user.refresh_token = refresh_token
    await db.commit()

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )
    
    # Trigger New Login Alert
    current_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    ip_address = request.client.host if request.client else "Unknown"
    background_tasks.add_task(
        send_login_alert_email,
        email=db_user.email,
        name=db_user.full_name or "Trader",
        login_time=current_time,
        ip_address=ip_address
    )
    
    return db_user

# --- FORGOT PASSWORD FLOW ---
import random

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()
    
    if not user or user.phone_number != request.phone_number:
        raise HTTPException(status_code=404, detail="No matching account found with these details.")
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    user.otp_code = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    await db.commit()
    
    from app.services.email_service import send_otp_email
    background_tasks.add_task(
        send_otp_email,
        email=user.email,
        name=user.full_name,
        otp_code=otp
    )
    
    return {"message": "Verification code sent to your email."}

@router.post("/verify-otp")
async def verify_otp(request: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()
    
    if not user or user.otp_code != request.otp_code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    
    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="Verification code has expired.")
        
    return {"message": "Code verified successfully."}

@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()
    
    if not user or user.otp_code != request.otp_code:
        raise HTTPException(status_code=400, detail="Invalid request.")
        
    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="Verification code has expired.")
        
    user.hashed_password = get_password_hash(request.new_password)
    user.otp_code = None # Clear OTP after use
    user.otp_expiry = None
    await db.commit()
    
    from app.services.email_service import send_password_reset_success_email
    background_tasks.add_task(
        send_password_reset_success_email,
        email=user.email,
        name=user.full_name
    )
    
    return {"message": "Password updated successfully."}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}

@router.post("/verify-pin")
async def verify_pin(
    request: PinVerifyRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request.email))
    db_user = result.scalars().first()
    
    if not db_user:
        logger.warning(f"PIN Verification failed: User {request.email} not found")
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.security_pin != request.pin:
        logger.warning(f"PIN Verification failed for {request.email}: Incorrect PIN")
        raise HTTPException(status_code=400, detail="Please enter correct security pin")
    
    # Update Refresh Token on successful verification
    refresh_token = create_access_token(
        data={"sub": db_user.email, "type": "refresh"}, 
        expires_delta=timedelta(days=7)
    )
    db_user.refresh_token = refresh_token
    await db.commit()

    # Re-issue cookies to ensure session is fresh after identity check
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )

    # Send PIN verified email in background
    verified_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    background_tasks.add_task(
        send_pin_verified_email,
        db_user.email,
        db_user.full_name or "Trader",
        verified_at
    )
    
    return {"message": "PIN verified successfully"}

@router.post("/refresh")
async def refresh_session(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Silent refresh: Uses refresh_token from cookies to issue a new access_token.
    """
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        token_type = payload.get("type")
        
        if email is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token type")
            
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Verify user and token in DB
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    
    if user is None or user.refresh_token != token:
        logger.warning(f"Refresh attempt failed for {email}: Token mismatch or user not found")
        raise HTTPException(status_code=401, detail="Refresh token revoked or invalid")

    # Issue new Access Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return {"status": "success"}

@router.post("/verify-identity")
async def verify_identity(request: PinIdentityRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == request.email))
    db_user = result.scalars().first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.dob != request.dob:
        raise HTTPException(status_code=400, detail="Invalid Date of Birth")
        
    return {"message": "Identity verified"}

@router.post("/reset-pin")
async def reset_pin(
    request: PinResetRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request.email))
    db_user = result.scalars().first()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.dob != request.dob:
        raise HTTPException(status_code=400, detail="Invalid Date of Birth")
        
    db_user.security_pin = request.new_pin
    await db.commit()

    # Send PIN reset confirmation email in background
    reset_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    background_tasks.add_task(
        send_pin_reset_email,
        db_user.email,
        db_user.full_name or "Trader",
        reset_at
    )
    
    return {"message": "PIN reset successfully"}

# Import dependencies inside function/module to avoid circular import issues if placed at top
from .dependencies import get_current_user

@router.patch("/update-profile", response_model=UserSchema)
async def update_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    update_data = profile_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
