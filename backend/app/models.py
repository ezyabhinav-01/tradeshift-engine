from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from datetime import datetime
from app.database import Base  # Import Base from database.py

# Removed: engine, SessionLocal, Base definition (now in database.py)

class TradeLog(Base):
    """
    Model representing a record of a completed trade.
    """
    __tablename__ = "trade_logs"

    id = Column(Integer, primary_key=True, index=True)

    symbol = Column(String, index=True)
    direction = Column(String)

    entry_price = Column(Float)
    exit_price = Column(Float)
    quantity = Column(Integer)
    pnl = Column(Float)

    entry_time = Column(DateTime, default=datetime.utcnow)
    exit_time = Column(DateTime, default=datetime.utcnow)

    # 🔥 NEW BEHAVIOR FIELDS (INSIDE CLASS)

    session_id = Column(String, index=True)

    holding_time = Column(Float)
    trade_number = Column(Integer)

    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)

    exit_reason = Column(String, nullable=True)

    time_since_last_trade = Column(Float, nullable=True)

    # 🚀 ADVANCED ORDER FIELDS
    user_id = Column(Integer, nullable=True, index=True)
    alert = Column(Boolean, default=False)
    order_type = Column(String, default="MARKET")  # MARKET, LIMIT, STOP, GTT
    limit_price = Column(Float, nullable=True)
    stop_price = Column(Float, nullable=True)
    triggered = Column(Boolean, default=False)
    status = Column(String, default="OPEN")  # OPEN, CLOSED, PENDING, CANCELLED, TRIGGERED, FILLED
    parent_trade_id = Column(Integer, nullable=True, index=True) # For SL/TP linked to a parent trade
    session_type = Column(String, default="LIVE", index=True) # LIVE or REPLAY

class PortfolioHolding(Base):
    """
    Model representing an actively held position in the user's portfolio.
    """
    __tablename__ = "portfolio_holdings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True) # Linking to User if needed
    symbol = Column(String, index=True)
    quantity = Column(Integer)
    average_cost = Column(Float)
    first_purchase_date = Column(DateTime, default=datetime.utcnow)
    session_type = Column(String, default="LIVE", index=True) # LIVE or REPLAY

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    dob = Column(String, nullable=True)
    experience_level = Column(String, nullable=True) # Beginner, Intermediate, Advance
    investment_goals = Column(String, nullable=True) # Learn, Growth, etc.
    preferred_instruments = Column(String, nullable=True) # Equity, Future, Options, Mutual funds
    risk_tolerance = Column(String, nullable=True) # Low, Moderate, High
    occupation = Column(String, nullable=True) # Student, Job, Retired
    city = Column(String, nullable=True)
    security_pin = Column(String(4), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserSettings(Base):
    """
    User-specific risk limits and trading preferences.
    """
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True) # One-to-one with User

    # Risk Limits
    max_daily_loss = Column(Float, default=5000.0)
    max_order_quantity = Column(Integer, default=100)
    
    # Trading Preferences
    one_click_trading_enabled = Column(Boolean, default=False)
    require_session_confirmation = Column(Boolean, default=True)

    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StockFundamental(Base):
    """
    Model for key stock ratios and fundamental metrics.
    """
    __tablename__ = "stock_fundamentals"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)
    
    # Valuation & Efficiency
    pe_ratio = Column(Float, nullable=True)
    pb_ratio = Column(Float, nullable=True)
    dividend_yield = Column(Float, nullable=True)
    roe = Column(Float, nullable=True)
    roce = Column(Float, nullable=True)
    
    # Growth & Solvency
    market_cap = Column(Float, nullable=True)
    revenue_growth_5y = Column(Float, nullable=True)
    profit_growth_5y = Column(Float, nullable=True)
    debt_to_equity = Column(Float, nullable=True)
    current_ratio = Column(Float, nullable=True)
    
    # Qualitative / Health
    ebitda_margin = Column(Float, nullable=True)
    free_cash_flow = Column(Float, nullable=True)
    promoter_holding = Column(Float, nullable=True)
    
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StockFinancial(Base):
    """
    Model for yearly financial snapshots (Revenue, Profit, etc.)
    Used for 5-Y CAGR visualizations.
    """
    __tablename__ = "stock_financials"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    year = Column(Integer)
    
    revenue = Column(Float, nullable=True)
    net_profit = Column(Float, nullable=True)
    operating_profit = Column(Float, nullable=True)
    eps = Column(Float, nullable=True)
    
class UserChartSettings(Base):
    """
    Persisted chart state per user.
    """
    __tablename__ = "user_chart_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True)

    # Store configurations as JSON strings
    active_indicators = Column(String, default="[]") 
    indicator_settings = Column(String, default="{}")
    active_drawings = Column(String, default="[]")
    tool_templates = Column(String, default="{}") # JSON mapping tool types to their saved style templates

    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DrawingTemplate(Base):
    """
    Reusable sets of drawings that users can save and apply.
    """
    __tablename__ = "drawing_templates"

    id = Column(String, primary_key=True) # UUID generated by frontend
    user_id = Column(Integer, index=True)
    
    name = Column(String)
    category = Column(String, nullable=True)
    tags = Column(String, default="[]") # JSON list
    data = Column(String) # JSON serialized drawing tools
    thumbnail = Column(String, nullable=True) # Base64 chart snapshot
class InstrumentMaster(Base):
    """
    Master table for all searchable instruments (Stocks, Indices, Options).
    Used by /api/search endpoint.
    """
    __tablename__ = "instruments_master"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    symbol = Column(String, index=True)
    name = Column(String, nullable=True)
    instrument_type = Column(String, index=True) # EQUITY, INDEX, OPTIDX
    exchange = Column(String, default="NSE")
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CommunityChannel(Base):
    __tablename__ = "community_channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    type = Column(String, default="public") # public, private
    created_at = Column(DateTime, default=datetime.utcnow)

class CommunityMessage(Base):
    __tablename__ = "community_messages"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, nullable=True, index=True) # Null for DMs
    sender_id = Column(Integer, index=True)
    recipient_id = Column(Integer, nullable=True, index=True) # Null for channel messages
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
