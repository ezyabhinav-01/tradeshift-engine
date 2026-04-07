import sys
import os
import logging

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import Base, connect_to_database_sync, sync_schema_hotpatch
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
        
        logger.info("🛠️  Running Hot-Patch for Schema Sync...")
        sync_schema_hotpatch(engine)
        logger.info("✅ Hot-Patch Sync Complete.")
        
        logger.info("🎉 Database Synchronization Successful!")
        
    except Exception as e:
        logger.error(f"❌ Synchronization Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_sync()
