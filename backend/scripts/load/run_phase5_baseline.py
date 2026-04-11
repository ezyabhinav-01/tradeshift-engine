import argparse
import asyncio
import os
import sqlite3
import signal
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, text

from common import provision_user, scenario_to_dict, wait_for_health, write_json
from rest_users import run_rest_scenario
from ws_replay_users import run_ws_replay_scenario


ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT_DIR / "backend"
ARTIFACTS_DIR = ROOT_DIR / "docs" / "reports"
DEFAULT_REPORT_PATH = ARTIFACTS_DIR / "phase5_baseline_latest.json"
DEFAULT_SERVER_LOG = ARTIFACTS_DIR / "phase5_baseline_server.log"
DEFAULT_DB_PATH = ROOT_DIR / "backend" / "tests" / ".tmp" / "phase5_load.db"
DEFAULT_REPLAY_START_THRESHOLD = 0.95


def build_env(db_path: Path | None, database_url: str | None) -> dict[str, str]:
    env = os.environ.copy()
    effective_database_url = database_url.strip() if database_url else f"sqlite:///{db_path.resolve()}"
    env.update(
        {
            "APP_ENV": "test",
            "DATABASE_URL": effective_database_url,
            "RUN_BACKGROUND_JOBS": "false",
            "ENABLE_SHOONYA_BACKGROUND_CONNECT": "false",
            "ENABLE_COMMUNITY_SEED": "false",
            "DISABLE_EMAIL_DELIVERY": "true",
            "COOKIE_SECURE": "false",
            "COOKIE_SAMESITE": "lax",
            "SECRET_KEY": "phase5-load-secret-key-0123456789",
            "REDIS_HOST": "127.0.0.1",
            "REPLAY_MAX_CONCURRENT_SESSIONS": "150",
            "REPLAY_MAX_THREAD_WORKERS": "16",
            "REPLAY_AI_MAX_CONCURRENCY": "4",
            "WS_SEND_TIMEOUT_SECONDS": "1.5",
            "REPLAY_START_SUCCESS_THRESHOLD": str(DEFAULT_REPLAY_START_THRESHOLD),
            "MAIL_USERNAME": "phase5-load@example.com",
            "MAIL_PASSWORD": "phase5-load-password",
            "MAIL_FROM": "phase5-load@example.com",
            "AUTH_AI_SIDE_EFFECTS_ENABLED": "false",
        }
    )
    return env


def launch_server(base_url: str, db_path: Path | None, database_url: str | None, server_log_path: Path) -> subprocess.Popen:
    server_log_path.parent.mkdir(parents=True, exist_ok=True)
    server_log = server_log_path.open("w", encoding="utf-8")
    host = base_url.split("://", 1)[1].split(":", 1)[0]
    port = base_url.rsplit(":", 1)[1]
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", host, "--port", port],
        cwd=BACKEND_DIR,
        env=build_env(db_path, database_url),
        stdout=server_log,
        stderr=subprocess.STDOUT,
        text=True,
    )
    process._phase5_log_handle = server_log  # type: ignore[attr-defined]
    return process


def stop_server(process: subprocess.Popen) -> None:
    if process.poll() is None:
        process.send_signal(signal.SIGTERM)
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    handle = getattr(process, "_phase5_log_handle", None)
    if handle:
        handle.close()


