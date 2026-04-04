from fastapi import APIRouter, Depends, HTTPException, status, Response, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Any, Union, Dict
from sqlalchemy import select
from .models import User, UserSession
import uuid
from .database import get_db
from .schemas import (
    UserCreate, UserLogin, Token, User as UserSchema, 
    PinVerifyRequest, SignupVerifyRequest, SignupPinRequest,
    PinResetOtpRequest, PinResetVerifyRequest, PinResetConfirmRequest,
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
    send_login_alert_email,
    send_pin_created_email,
    send_signup_otp_email,
    send_welcome_email,
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

def normalize_phone(phone: Optional[str]) -> Optional[str]:
    """
    Remove all non-numeric characters except the leading + to ensure consistent comparison.
    Example: '+91 91423 27953' -> '+919142327953'
    """
    if not phone:
        return None
    normalized = "".join(c for c in phone if c.isdigit())
    if phone.startswith("+"):
        normalized = "+" + normalized
    return normalized

async def create_session(db: AsyncSession, user_id: int, request: Request, response: Response):
    session_token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    db_session = UserSession(
        user_id=user_id,
        session_token=session_token,
        expires_at=expires_at,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    db.add(db_session)
    await db.commit()
    
    response.set_cookie(
        key="session_id",
        value=session_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60, # 7 days
        samesite="lax",
        secure=False # Set to True in production
    )
    return session_token



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

@router.post("/register/request")
async def register_request(
    user: UserCreate, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # 1. Check if user exists
    result = await db.execute(select(User).filter(User.email == user.email))
    db_user = result.scalars().first()
    
    if db_user:
        if db_user.is_verified:
            raise HTTPException(status_code=400, detail="Email already registered")
        # Update existing unverified user
        db_user.hashed_password = get_password_hash(user.password)
        db_user.full_name = user.full_name
        db_user.dob = user.dob
        db_user.phone_number = normalize_phone(user.phone_number)
        db_user.experience_level = user.experience_level
        db_user.investment_goals = user.investment_goals
        db_user.preferred_instruments = user.preferred_instruments
        db_user.risk_tolerance = user.risk_tolerance
        db_user.occupation = user.occupation
        db_user.city = user.city
        db_user.how_heard_about = user.how_heard_about
    else:
        # 2. Create Pending User
        hashed_password = get_password_hash(user.password)
        db_user = User(
            email=user.email, 
            hashed_password=hashed_password, 
            full_name=user.full_name,
            dob=user.dob,
            phone_number=normalize_phone(user.phone_number),
            experience_level=user.experience_level,
            investment_goals=user.investment_goals,
            preferred_instruments=user.preferred_instruments,
            risk_tolerance=user.risk_tolerance,
            occupation=user.occupation,
            city=user.city,
            how_heard_about=user.how_heard_about,
            security_pin=None,
            is_verified=False,
            balance=100000.0,
            demat_id=generate_demat_id()
        )
        db.add(db_user)
    
    # 3. Generate OTP
    otp = str(random.randint(100000, 999999))
    db_user.otp_code = otp
    db_user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    
    await db.commit()
    
    # 4. Send OTP Email
    background_tasks.add_task(send_signup_otp_email, db_user.email, otp)
    
    return {"message": "Verification code sent to your email."}

@router.post("/register/verify")
async def register_verify(
    request: SignupVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()
    
    if not user or user.is_verified:
        raise HTTPException(status_code=400, detail="Invalid verification request.")
        
    if user.otp_code != request.otp_code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    
    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="Verification code has expired.")
    
    user.is_verified = True
    user.otp_code = None
    user.otp_expiry = None
    await db.commit()
    
    return {"message": "Email verified successfully. Please set your security PIN."}

@router.post("/register/set-pin", response_model=UserSchema)
async def register_set_pin(
    request: Request,
    request_data: SignupPinRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request_data.email))
    user = result.scalars().first()
    
    if not user or not user.is_verified:
        raise HTTPException(status_code=400, detail="Account must be verified before setting a PIN.")
        
    if user.security_pin is not None:
         raise HTTPException(status_code=400, detail="Security PIN already set.")

    user.security_pin = request_data.pin
    
    refresh_token = create_access_token(
        data={"sub": user.email, "type": "refresh"}, 
        expires_delta=timedelta(days=7)
    )
    user.refresh_token = refresh_token
    await db.commit()
    await db.refresh(user)

    await create_session(db, user.id, request, response)

    background_tasks.add_task(send_welcome_email, user.email, user.full_name or "Trader", user.demat_id)
    
    return user

@router.post("/login")
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
    
    # Check if verified
    if not db_user.is_verified:
        # Resend OTP if unverified
        otp = str(random.randint(100000, 999999))
        db_user.otp_code = otp
        db_user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
        await db.commit()
        background_tasks.add_task(send_signup_otp_email, db_user.email, otp)
        return {
            "status": "REQUIRES_VERIFICATION",
            "message": "Email not verified. A new code has been sent.",
            "email": db_user.email
        }

    # Check if PIN is set
    if db_user.security_pin is None:
        return {
            "status": "REQUIRES_PIN_SETUP",
            "message": "Security PIN not setup. Please set your PIN.",
            "email": db_user.email
        }
    
    # Create persistent session
    await create_session(db, db_user.id, request, response)
    
    # Trigger New Login Alert
    current_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    ip_address = request.client.host if request.client else "Unknown"
    # background_tasks.add_task(
    #     send_login_alert_email,
    #     email=db_user.email,
    #     name=db_user.full_name or "Trader",
    #     login_time=current_time,
    #     ip_address=ip_address
    # )
    
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
    
    # Normalize phone numbers for comparison
    input_phone = normalize_phone(request.phone_number)
    db_phone = normalize_phone(user.phone_number) if user else None
    
    if not user or db_phone != input_phone:
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
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    session_token = request.cookies.get("session_id")
    if session_token:
        # Delete session from DB
        await db.execute(
            select(UserSession).filter(UserSession.session_token == session_token)
        )
        # Note: Using execute + delete for async
        from sqlalchemy import delete
        await db.execute(delete(UserSession).where(UserSession.session_token == session_token))
        await db.commit()
        
    response.delete_cookie("session_id")
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}

@router.post("/verify-pin")
async def verify_pin(
    request: Request,
    request_data: PinVerifyRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request_data.email))
    db_user = result.scalars().first()
    
    if not db_user:
        logger.warning(f"PIN Verification failed: User {request.email} not found")
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.security_pin != request_data.pin:
        logger.warning(f"PIN Verification failed for {request_data.email}: Incorrect PIN")
        raise HTTPException(status_code=400, detail="Please enter correct security pin")
    
    # Create persistent session on successful PIN verification
    await create_session(db, db_user.id, request, response)

    # Send PIN verified email in background
    verified_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    from app.services.email_service import send_pin_verified_email
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

