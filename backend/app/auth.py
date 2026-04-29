from fastapi import APIRouter, Depends, HTTPException, status, Response, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Any, Union, Dict
from sqlalchemy import select, delete, or_, func
from .models import User, UserSession
import uuid
import random
import bcrypt
import jwt
import os
import logging
import hmac
import asyncio
from datetime import datetime, timedelta
from typing import Optional

from .database import get_db
from .schemas import (
    UserCreate, UserLogin, Token, User as UserSchema, 
    PinVerifyRequest, SignupVerifyRequest, SignupPinRequest,
    PinResetOtpRequest, PinResetVerifyRequest, PinResetConfirmRequest,
    ForgotPasswordRequest, OtpVerifyRequest, ResetPasswordRequest,
    UserProfileUpdate
)
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from .auth_side_effects import enqueue_auth_side_effect
from .services.email_service import (
    send_login_alert_email,
    send_pin_created_email,
    send_signup_otp_email,
    send_welcome_email,
    send_personalized_welcome_email,
    send_otp_email,
    send_pin_reset_otp_email,
    send_password_reset_success_email,
    send_pin_reset_email
)
from .dependencies import get_current_user
from .session_store import cache_session_identity, invalidate_session_identity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# --- AUTH HELPER LOGIC ---

def verify_password(plain_password, hashed_password):
    if not hashed_password:
        return False
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)
    except ValueError:
        # Invalid/legacy truncated bcrypt payload should never crash auth flow.
        return False

def get_password_hash(password):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def hash_pin(pin: str) -> str:
    return get_password_hash(pin)


async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    return await asyncio.to_thread(verify_password, plain_password, hashed_password)


async def get_password_hash_async(password: str) -> str:
    return await asyncio.to_thread(get_password_hash, password)

def verify_pin_value(plain_pin: str, stored_pin: Optional[str]) -> bool:
    if not stored_pin:
        return False
    # Backward compatibility for legacy plain-text PIN rows.
    if stored_pin.startswith("$2a$") or stored_pin.startswith("$2b$") or stored_pin.startswith("$2y$"):
        return verify_password(plain_pin, stored_pin)
    return hmac.compare_digest(stored_pin, plain_pin)

def _cookie_secure() -> bool:
    return os.getenv("COOKIE_SECURE", "true").lower() in ("1", "true", "yes", "on")

def _cookie_samesite() -> str:
    value = os.getenv("COOKIE_SAMESITE", "none").strip().lower()
    if value not in ("lax", "strict", "none"):
        return "none"
    return value

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
    user_email = None
    if hasattr(request, "state"):
        user_email = getattr(request.state, "session_user_email", None)
    if user_email:
        cache_session_identity(session_token, user_id=user_id, email=user_email, expires_at=expires_at)
    
    response.set_cookie(
        key="session_id",
        value=session_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60, # 7 days
        samesite=_cookie_samesite(),
        secure=_cookie_secure(),
    )
    return session_token

from typing import Optional

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

import secrets

def generate_demat_id() -> str:
    categories = ["Bull", "Edge", "Bear", "Tick", "Yolo"]
    category = secrets.choice(categories)
    random_code = f"{secrets.randbelow(10000):04d}"
    return f"RS-{category}-{random_code}"

async def generate_and_set_otp(db: AsyncSession, user: User) -> str:
    otp = "".join(secrets.choice("0123456789") for _ in range(6))
    user.otp_code = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    await db.commit()
    return otp

async def verify_otp_logic(db: AsyncSession, email: str, otp_code: str) -> User:
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request. User not found.")
    if user.otp_code != otp_code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    if not user.otp_expiry or datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="Verification code has expired.")
        
    return user

async def clear_otp(db: AsyncSession, user: User):
    user.otp_code = None
    user.otp_expiry = None
    await db.commit()

# --- ROUTES ---

