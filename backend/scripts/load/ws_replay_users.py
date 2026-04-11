import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any

import aiohttp
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from common import MetricEvent, summarize_scenario


async def _resolve_replay_date(base_url: str) -> str:
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{base_url}/api/available-dates/RELIANCE", timeout=aiohttp.ClientTimeout(total=20)) as response:
            payload = await response.json(content_type=None)
            dates = payload.get("dates") or []
            if not dates:
                raise RuntimeError("No replay dates available for RELIANCE")
            return str(dates[0])


async def _login_for_session(base_url: str, user: dict[str, str]) -> str:
    async with aiohttp.ClientSession(cookie_jar=aiohttp.CookieJar(unsafe=True)) as session:
        async with session.post(
            f"{base_url}/auth/login",
            json={"email": user["email"], "password": user["password"]},
            timeout=aiohttp.ClientTimeout(total=20),
        ) as response:
            if response.status >= 400:
                detail = await response.text()
                raise RuntimeError(f"Login failed for {user['email']}: {response.status} {detail}")
            cookie_jar = session.cookie_jar.filter_cookies(base_url)
            session_cookie = cookie_jar.get("session_id")
            if not session_cookie:
                raise RuntimeError(f"No session_id cookie returned for {user['email']}")
            return session_cookie.value


async def _ws_user_flow(base_ws_url: str, base_url: str, replay_date: str, user: dict[str, str]) -> dict[str, Any]:
    events: list[MetricEvent] = []
    disconnect_code = None
    messages = 0
    start_ack_ms = None
    try:
        session_id = await _login_for_session(base_url, user)
        connect_started = time.perf_counter()
        async with connect(
            f"{base_ws_url}/ws/ticker",
            additional_headers={"Cookie": f"session_id={session_id}"},
            open_timeout=20,
            close_timeout=10,
            ping_interval=20,
            ping_timeout=20,
            max_queue=64,
        ) as websocket:
            events.append(MetricEvent("ws_connect", round((time.perf_counter() - connect_started) * 1000, 2), True))

            start_sent = time.perf_counter()
            await websocket.send(
                json.dumps(
                    {
                        "command": "START",
                        "symbol": "RELIANCE",
                        "date": replay_date,
                        "speed": 5,
                    }
                )
            )

            deadline = time.monotonic() + 4.0
            while time.monotonic() < deadline:
                remaining = max(0.2, deadline - time.monotonic())
                try:
                    raw = await asyncio.wait_for(websocket.recv(), timeout=remaining)
                except asyncio.TimeoutError:
                    continue
                payload = json.loads(raw)
                messages += 1
                if payload.get("type") == "SPEED_ACK" and start_ack_ms is None:
                    start_ack_ms = round((time.perf_counter() - start_sent) * 1000, 2)
                    events.append(MetricEvent("ws_start_ack", start_ack_ms, True))
                if payload.get("type") == "ERROR":
                    events.append(MetricEvent("ws_runtime", 0.0, False, detail=payload.get("message")))
                    break

            await websocket.send(json.dumps({"command": "STOP"}))
    except ConnectionClosed as exc:
        disconnect_code = exc.code
        events.append(MetricEvent("ws_disconnect", 0.0, exc.code in (1000, 1001), detail=str(exc.code)))
    except Exception as exc:
        events.append(MetricEvent("ws_runtime", 0.0, False, detail=f"{type(exc).__name__}: {exc}"))

    return {
        "events": events,
        "messages": messages,
        "disconnect_code": disconnect_code,
        "acked": start_ack_ms is not None,
    }


async def run_ws_replay_scenario(base_url: str, users: list[dict[str, str]]) -> dict[str, Any]:
    started_at = datetime.now(timezone.utc).isoformat()
    ws_base_url = base_url.replace("http://", "ws://").replace("https://", "wss://")
    replay_date = await _resolve_replay_date(base_url)
    flows = await asyncio.gather(*[_ws_user_flow(ws_base_url, base_url, replay_date, user) for user in users])
    completed_at = datetime.now(timezone.utc).isoformat()

    events = [event for flow in flows for event in flow["events"]]
    disconnects = [flow["disconnect_code"] for flow in flows if flow["disconnect_code"] is not None]
    acked = sum(1 for flow in flows if flow["acked"])
    messages = [flow["messages"] for flow in flows]
    summary = summarize_scenario(
        scenario="ws_replay_usage",
        users=len(users),
        started_at=started_at,
        completed_at=completed_at,
        events=events,
        extra={
            "replay_date": replay_date,
            "acknowledged_sessions": acked,
            "unexpected_disconnects": sum(1 for code in disconnects if code not in (1000, 1001, None)),
            "disconnect_codes": disconnects[:20],
            "avg_messages_per_session": round(sum(messages) / len(messages), 2) if messages else 0.0,
        },
    )
    return {
        "summary": summary,
        "failures": [
            {"name": event.name, "status": event.status, "detail": event.detail}
            for event in events
            if not event.ok
        ][:20],
    }
