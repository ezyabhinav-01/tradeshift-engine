from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, Literal
from enum import Enum

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
    dob: Optional[str] = None
    experience_level: Optional[str] = None
    investment_goals: Optional[str] = None
    preferred_instruments: Optional[str] = None
    risk_tolerance: Optional[str] = None
    occupation: Optional[str] = None
    city: Optional[str] = None
    security_pin: Optional[str] = None

    @field_validator("email")
    def validate_gmail(cls, value):
        if not value.endswith("@gmail.com"):
            raise ValueError("Only @gmail.com email addresses are allowed.")
        return value

    @field_validator("security_pin")
    def validate_pin(cls, value):
        if value and (not value.isdigit() or len(value) != 4):
            raise ValueError("PIN must be exactly 4 digits.")
        return value


class UserLogin(UserBase):
    password: str


class User(UserBase):
    id: int
    full_name: Optional[str] = None
    dob: Optional[str] = None
    experience_level: Optional[str] = None
    investment_goals: Optional[str] = None
    preferred_instruments: Optional[str] = None
    risk_tolerance: Optional[str] = None
    occupation: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


# ─── Trade Execution Schemas ────────────────────────────────────

class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    GTT = "GTT"


class TradeDirection(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class TradeStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    PENDING = "PENDING"
    CANCELLED = "CANCELLED"
    TRIGGERED = "TRIGGERED"
    FILLED = "FILLED"


class OrderModifyRequest(BaseModel):
    """Request body for PATCH /api/trade/order/{order_id}"""
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    quantity: Optional[int] = None


class TradeExecuteRequest(BaseModel):
    """Request body for POST /api/trade/execute"""
    symbol: str
    direction: TradeDirection
    quantity: int
    price: float
    order_type: OrderType = OrderType.MARKET
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    alert: bool = False
    session_type: Literal["LIVE", "REPLAY"] = "LIVE"
    simulated_time: Optional[datetime] = None

    @field_validator("quantity")
    def quantity_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v

    @field_validator("price")
    def price_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Price must be greater than 0")
        return v


class TradeResponse(BaseModel):
    """Response from trade execution"""
    trade_id: int
    status: str
    symbol: str
    direction: str
    quantity: int
    entry_price: float
    order_type: str
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    alert: bool = False
    message: str


class OrderUpdatePayload(BaseModel):
    """WebSocket order_update event payload"""
    trade_id: int
    status: str
    symbol: str
    direction: str
    entry_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    quantity: int
    pnl: float = 0.0


class TradeExitRequest(BaseModel):
    """Request body for POST /api/trade/close/{trade_id}"""
    exit_type: Literal["MARKET", "LIMIT"] = "MARKET"
    limit_price: Optional[float] = None


# ─── User Settings Schemas ──────────────────────────────────────

class UserSettings(BaseModel):
    id: int
    user_id: int
    max_daily_loss: float
    max_order_quantity: int
    one_click_trading_enabled: bool
    require_session_confirmation: bool
    last_updated: datetime

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    max_daily_loss: Optional[float] = None
    max_order_quantity: Optional[int] = None
    one_click_trading_enabled: Optional[bool] = None
    require_session_confirmation: Optional[bool] = None


# ─── Chart Persistence Schemas ───────────────────────────────────

from typing import List, Dict, Any

class ChartSettings(BaseModel):
    active_indicators: List[str]
    indicator_settings: Dict[str, Any]
    active_drawings: List[Dict[str, Any]]
    tool_templates: Dict[str, Any] = {}

    class Config:
        from_attributes = True

class ChartSettingsUpdate(BaseModel):
    active_indicators: Optional[List[str]] = None
    indicator_settings: Optional[Dict[str, Any]] = None
    active_drawings: Optional[List[Dict[str, Any]]] = None
    tool_templates: Optional[Dict[str, Any]] = None

class DrawingTemplateBase(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    tags: List[str]
    data: List[Dict[str, Any]]
    thumbnail: Optional[str] = None
    timestamp: datetime

class DrawingTemplateCreate(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    tags: List[str]
    data: List[Dict[str, Any]]
    thumbnail: Optional[str] = None

class DrawingTemplateResponse(DrawingTemplateBase):
    class Config:
        from_attributes = True


# ─── Community Schemas ──────────────────────────────────────────

class ChannelBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "public"

class ChannelCreate(ChannelBase):
    pass

class Channel(ChannelBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class MessageBase(BaseModel):
    content: str
    channel_id: Optional[int] = None
    recipient_id: Optional[int] = None

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    sender_id: int
    timestamp: datetime
    sender_name: Optional[str] = None # Added for convenience in UI

    class Config:
        from_attributes = True

class CommunityUser(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str
    is_online: bool = False

    class Config:
        from_attributes = True
