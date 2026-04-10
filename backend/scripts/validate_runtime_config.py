import os
import sys


PLACEHOLDERS = {
    "MAIL_USERNAME": {"your-email@gmail.com", "phase5-load@example.com", "phase5-test@example.com"},
    "MAIL_PASSWORD": {"your-app-password", "phase5-load-password", "phase5-test-password"},
    "MAIL_FROM": {"your-email@gmail.com", "phase5-load@example.com", "phase5-test@example.com"},
    "MINIO_ACCESS_KEY": {"minioadmin"},
    "MINIO_SECRET_KEY": {"minioadmin"},
    "ADMIN_SERVICE_KEY": {"tradeshift-local-admin"},
    "CHATBOT_API_KEY": {"tradeshift-local-key"},
}


def _bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def validate() -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    app_env = (os.getenv("APP_ENV") or "development").strip().lower()
    secret_key = (os.getenv("SECRET_KEY") or "").strip()
    cookie_secure = _bool("COOKIE_SECURE", default=False)
    hsts_enabled = _bool("HSTS_ENABLED", default=False)
    replay_max_sessions = int(os.getenv("REPLAY_MAX_CONCURRENT_SESSIONS", "2"))
    replay_start_threshold = float(os.getenv("REPLAY_START_SUCCESS_THRESHOLD", "0.95"))
    db_url = (os.getenv("DATABASE_URL") or "").strip()
    cors_origins_raw = (os.getenv("CORS_ALLOWED_ORIGINS") or "").strip()
    cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
    admin_service_key = (os.getenv("ADMIN_SERVICE_KEY") or "").strip()
    chatbot_api_key = (os.getenv("CHATBOT_API_KEY") or "").strip()

    if app_env in {"production", "staging", "beta"}:
        if len(secret_key) < 32 or secret_key in {"dev-insecure-secret-key", "supersecretkey"}:
            errors.append("SECRET_KEY must be set to a strong non-default value with length >= 32.")
        if not cookie_secure:
            errors.append("COOKIE_SECURE must be true outside development.")
        if not hsts_enabled:
            warnings.append("HSTS_ENABLED is false; enable it when the beta is served over HTTPS.")
        if replay_max_sessions < 100:
            errors.append("REPLAY_MAX_CONCURRENT_SESSIONS must be at least 100 for the 100-user beta target.")
        if replay_start_threshold < 0.95:
            errors.append("REPLAY_START_SUCCESS_THRESHOLD must be at least 0.95 for beta launch gating.")
        if db_url.startswith("sqlite"):
            errors.append("DATABASE_URL must point to PostgreSQL/TimescaleDB for beta. SQLite is not allowed.")
        if not cors_origins:
            errors.append("CORS_ALLOWED_ORIGINS must be set explicitly outside development.")
        localhost_origins = [origin for origin in cors_origins if "localhost" in origin or "127.0.0.1" in origin]
        if localhost_origins:
            warnings.append("CORS_ALLOWED_ORIGINS contains localhost entries in non-development runtime.")
        if len(admin_service_key) < 24 or admin_service_key == "tradeshift-local-admin":
            errors.append("ADMIN_SERVICE_KEY must be set explicitly to a strong non-default value for beta/prod admin endpoints.")
        if chatbot_api_key == "tradeshift-local-key":
            warnings.append("CHATBOT_API_KEY is using the local default; chatbot calls should be disabled or configured explicitly in beta.")

    for name, blocked_values in PLACEHOLDERS.items():
        value = (os.getenv(name) or "").strip()
        if value and value in blocked_values and app_env in {"production", "staging", "beta"}:
            errors.append(f"{name} is using a known placeholder/default value.")

    if app_env in {"production", "staging", "beta"} and _bool("DISABLE_EMAIL_DELIVERY", default=False):
        warnings.append("DISABLE_EMAIL_DELIVERY is enabled; transactional emails will be skipped.")

    if app_env in {"production", "staging", "beta"} and not db_url:
        errors.append("DATABASE_URL is missing.")

    return errors, warnings


def main() -> int:
    errors, warnings = validate()

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")

    if not errors and not warnings:
        print("Configuration sanity check passed.")
    elif not errors:
        print("Configuration sanity check passed with warnings.")
    else:
        print("Configuration sanity check failed.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
