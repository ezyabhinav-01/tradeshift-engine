import asyncio
from datetime import datetime, timezone
from typing import Any

import aiohttp

from common import MetricEvent, percentile, summarize_scenario, timed_request


async def _rest_user_flow(base_url: str, user: dict[str, str], user_idx: int) -> dict[str, Any]:
    events: list[MetricEvent] = []
    async with aiohttp.ClientSession(cookie_jar=aiohttp.CookieJar(unsafe=True)) as session:
        login_metric, _ = await timed_request(
            session,
            "POST",
            f"{base_url}/auth/login",
            name="auth_login",
            json_body={"email": user["email"], "password": user["password"]},
        )
        events.append(login_metric)
        if not login_metric.ok:
            return {"events": events}

        me_metric, _ = await timed_request(session, "GET", f"{base_url}/auth/me", name="auth_me")
        events.append(me_metric)

        symbol = "RELIANCE" if user_idx % 2 == 0 else "HDFCBANK"
        trade_metric, trade_body = await timed_request(
            session,
            "POST",
            f"{base_url}/api/trade/",
            name="trade_open",
            json_body={
                "symbol": symbol,
                "direction": "BUY",
                "quantity": 3 + (user_idx % 5),
                "price": 1200 + (user_idx % 7) * 10,
                "order_type": "MARKET",
                "session_type": "REPLAY",
            },
            timeout_seconds=30.0,
        )
        events.append(trade_metric)
        if not trade_metric.ok or not trade_body:
            return {"events": events}

        trade_id = int(trade_body["trade_id"])
        summary_open_metric, _ = await timed_request(
            session,
            "GET",
            f"{base_url}/api/portfolio/summary",
            name="portfolio_summary_open",
        )
        events.append(summary_open_metric)

        history_open_metric, _ = await timed_request(
            session,
            "GET",
            f"{base_url}/api/history/trades",
            name="history_trades_open",
            params={"include_children": "false"},
        )
        events.append(history_open_metric)

        close_metric, _ = await timed_request(
            session,
            "POST",
            f"{base_url}/api/trade/close/{trade_id}",
            name="trade_close",
            json_body={"exit_type": "MARKET", "exit_price": 1235 + (user_idx % 7) * 10, "session_type": "REPLAY"},
            timeout_seconds=30.0,
        )
        events.append(close_metric)

        summary_closed_metric, _ = await timed_request(
            session,
            "GET",
            f"{base_url}/api/portfolio/summary",
            name="portfolio_summary_closed",
        )
        events.append(summary_closed_metric)

        research_metric, _ = await timed_request(
            session,
            "GET",
            f"{base_url}/api/portfolio/research",
            name="portfolio_research",
        )
        events.append(research_metric)

    return {"events": events}


async def run_rest_scenario(base_url: str, users: list[dict[str, str]]) -> dict[str, Any]:
    started_at = datetime.now(timezone.utc).isoformat()
    flows = await asyncio.gather(
        *[_rest_user_flow(base_url, user, idx) for idx, user in enumerate(users, start=1)]
    )
    completed_at = datetime.now(timezone.utc).isoformat()

    events = [event for flow in flows for event in flow["events"]]
    by_name: dict[str, list[float]] = {}
    for event in events:
        by_name.setdefault(event.name, []).append(event.latency_ms)

    summary = summarize_scenario(
        scenario="rest_usage",
        users=len(users),
        started_at=started_at,
        completed_at=completed_at,
        events=events,
        extra={
            "per_request_p95_ms": {
                name: percentile(values, 0.95)
                for name, values in by_name.items()
            },
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