@router.post("/pin-reset/request")
async def request_pin_reset_otp(
    request: PinResetOtpRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    user.otp_code = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    await db.commit()
    
    from app.services.email_service import send_pin_reset_otp_email
    background_tasks.add_task(
        send_pin_reset_otp_email,
        email=user.email,
        name=user.full_name,
        otp_code=otp
    )
    
    return {"message": "Verification code sent to your email."}

@router.post("/pin-reset/verify")
async def verify_pin_reset_otp(request: PinResetVerifyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()
    
    if not user or user.otp_code != request.otp_code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    
    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="Verification code has expired.")
        
    return {"message": "Code verified successfully."}

@router.post("/pin-reset/confirm")
async def confirm_pin_reset(
    request: PinResetConfirmRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()
    
    if not user or user.otp_code != request.otp_code:
        raise HTTPException(status_code=400, detail="Invalid request.")
        
    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="Verification code has expired.")
        
    user.security_pin = request.new_pin
    user.otp_code = None # Clear OTP after use
    user.otp_expiry = None
    await db.commit()
    
    from app.services.email_service import send_pin_reset_email
    reset_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    background_tasks.add_task(
        send_pin_reset_email,
        email=user.email,
        name=user.full_name,
        reset_at=reset_at
    )
    
    return {"message": "Security PIN updated successfully."}

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
        if field == "phone_number":
            value = normalize_phone(value)
        setattr(current_user, field, value)
    
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