@router.post("/register/request")
async def register_request(
    user: UserCreate, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).filter(User.email == user.email))
    db_user = result.scalars().first()
    
    if db_user:
        if db_user.is_verified:
            raise HTTPException(status_code=400, detail="Email already registered")
        # Update existing unverified user
        db_user.hashed_password = await get_password_hash_async(user.password)
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
        # Create Pending User
        hashed_password = await get_password_hash_async(user.password)
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
    
    otp = await generate_and_set_otp(db, db_user)
    enqueue_auth_side_effect("signup_otp", send_signup_otp_email, db_user.email, otp)
    return {"message": "Verification code sent to your email."}

@router.post("/register/verify")
async def register_verify(
    request: SignupVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    user = await verify_otp_logic(db, request.email, request.otp_code)
    
    if user.is_verified:
        raise HTTPException(status_code=400, detail="User already verified.")
    
    user.is_verified = True
    await clear_otp(db, user)
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

    user.security_pin = hash_pin(request_data.pin)
    
    refresh_token = create_access_token(
        data={"sub": user.email, "type": "refresh"}, 
        expires_delta=timedelta(days=7)
    )
    user.refresh_token = refresh_token
    await db.commit()
    await db.refresh(user)

    request.state.session_user_email = user.email
    await create_session(db, user.id, request, response)
    
    profile_data = {
        "investment_goals": user.investment_goals,
        "risk_tolerance": user.risk_tolerance,
        "preferred_instruments": user.preferred_instruments
    }
    enqueue_auth_side_effect(
        "personalized_welcome_email",
        send_personalized_welcome_email,
        user.email,
        user.full_name or "Trader",
        user.demat_id,
        profile_data,
        ai_related=True,
    )
    
    return user

@router.post("/login")
async def login(
    user: UserLogin, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    identifier = (user.email or "").strip()
    result = await db.execute(
        select(User).filter(
            or_(
                func.lower(User.email) == identifier.lower(),
                func.lower(User.demat_id) == identifier.lower(),
            )
        )
    )
    db_user = result.scalars().first()
    
    if not db_user or not db_user.hashed_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if not await verify_password_async(user.password, db_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    if not db_user.is_verified:
        otp = await generate_and_set_otp(db, db_user)
        enqueue_auth_side_effect("signup_otp", send_signup_otp_email, db_user.email, otp)
        return {
            "status": "REQUIRES_VERIFICATION",
            "message": "Email not verified. A new code has been sent.",
            "email": db_user.email
        }

    if db_user.security_pin is None:
        return {
            "status": "REQUIRES_PIN_SETUP",
            "message": "Security PIN not setup. Please set your PIN.",
            "email": db_user.email
        }

    # Password verified — but do NOT create a session yet.
    # The user must still pass PIN verification (/auth/verify-pin),
    # which is the only endpoint that calls create_session.
    return {
        "status": "REQUIRES_PIN",
        "message": "Please verify your security PIN to continue.",
        "email": db_user.email
    }

# --- FORGOT PASSWORD FLOW ---

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
    
    otp = await generate_and_set_otp(db, user)
    enqueue_auth_side_effect("password_reset_otp", send_otp_email, email=user.email, name=user.full_name, otp_code=otp)
    return {"message": "Verification code sent to your email."}

@router.post("/verify-otp")
async def verify_otp(request: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    await verify_otp_logic(db, request.email, request.otp_code)
    return {"message": "Code verified successfully."}

@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    user = await verify_otp_logic(db, request.email, request.otp_code)
    user.hashed_password = await get_password_hash_async(request.new_password)
    await clear_otp(db, user)
    
    enqueue_auth_side_effect("password_reset_success", send_password_reset_success_email, email=user.email, name=user.full_name)
    return {"message": "Password updated successfully."}

@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    session_token = request.cookies.get("session_id")

    if session_token:
        # 1. Resolve user_id BEFORE deleting the session row
        id_res = await db.execute(
            select(UserSession.user_id).filter(UserSession.session_token == session_token)
        )
        user_id_row = id_res.first()

        if user_id_row:
            user_id = user_id_row[0]

            # 2. Delete the session so it can never be replayed
            await db.execute(
                delete(UserSession).where(UserSession.session_token == session_token)
            )

            # 3. Nullify the refresh_token on the User row so /auth/refresh
            #    cannot silently re-authenticate this user after logout
            user_res = await db.execute(select(User).filter(User.id == user_id))
            db_user = user_res.scalars().first()
            if db_user:
                db_user.refresh_token = None

            await db.commit()

    # Clear all auth-related cookies (match the same attributes set on creation)
    # Clear all auth-related cookies (match the same attributes set on creation)
    # This is critical for cross-site cookie deletion (e.g. Netlify -> Azure)
    s_site = _cookie_samesite()
    s_cure = _cookie_secure()
    
    response.delete_cookie("session_id", httponly=True, samesite=s_site, secure=s_cure)
    response.delete_cookie("access_token", httponly=True, samesite=s_site, secure=s_cure)
    response.delete_cookie("refresh_token", httponly=True, samesite=s_site, secure=s_cure)
    
    return {"message": "Logged out successfully"}

@router.post("/verify-pin")
async def verify_pin(
    request: Request,
    request_data: PinVerifyRequest,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    identifier = (request_data.email or "").strip()
    result = await db.execute(
        select(User).filter(
            or_(
                func.lower(User.email) == identifier.lower(),
                func.lower(User.demat_id) == identifier.lower(),
            )
        )
    )
    db_user = result.scalars().first()
    
    if not db_user:
        logger.warning(f"PIN Verification failed: User {request.email} not found")
        raise HTTPException(status_code=404, detail="User not found")
        
    if not verify_pin_value(request_data.pin, db_user.security_pin):
        logger.warning(f"PIN Verification failed for {request_data.email}: Incorrect PIN")
        raise HTTPException(status_code=400, detail="Please enter correct security pin")

    # Auto-migrate legacy plain-text PIN to bcrypt hash after successful verification.
    if db_user.security_pin and not (
        db_user.security_pin.startswith("$2a$")
        or db_user.security_pin.startswith("$2b$")
        or db_user.security_pin.startswith("$2y$")
    ):
        db_user.security_pin = hash_pin(request_data.pin)
        await db.commit()
    
    request.state.session_user_email = db_user.email
    await create_session(db, db_user.id, request, response)
    return {"message": "PIN verified successfully"}

@router.post("/refresh")
async def refresh_session(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        token_type = payload.get("type")
        
        if email is None or token_type != "refresh": # nosec B105
            raise HTTPException(status_code=401, detail="Invalid refresh token type")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    
    if user is None or user.refresh_token != token:
        logger.warning(f"Refresh attempt failed for {email}: Token mismatch or user not found")
        raise HTTPException(status_code=401, detail="Refresh token revoked or invalid")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=_cookie_secure(),
        samesite=_cookie_samesite(),
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
    
    otp = await generate_and_set_otp(db, user)
    enqueue_auth_side_effect("pin_reset_otp", send_pin_reset_otp_email, email=user.email, name=user.full_name, otp_code=otp)
    return {"message": "Verification code sent to your email."}

@router.post("/pin-reset/verify")
async def verify_pin_reset_otp(request: PinResetVerifyRequest, db: AsyncSession = Depends(get_db)):
    await verify_otp_logic(db, request.email, request.otp_code)
    return {"message": "Code verified successfully."}

@router.post("/pin-reset/confirm")
async def confirm_pin_reset(
    request: PinResetConfirmRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    user = await verify_otp_logic(db, request.email, request.otp_code)
    user.security_pin = hash_pin(request.new_pin)
    await clear_otp(db, user)
    
    reset_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    enqueue_auth_side_effect("pin_reset_success", send_pin_reset_email, email=user.email, name=user.full_name, reset_at=reset_at)
    return {"message": "Security PIN updated successfully."}

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
