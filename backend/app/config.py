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

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

from fastapi_mail import ConnectionConfig

# Email Configuration
MAIL_USERNAME = os.getenv("MAIL_USERNAME") or "your-email@gmail.com"
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD") or "your-app-password"
MAIL_FROM = os.getenv("MAIL_FROM") or "your-email@gmail.com"
MAIL_PORT = int(os.getenv("MAIL_PORT") or 587)
MAIL_SERVER = os.getenv("MAIL_SERVER") or "smtp.gmail.com"
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME") or "TradeSim"
MAIL_STARTTLS = True
MAIL_SSL_TLS = False
USE_CREDENTIALS = True
VALIDATE_CERTS = True

conf = ConnectionConfig(
    MAIL_USERNAME=MAIL_USERNAME,
    MAIL_PASSWORD=MAIL_PASSWORD,
    MAIL_FROM=MAIL_FROM,
    MAIL_PORT=MAIL_PORT,
    MAIL_SERVER=MAIL_SERVER,
    MAIL_FROM_NAME=MAIL_FROM_NAME,
    MAIL_STARTTLS=MAIL_STARTTLS,
    MAIL_SSL_TLS=MAIL_SSL_TLS,
    USE_CREDENTIALS=USE_CREDENTIALS,
    VALIDATE_CERTS=VALIDATE_CERTS
)