def seed_local_index_metadata(db_path: Path | None, database_url: str | None) -> None:
    data_dir = BACKEND_DIR / "data"
    rows: list[tuple[str, str, str, str]] = []
    for parquet_path in sorted(data_dir.glob("*.parquet")):
        stem = parquet_path.stem
        if "_" not in stem:
            continue
        symbol, trade_date = stem.rsplit("_", 1)
        rows.append((symbol, trade_date, "local", str(parquet_path.resolve())))

    effective_database_url = database_url.strip() if database_url else f"sqlite:///{db_path.resolve()}"
    if effective_database_url.startswith("sqlite:///"):
        assert db_path is not None
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS index_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    instrument TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    bucket_name TEXT NOT NULL,
                    object_name TEXT NOT NULL
                )
                """
            )
            conn.execute("DELETE FROM index_metadata")
            conn.executemany(
                """
                INSERT INTO index_metadata (instrument, start_date, bucket_name, object_name)
                VALUES (?, ?, ?, ?)
                """,
                rows,
            )
            conn.commit()
        return

    engine = create_engine(effective_database_url)
    object_names = [object_name for _, _, _, object_name in rows]
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS index_metadata (
                    id SERIAL PRIMARY KEY,
                    instrument VARCHAR NOT NULL,
                    start_date TIMESTAMP NOT NULL,
                    bucket_name VARCHAR NOT NULL,
                    object_name VARCHAR NOT NULL
                )
                """
            )
        )
        if object_names:
            conn.execute(
                text("DELETE FROM index_metadata WHERE bucket_name = 'local' AND object_name = ANY(:object_names)"),
                {"object_names": object_names},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO index_metadata (instrument, start_date, bucket_name, object_name)
                    VALUES (:instrument, :start_date, :bucket_name, :object_name)
                    """
                ),
                [
                    {
                        "instrument": instrument,
                        "start_date": trade_date,
                        "bucket_name": bucket_name,
                        "object_name": object_name,
                    }
                    for instrument, trade_date, bucket_name, object_name in rows
                ],
            )


async def provision_users(base_url: str, db_path: Path | None, users: int, database_url: str | None) -> list[dict[str, str]]:
    semaphore = asyncio.Semaphore(2)

    async def _provision(idx: int) -> dict[str, str]:
        async with semaphore:
            return await provision_user(idx=idx, base_url=base_url, db_path=db_path, database_url=database_url)

    return await asyncio.gather(*[_provision(idx) for idx in range(1, users + 1)])


async def run_baseline(base_url: str, db_path: Path | None, database_url: str | None, users: int, report_path: Path) -> dict:
    if db_path is not None:
        db_path = db_path.resolve()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        if db_path.exists():
            db_path.unlink()
    seed_local_index_metadata(db_path, database_url)

    process = launch_server(base_url, db_path, database_url, DEFAULT_SERVER_LOG)
    await wait_for_health(base_url)
    try:
        provisioned_users = await provision_users(base_url, db_path, users, database_url)
        rest = await run_rest_scenario(base_url, provisioned_users)
        ws = await run_ws_replay_scenario(base_url, provisioned_users)
    finally:
        stop_server(process)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "users": users,
        "database": database_url or str(db_path),
        "scenarios": {
            "rest_usage": scenario_to_dict(rest["summary"]),
            "ws_replay_usage": scenario_to_dict(ws["summary"]),
        },
        "failures": {
            "rest_usage": rest["failures"],
            "ws_replay_usage": ws["failures"],
        },
        "artifacts": {
            "server_log": str(DEFAULT_SERVER_LOG),
        },
    }
    write_json(report_path, report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Phase 5 baseline load scenarios.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8010")
    parser.add_argument("--users", type=int, default=100)
    parser.add_argument("--report-path", default=str(DEFAULT_REPORT_PATH))
    parser.add_argument("--db-path", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--database-url", default=os.getenv("LOAD_TEST_DATABASE_URL", "").strip())
    args = parser.parse_args()
    db_path = None if args.database_url else Path(args.db_path)

    report = asyncio.run(
        run_baseline(
            base_url=args.base_url,
            db_path=db_path,
            database_url=args.database_url or None,
            users=args.users,
            report_path=Path(args.report_path),
        )
    )
    print(f"Phase 5 baseline report written to {args.report_path}")
    for name, summary in report["scenarios"].items():
        print(
            f"{name}: users={summary['users']} "
            f"p50={summary['p50_latency_ms']}ms p95={summary['p95_latency_ms']}ms "
            f"errors={summary['failed_events']}/{summary['total_events']}"
        )


if __name__ == "__main__":
    main()
