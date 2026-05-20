import asyncio
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR
TEST_TMP_DIR = BACKEND_DIR / "tests" / ".tmp"
TEST_TMP_DIR.mkdir(parents=True, exist_ok=True)
TEST_DB_PATH = TEST_TMP_DIR / "phase5_integration.db"

os.environ.setdefault("APP_ENV", "test")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["RUN_BACKGROUND_JOBS"] = "false"
os.environ["ENABLE_SHOONYA_BACKGROUND_CONNECT"] = "false"
os.environ["ENABLE_COMMUNITY_SEED"] = "false"
os.environ["COOKIE_SECURE"] = "false"
os.environ["COOKIE_SAMESITE"] = "lax"
os.environ["MAIL_USERNAME"] = "phase5-test@example.com"
os.environ["MAIL_PASSWORD"] = "phase5-test-password"
os.environ["MAIL_FROM"] = "phase5-test@example.com"
os.environ["SECRET_KEY"] = "phase5-test-secret-key"
os.environ["AUTH_AI_SIDE_EFFECTS_ENABLED"] = "false"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

from app.database import Base, get_session  # noqa: E402
from app.models import CommunityChannel, CommunityMessage, PortfolioSnapshot, TradeLog, User, UserSession  # noqa: E402
from app.session_store import clear_session_identity_cache  # noqa: E402
from app.services.order_management import oms_service  # noqa: E402
import main  # noqa: E402


async def _noop(*_args, **_kwargs):
    return None


# Avoid outbound network side effects during integration tests.
main.shoonya_live.connect = lambda: None
for module in (main.auth, main.trading):
    for name in (
        "send_signup_otp_email",
        "send_personalized_welcome_email",
        "send_trade_confirmation_email",
        "send_trade_closed_email",
        "send_otp_email",
        "send_pin_reset_otp_email",
        "send_password_reset_success_email",
        "send_pin_reset_email",
    ):
        if hasattr(module, name):
            setattr(module, name, _noop)


@pytest.fixture(scope="session")
def app():
    Base.metadata.create_all(bind=main.ensure_sync_engine())
    return main.app


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


async def _reset_database_state():
    async with await get_session() as db:
        for model in (CommunityMessage, CommunityChannel, PortfolioSnapshot, UserSession, TradeLog, User):
            await db.execute(delete(model))
        await db.commit()


@pytest.fixture(autouse=True)
def reset_state():
    asyncio.run(_reset_database_state())
    clear_session_identity_cache()
    oms_service._pending_presence_cache.clear()
    oms_service._queued_price_updates.clear()
    for task in list(oms_service._price_update_workers.values()):
        task.cancel()
    oms_service._price_update_workers.clear()
    yield
    asyncio.run(_reset_database_state())
    clear_session_identity_cache()


@pytest.fixture
def helpers():
    class IntegrationHelpers:
        user_counter = 0

        @staticmethod
        def run(coro):
            return asyncio.run(coro)

        @staticmethod
        async def fetch_user(email: str):
            async with await get_session() as db:
                result = await db.execute(
                    select(User).where(User.email == email)
                )
                return result.scalars().first()

        @staticmethod
        async def fetch_model(model, *filters):
            async with await get_session() as db:
                stmt = select(model)
                for condition in filters:
                    stmt = stmt.where(condition)
                result = await db.execute(stmt)
                return result.scalars().all()

        @classmethod
        def register_and_login(cls, client, *, prefix: str = "phase5"):
            cls.user_counter += 1
            email = f"{prefix}{cls.user_counter}@gmail.com"
            payload = {
                "email": email,
                "password": "Password123!",
                "full_name": "Phase Five Trader",
                "phone_number": "+91 99999 12345",
                "experience_level": "Intermediate",
                "investment_goals": "Growth",
                "preferred_instruments": "Equity",
                "risk_tolerance": "Moderate",
                "occupation": "Engineer",
                "city": "Bengaluru",
                "how_heard_about": "Testing",
            }
            resp = client.post("/auth/register/request", json=payload)
            assert resp.status_code == 200, resp.text

            async def read_otp():
                async with await get_session() as db:
                    result = await db.execute(
                        select(User).where(User.email == email)
                    )
                    user = result.scalars().first()
                    return user.otp_code

            otp = cls.run(read_otp())
            verify_resp = client.post("/auth/register/verify", json={"email": email, "otp_code": otp})
            assert verify_resp.status_code == 200, verify_resp.text

            pin_resp = client.post("/auth/register/set-pin", json={"email": email, "pin": "1234"})
            assert pin_resp.status_code == 200, pin_resp.text
            assert "session_id" in pin_resp.cookies or client.cookies.get("session_id")
            return email

        @staticmethod
        async def get_user_by_email(email: str):
            async with await get_session() as db:
                result = await db.execute(
                    select(User).where(User.email == email)
                )
                return result.scalars().first()

        @staticmethod
        async def get_sessions_for_user(user_id: int):
            async with await get_session() as db:
                result = await db.execute(
                    select(UserSession).where(UserSession.user_id == user_id)
                )
                return result.scalars().all()

        @staticmethod
        async def get_trade_rows(*conditions):
            async with await get_session() as db:
                stmt = select(TradeLog)
                for condition in conditions:
                    stmt = stmt.where(condition)
                stmt = stmt.order_by(TradeLog.id.asc())
                result = await db.execute(stmt)
                return result.scalars().all()

        @staticmethod
        async def get_snapshots(user_id: int):
            async with await get_session() as db:
                result = await db.execute(
                    select(PortfolioSnapshot)
                    .where(PortfolioSnapshot.user_id == user_id)
                    .order_by(PortfolioSnapshot.timestamp.asc())
                )
                return result.scalars().all()

        @staticmethod
        def wait_for(condition, timeout_seconds: float = 2.5, interval_seconds: float = 0.05):
            import time

            deadline = time.monotonic() + timeout_seconds
            while True:
                if condition():
                    return True
                if time.monotonic() >= deadline:
                    return False
                time.sleep(interval_seconds)

    return IntegrationHelpers
