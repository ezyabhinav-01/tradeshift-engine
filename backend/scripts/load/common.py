import asyncio
import json
import os
import sqlite3
import statistics
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import aiohttp
from sqlalchemy import create_engine, text


@dataclass
class MetricEvent:
    name: str
    latency_ms: float
    ok: bool
    status: int | None = None
    detail: str | None = None


@dataclass
class ScenarioResult:
    scenario: str
    users: int
    started_at: str
    completed_at: str
    total_events: int
    successful_events: int
    failed_events: int
    error_rate: float
    p50_latency_ms: float
    p95_latency_ms: float
    extra: dict[str, Any] = field(default_factory=dict)


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return round(ordered[0], 2)
    idx = (len(ordered) - 1) * pct
    lower = int(idx)
    upper = min(lower + 1, len(ordered) - 1)
    weight = idx - lower
    result = ordered[lower] * (1 - weight) + ordered[upper] * weight
    return round(result, 2)


def summarize_scenario(
    scenario: str,
    users: int,
    started_at: str,
    completed_at: str,
    events: list[MetricEvent],
    extra: dict[str, Any] | None = None,
) -> ScenarioResult:
    latencies = [event.latency_ms for event in events]
    failures = [event for event in events if not event.ok]
    return ScenarioResult(
        scenario=scenario,
        users=users,
        started_at=started_at,
        completed_at=completed_at,
        total_events=len(events),
        successful_events=len(events) - len(failures),
        failed_events=len(failures),
        error_rate=round((len(failures) / len(events)) if events else 0.0, 4),
        p50_latency_ms=percentile(latencies, 0.50),
        p95_latency_ms=percentile(latencies, 0.95),
        extra=extra or {},
    )


async def timed_request(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    *,
    name: str,
    json_body: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    timeout_seconds: float = 20.0,
) -> tuple[MetricEvent, Any]:
    start = time.perf_counter()
    try:
        async with session.request(
            method,
            url,
            json=json_body,
            params=params,
            timeout=aiohttp.ClientTimeout(total=timeout_seconds),
        ) as response:
            body = await response.json(content_type=None)
            latency_ms = (time.perf_counter() - start) * 1000
            ok = response.status < 400
            return MetricEvent(
                name=name,
                latency_ms=round(latency_ms, 2),
                ok=ok,
                status=response.status,
                detail=None if ok else json.dumps(body)[:400],
            ), body
    except Exception as exc:
        latency_ms = (time.perf_counter() - start) * 1000
        return MetricEvent(
            name=name,
            latency_ms=round(latency_ms, 2),
            ok=False,
            detail=f"{type(exc).__name__}: {exc}",
        ), None


async def wait_for_health(base_url: str, timeout_seconds: float = 45.0) -> None:
    deadline = time.monotonic() + timeout_seconds
    async with aiohttp.ClientSession() as session:
        while time.monotonic() < deadline:
            try:
                async with session.get(f"{base_url}/health", timeout=aiohttp.ClientTimeout(total=2)) as response:
                    if response.status == 200:
                        return
            except Exception:
                pass
            await asyncio.sleep(0.5)
    raise TimeoutError(f"Server at {base_url} did not become healthy within {timeout_seconds} seconds")


async def wait_for_otp(db_path: Path | None, email: str, timeout_seconds: float = 20.0, database_url: str | None = None) -> str:
    deadline = time.monotonic() + timeout_seconds
    effective_database_url = database_url.strip() if database_url else (f"sqlite:///{db_path}" if db_path else "")
    engine = None if effective_database_url.startswith("sqlite:///") else create_engine(effective_database_url)
    while time.monotonic() < deadline:
        if effective_database_url.startswith("sqlite:///"):
            assert db_path is not None
            with sqlite3.connect(db_path) as conn:
                row = conn.execute("SELECT otp_code FROM users WHERE email = ?", (email,)).fetchone()
        else:
            assert engine is not None
            with engine.connect() as conn:
                row = conn.execute(text("SELECT otp_code FROM users WHERE email = :email"), {"email": email}).fetchone()
        if row and row[0]:
            return str(row[0])
        await asyncio.sleep(0.1)
    raise TimeoutError(f"OTP not available for {email}")


async def provision_user(
    *,
    idx: int,
    base_url: str,
    db_path: Path | None,
    database_url: str | None = None,
    password: str = "Password123!",
) -> dict[str, str]:
    async with aiohttp.ClientSession(cookie_jar=aiohttp.CookieJar(unsafe=True)) as session:
        email = f"phase5-load-{idx}@gmail.com"
        register_payload = {
            "email": email,
            "password": password,
            "full_name": f"Load User {idx}",
            "phone_number": f"+9199999{idx:05d}",
            "experience_level": "Intermediate",
            "investment_goals": "Growth",
            "preferred_instruments": "Equity",
            "risk_tolerance": "Moderate",
            "occupation": "Engineer",
            "city": "Bengaluru",
            "how_heard_about": "Load Test",
        }
        register_metric, _ = await timed_request(
            session,
            "POST",
            f"{base_url}/auth/register/request",
            name="register_request",
            json_body=register_payload,
            timeout_seconds=30.0,
        )
        if not register_metric.ok:
            raise RuntimeError(f"Failed to register {email}: {register_metric.detail}")

        otp = await wait_for_otp(db_path, email, database_url=database_url)
        verify_metric, _ = await timed_request(
            session,
            "POST",
            f"{base_url}/auth/register/verify",
            name="register_verify",
            json_body={"email": email, "otp_code": otp},
        )
        if not verify_metric.ok:
            raise RuntimeError(f"Failed to verify {email}: {verify_metric.detail}")

        pin_metric, _ = await timed_request(
            session,
            "POST",
            f"{base_url}/auth/register/set-pin",
            name="register_set_pin",
            json_body={"email": email, "pin": "1234"},
        )
        if not pin_metric.ok:
            raise RuntimeError(f"Failed to set pin for {email}: {pin_metric.detail}")

    return {"email": email, "password": password}


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def scenario_to_dict(result: ScenarioResult) -> dict[str, Any]:
    return asdict(result)
