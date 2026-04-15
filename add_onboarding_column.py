import asyncio
from sqlalchemy import text
from backend.app.database import connect_to_database_sync

def run():
    engine = connect_to_database_sync()
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN onboarding_status JSON DEFAULT '{}'"))
            conn.commit()
            print("Successfully added onboarding_status column")
        except Exception as e:
            print("Error or already exists:", e)

if __name__ == "__main__":
    run()
