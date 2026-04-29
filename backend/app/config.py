import os
from pathlib import Path
from dotenv import load_dotenv

# Calculate absolute path to .env file (backend/.env)
base_dir = Path(__file__).resolve().parent.parent
dotenv_path = base_dir / ".env"

if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path)
    print(f"✅ Config: Loaded .env from {dotenv_path}")
else:
    print(f"⚠️ Config: .env file not found at {dotenv_path}")

# Diagnostic: Check if critical variables are loaded
if not os.getenv("MAIL_USERNAME"):
    print("❌ Config Warning: MAIL_USERNAME is not set in environment!")
else:
    print(f"📧 Config: Support email sender configured as {os.getenv('MAIL_USERNAME')}")

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
ALLOW_INSECURE_SECRET_KEY = os.getenv("ALLOW_INSECURE_SECRET_KEY", "false").strip().lower() in ("1", "true", "yes", "on")
SECRET_KEY = (os.getenv("SECRET_KEY") or "").strip()
if not SECRET_KEY:
    if APP_ENV in {"production", "staging", "beta"} and not ALLOW_INSECURE_SECRET_KEY:
        raise RuntimeError("SECRET_KEY must be set for production/staging environments.")
    SECRET_KEY = "dev-insecure-secret-key"  # nosec B105
    print("⚠️ Config Warning: SECRET_KEY not set. Using development fallback key.")
elif SECRET_KEY == "supersecretkey" and APP_ENV in {"production", "staging", "beta"} and not ALLOW_INSECURE_SECRET_KEY:  # nosec B105
    raise RuntimeError("Insecure default SECRET_KEY detected. Set a strong SECRET_KEY before startup.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

from fastapi_mail import ConnectionConfig

# Email Configuration
MAIL_USERNAME = (os.getenv("MAIL_USERNAME") or "your-email@gmail.com").strip()
MAIL_PASSWORD = (os.getenv("MAIL_PASSWORD") or "your-app-password").strip()
MAIL_FROM = (os.getenv("MAIL_FROM") or "your-email@gmail.com").strip()
MAIL_PORT = int(os.getenv("MAIL_PORT") or 587)
MAIL_SERVER = (os.getenv("MAIL_SERVER") or "smtp.gmail.com").strip()
MAIL_FROM_NAME = (os.getenv("MAIL_FROM_NAME") or "TradeShift").strip()
MAIL_STARTTLS = True
MAIL_SSL_TLS = False
USE_CREDENTIALS = True
VALIDATE_CERTS = True

def get_mail_conf(port: int = None) -> ConnectionConfig:
    """Returns a ConnectionConfig for the given port or default from env."""
    target_port = port if port is not None else MAIL_PORT
    return ConnectionConfig(
        MAIL_USERNAME=MAIL_USERNAME,
        MAIL_PASSWORD=MAIL_PASSWORD,
        MAIL_FROM=MAIL_FROM,
        MAIL_PORT=target_port,
        MAIL_SERVER=MAIL_SERVER,
        MAIL_FROM_NAME=MAIL_FROM_NAME,
        MAIL_STARTTLS=MAIL_STARTTLS,
        MAIL_SSL_TLS=MAIL_SSL_TLS,
        USE_CREDENTIALS=USE_CREDENTIALS,
        VALIDATE_CERTS=VALIDATE_CERTS
    )

# Legacy support: default conf
conf = get_mail_conf()
