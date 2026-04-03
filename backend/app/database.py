import os
import time
import asyncio
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
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
        
        # Create Async Engine
        # use relaxed SSL context for Supabase to bypass self-signed cert verification issues in slim images
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        
        engine = create_async_engine(
            db_url, 
            pool_pre_ping=True,
            pool_size=20,
            max_overflow=10,
            connect_args={"ssl": ssl_ctx}
        )
        
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
    # Ensure no asyncpg in sync url
    if "+asyncpg" in url:
        url = url.replace("+asyncpg", "")
        
    logger.info("🔄 Establishing new sync database connection...")
    # Explicitly require SSL for psycopg2 connections to Supabase
    engine = create_engine(url, pool_pre_ping=True, connect_args={"sslmode": "require"})
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
