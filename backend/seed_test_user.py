import asyncio
from app.models import User
from app.database import get_session
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_user():
    async with await get_session() as db:
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == "ritsham007@gmail.com"))
        user = result.scalars().first()
        
        hashed_password = pwd_context.hash("123456")
        
        if user:
            print("Updating existing user...")
            user.hashed_password = hashed_password
            user.security_pin = "1234"
            user.is_verified = True
        else:
            print("Creating new user...")
            user = User(
                email="ritsham007@gmail.com",
                hashed_password=hashed_password,
                full_name="Ritsham Test",
                security_pin="1234",
                is_verified=True,
                balance=100000.0
            )
            db.add(user)
        
        await db.commit()
        print("✅ User ritsham007@gmail.com seeded successfully.")

if __name__ == "__main__":
    asyncio.run(seed_user())
