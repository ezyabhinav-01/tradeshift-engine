from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional

# Defines what a "Simulation Request" looks like
class SimulationStart(BaseModel):
    ticker: str       # e.g., "NIFTY50"
    start_date: str   # e.g., "2024-01-01"
    speed: int        # e.g., 1, 10, 100

# Defines what a single "Candle" looks like in the response
class CandleResponse(BaseModel):
    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


class UserBase(BaseModel):
    email: str


class UserCreate(UserBase):
    password: str
    full_name: Optional[str] = None
    country: Optional[str] = None
    investment_goals: Optional[str] = None
    risk_tolerance: Optional[str] = None
    preferred_industries: Optional[str] = None

    @field_validator("email")
    def validate_gmail(cls, value):
        if not value.endswith("@gmail.com"):
            raise ValueError("Only @gmail.com email addresses are allowed.")
        return value


class UserLogin(UserBase):
    password: str


class User(UserBase):
    id: int
    full_name: Optional[str] = None
    country: Optional[str] = None
    investment_goals: Optional[str] = None
    risk_tolerance: Optional[str] = None
    preferred_industries: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
