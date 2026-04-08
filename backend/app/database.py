import os
from dotenv import load_dotenv

# Load environment variables explicitly
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

import time
import asyncio
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global Cache for Singleton Pattern
_db_cache = {
    "engine": None,
    "session_maker": None,
    "engine_sync": None,
    "session_maker_sync": None
}

Base = declarative_base()


def _env_int(name: str, default: int) -> int:
    val = os.getenv(name)
    if val is None:
        return default
    try:
        return int(val)
    except Exception:
        return default


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "on")

def get_database_url():
    # Default to localhost for local dev, 'db' for docker
    # Using +asyncpg for async operations
    default_url = "postgresql+asyncpg://user:password@localhost:5432/tradeshift_db" 
    url = os.getenv("DATABASE_URL", default_url)
    return url

def get_database_url_async():
    url = get_database_url()
    # Supabase might provide postgres://, but SQLAlchemy 1.4+ and asyncpg need postgresql+asyncpg://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    # Fix for asyncpg: remove sslmode=require query string as asyncpg connect() doesn't accept it
    if "?sslmode=require" in url:
        url = url.replace("?sslmode=require", "")
    elif "&sslmode=require" in url:
        url = url.replace("&sslmode=require", "")
        
    # 🔥 Fix for Supabase Transaction Pooler (PgBouncer)
    # Prepared statements are NOT supported in Transaction Mode.
    if "?" in url:
        url += "&prepared_statement_cache_size=0"
    else:
        url += "?prepared_statement_cache_size=0"
        
    return url


async def connect_to_database():
    """
    Implements the cached connection pattern for async.
    Returns the Async Engine.
    """
    global _db_cache
    
    # 1. Check cache (Return cached conn)
    if _db_cache["engine"]:
        return _db_cache["engine"]
    
    # 2. Establish Connection
    logger.info("🔄 Establishing new async database connection...")
    try:
        db_url = get_database_url_async()
        
        # Determine if SSL is needed (skip for local Docker/localhost)
        is_local = "localhost" in db_url or "@db:" in db_url or "127.0.0.1" in db_url
        is_supabase = "supabase.com" in db_url or "supabase.co" in db_url
        
        connect_args = {}
        if not is_local or is_supabase:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            connect_args["ssl"] = ssl_ctx
            
        # 🔥 Mandatory fix for Supabase Transaction Pooler (PgBouncer)
        # asyncpg must have statement cache disabled in transaction mode.
        connect_args["statement_cache_size"] = 0
        
        # Conservative defaults for managed poolers (e.g. Supabase free/pro pooler).
        pool_size = _env_int("DB_POOL_SIZE", 3 if is_supabase else 10)
        max_overflow = _env_int("DB_MAX_OVERFLOW", 2 if is_supabase else 10)
        pool_timeout = _env_int("DB_POOL_TIMEOUT", 30)
        pool_recycle = _env_int("DB_POOL_RECYCLE", 1800)
        use_null_pool = _env_bool("DB_USE_NULL_POOL", default=is_supabase)

        engine_kwargs = {
            "pool_pre_ping": True,
            "connect_args": connect_args,
        }
        if use_null_pool:
            engine_kwargs["poolclass"] = NullPool
            logger.info("🛟 Async DB using NullPool (delegating pooling to provider).")
        else:
            engine_kwargs.update({
                "pool_size": max(1, pool_size),
                "max_overflow": max(0, max_overflow),
                "pool_timeout": max(5, pool_timeout),
                "pool_recycle": max(300, pool_recycle),
            })

        engine = create_async_engine(db_url, **engine_kwargs)
        
        # Test Connection
        async with engine.connect() as connection:
             logger.info("✅ Async Database connected successfully.")
        
        # Cache the connection
        _db_cache["engine"] = engine
        
        # Configure AsyncSessionMaker
        _db_cache["session_maker"] = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )
        
        return engine
        
    except Exception as e:
        logger.error(f"❌ Async Database connection failed: {e}")
        _db_cache["engine"] = None
        _db_cache["session_maker"] = None
        raise e

async def get_db():
    """
    FastAPI Dependency to get Async DB session.
    """
    if not _db_cache["session_maker"]:
        await connect_to_database()
    
    async_session = _db_cache["session_maker"]
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

