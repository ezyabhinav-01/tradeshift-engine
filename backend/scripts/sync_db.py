import sys
import os
import logging

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import Base, connect_to_database_sync, get_schema_gaps, sync_schema_hotpatch
import app.models # Ensure all models are registered

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("db_sync")

def run_sync():
    try:
        logger.info("🔄 Connecting to Database for immediate sync...")
        engine = connect_to_database_sync()
        
        logger.info("🛠️  Creating/Verifying Tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Core Tables Verified.")
        
        gaps = get_schema_gaps(engine)
        if gaps:
            logger.warning("⚠️ Legacy schema gaps detected: %s", ", ".join(gaps))
            logger.warning("⚠️ Startup hot-patching is disabled by default. Run the Phase 3 SQL migration first, or set ENABLE_LEGACY_SCHEMA_HOTPATCH=1 for one-time legacy repair.")
            sync_schema_hotpatch(engine)
        else:
            logger.info("✅ Schema matches expected columns.")
        
        logger.info("🎉 Database Synchronization Successful!")
        
    except Exception as e:
        logger.error(f"❌ Synchronization Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_sync()