def connect_to_database_sync():
    """
    Singleton pattern for sync engine.
    """
    global _db_cache
    if _db_cache["engine_sync"]:
        return _db_cache["engine_sync"]
        
    url = get_database_url()
    # 1. Strip async dialect
    if "postgresql+asyncpg://" in url:
        url = url.replace("postgresql+asyncpg://", "postgresql://")
    elif "postgres+asyncpg://" in url:
        url = url.replace("postgres+asyncpg://", "postgresql://")
        
    # 2. Strip ALL query parameters (psycopg2 is sensitive)
    if "?" in url:
        url = url.split("?")[0]
        
    logger.info("🔄 Establishing new sync database connection...")
    
    # Determine if SSL is needed
    is_local = "localhost" in url or "@db:" in url or "127.0.0.1" in url
    is_supabase = "supabase.com" in url or "supabase.co" in url
    connect_args = {}
    if not is_local or is_supabase:
        # Explicitly require SSL for psycopg2 connections to remote like Supabase
        connect_args["sslmode"] = "require"

    pool_size = _env_int("DB_POOL_SIZE_SYNC", 2 if is_supabase else 5)
    max_overflow = _env_int("DB_MAX_OVERFLOW_SYNC", 1 if is_supabase else 5)
    pool_timeout = _env_int("DB_POOL_TIMEOUT_SYNC", 30)
    pool_recycle = _env_int("DB_POOL_RECYCLE_SYNC", 1800)
    use_null_pool = _env_bool("DB_USE_NULL_POOL_SYNC", default=is_supabase)

    engine_kwargs = {
        "pool_pre_ping": True,
        "connect_args": connect_args
    }
    if use_null_pool:
        engine_kwargs["poolclass"] = NullPool
        logger.info("🛟 Sync DB using NullPool (delegating pooling to provider).")
    else:
        engine_kwargs.update({
            "pool_size": max(1, pool_size),
            "max_overflow": max(0, max_overflow),
            "pool_timeout": max(5, pool_timeout),
            "pool_recycle": max(300, pool_recycle),
        })

    engine = create_engine(url, **engine_kwargs)
    _db_cache["engine_sync"] = engine
    _db_cache["session_maker_sync"] = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine

def get_db_sync():
    """
    FastAPI Dependency for synchronous DB session.
    """
    if not _db_cache["session_maker_sync"]:
        connect_to_database_sync()
    
    db = _db_cache["session_maker_sync"]()
    try:
        yield db
    finally:
        db.close()

async def get_session():
    """
    Returns a new Async SQLAlchemy Session.
    Used for non-FastAPI contexts.
    """
    if not _db_cache["session_maker"]:
        await connect_to_database()
    return _db_cache["session_maker"]()


def sync_schema_hotpatch(engine):
    """
    Checks the database for missing columns in the 'users' table and adds them if found.
    This ensures remote Supabase DB stays in sync with SQLAlchemy models without manual migrations.
    """
    inspector = inspect(engine)
    columns_info = inspector.get_columns("users")
    existing_columns = [col["name"] for col in columns_info]
    
    # List of columns that might be missing in older schemas
    required_columns = [
        ("full_name", "VARCHAR"),
        ("dob", "VARCHAR"),
        ("experience_level", "VARCHAR"),
        ("investment_goals", "VARCHAR"),
        ("preferred_instruments", "VARCHAR"),
        ("risk_tolerance", "VARCHAR"),
        ("occupation", "VARCHAR"),
        ("city", "VARCHAR"),
        ("how_heard_about", "VARCHAR"),
        ("security_pin", "VARCHAR(4)"),
        ("phone_number", "VARCHAR"),
        ("otp_code", "VARCHAR(6)"),
        ("otp_expiry", "TIMESTAMP"),
        ("demat_id", "VARCHAR(50)"),
        ("refresh_token", "VARCHAR"),
        ("is_verified", "BOOLEAN DEFAULT FALSE"),
        ("balance", "FLOAT DEFAULT 100000.0"),
        ("last_active_at", "TIMESTAMP"),
        ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    ]
    
    with engine.connect() as conn:
        for col_name, col_type in required_columns:
            if col_name not in existing_columns:
                logger.info(f"🛠️  Hot-patching DB: Adding missing column '{col_name}' to 'users' table...")
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    logger.info(f"✅ Column '{col_name}' added successfully.")
                except Exception as e:
                    logger.error(f"❌ Failed to add column '{col_name}': {e}")
        
        # Verify index for demat_id if column was added or exists
        try:
            indexes = inspector.get_indexes("users")
            index_names = [idx["name"] for idx in indexes]
            if "ix_users_demat_id" not in index_names:
                 logger.info("🛠️  Hot-patching DB: Adding unique index for 'demat_id'...")
                 conn.execute(text("CREATE UNIQUE INDEX ix_users_demat_id ON users (demat_id) WHERE demat_id IS NOT NULL"))
                 conn.commit()
        except Exception as e:
             logger.error(f"❌ Failed to create demat_id index: {e}")
