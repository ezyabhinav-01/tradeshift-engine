import hashlib
import logging
from datetime import date, datetime, time, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

import pandas as pd
from sqlalchemy import delete, select, text

from app.database import connect_to_database_sync, get_session
from app.models import NewsCanonical, ReplayNewsEvent
from app.news_service import get_news

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")
MARKET_OPEN = time(9, 15, 0)
MARKET_CLOSE = time(15, 30, 0)
DEFAULT_DELAY_SECONDS = 45 * 60
DEFAULT_POLICY = "STRICT_SESSION"


def _to_aware_utc(ts_val: Any) -> Optional[datetime]:
    if ts_val is None:
        return None

    if isinstance(ts_val, datetime):
        dt = ts_val
    else:
        s = str(ts_val).strip()
        if not s:
            return None
        try:
            dt = pd.to_datetime(s, utc=True).to_pydatetime()
        except Exception:
            return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None)


def _session_second(ist_dt: datetime) -> Optional[int]:
    open_dt = datetime.combine(ist_dt.date(), MARKET_OPEN)
    close_dt = datetime.combine(ist_dt.date(), MARKET_CLOSE)
    if ist_dt < open_dt or ist_dt > close_dt:
        return None
    return int((ist_dt - open_dt).total_seconds())


def _source_reliability(source: str) -> float:
    s = (source or "").lower()
    if "reuters" in s or "bloomberg" in s:
        return 0.95
    if "economic times" in s or "moneycontrol" in s or "mint" in s:
        return 0.9
    if "newsapi" in s:
        return 0.8
    return 0.75


def _event_key(trading_date: date, canonical_id: int, delay_seconds: int, policy: str, symbol_scope: str) -> str:
    key = f"{trading_date.isoformat()}|{canonical_id}|{delay_seconds}|{policy}|{symbol_scope}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


async def ingest_news_snapshot_for_date(trading_date: date, limit: int = 120) -> dict[str, int]:
    """
    Pull provider news and persist normalized canonical rows.
    Then materialize replay events for the target trading date using publish+delay.
    """
    raw_items = await get_news("all", limit)
    if not raw_items:
        return {"raw": 0, "canonical_upserts": 0, "events": 0}

    canonical_upserts = 0
    async with await get_session() as db:
        for item in raw_items:
            title = (item.get("title") or "").strip()
            url = (item.get("url") or "").strip()
            if not title or not url:
                continue

            published_utc_aware = _to_aware_utc(item.get("publishedAt"))
            if not published_utc_aware:
                continue

            published_ist_aware = published_utc_aware.astimezone(IST)
            published_utc = _naive(published_utc_aware)
            published_ist = _naive(published_ist_aware)
            source_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()

            existing = await db.execute(
                select(NewsCanonical).where(NewsCanonical.source_url_hash == source_hash)
            )
            row = existing.scalars().first()

            payload = {
                "source": (item.get("source") or "Unknown")[:120],
                "source_url": url,
                "source_url_hash": source_hash,
                "title": title,
                "description": item.get("description"),
                "category": item.get("category"),
                "image_url": item.get("imageUrl"),
                "reliability_score": _source_reliability(item.get("source") or ""),
                "published_at_utc": published_utc,
                "published_at_ist": published_ist,
                # Pin canonical rows to the replay trading day snapshot so
                # retention stays aligned with the rolling market window.
                "trading_date_ist": trading_date,
                "session_second": _session_second(published_ist),
            }

            if row:
                for k, v in payload.items():
                    setattr(row, k, v)
            else:
                db.add(NewsCanonical(**payload))

            canonical_upserts += 1

        await db.commit()

        events_count = await materialize_replay_events_for_date(
            db,
            trading_date=trading_date,
            delay_seconds=DEFAULT_DELAY_SECONDS,
            replay_policy=DEFAULT_POLICY,
            symbol_scope="ALL",
        )

    return {
        "raw": len(raw_items),
        "canonical_upserts": canonical_upserts,
        "events": events_count,
    }


async def materialize_replay_events_for_date(
    db,
    trading_date: date,
    delay_seconds: int = DEFAULT_DELAY_SECONDS,
    replay_policy: str = DEFAULT_POLICY,
    symbol_scope: str = "ALL",
) -> int:
    """
    Build deterministic replay events: flash_time = publish_time + delay.
    If target date has no canonical records, fallback to latest available canonical pool.
    """
    await db.execute(
        delete(ReplayNewsEvent).where(
            ReplayNewsEvent.trading_date_ist == trading_date,
            ReplayNewsEvent.delay_seconds == delay_seconds,
            ReplayNewsEvent.replay_policy == replay_policy,
            ReplayNewsEvent.symbol_scope == symbol_scope,
        )
    )

    result = await db.execute(
        select(NewsCanonical)
        .where(NewsCanonical.trading_date_ist == trading_date)
        .order_by(NewsCanonical.published_at_ist.asc())
        .limit(250)
    )
    canon_rows = list(result.scalars().all())

    # Fallback for days where snapshot wasn't collected in time: use latest canonical pool.
    if not canon_rows:
        fallback = await db.execute(
            select(NewsCanonical)
            .order_by(NewsCanonical.published_at_ist.desc())
            .limit(120)
        )
        canon_rows = list(reversed(fallback.scalars().all()))

    if not canon_rows:
        await db.commit()
        return 0

    open_dt = datetime.combine(trading_date, MARKET_OPEN)
    close_dt = datetime.combine(trading_date, MARKET_CLOSE)

    inserts: list[ReplayNewsEvent] = []
    for row in canon_rows:
        publish_time_ist = datetime.combine(trading_date, row.published_at_ist.time())
        flash_time_ist = publish_time_ist + timedelta(seconds=delay_seconds)

        # Keep strict market feeling unless policy changes.
        if replay_policy == "STRICT_SESSION" and not (open_dt <= flash_time_ist <= close_dt):
            continue

        inserts.append(
            ReplayNewsEvent(
                event_key=_event_key(trading_date, row.id, delay_seconds, replay_policy, symbol_scope),
                trading_date_ist=trading_date,
                symbol_scope=symbol_scope,
                source=row.source,
                title=row.title,
                description=row.description,
                source_url=row.source_url,
                image_url=row.image_url,
                category=row.category,
                publish_time_ist=publish_time_ist,
                flash_time_ist=flash_time_ist,
                delay_seconds=delay_seconds,
                event_priority=0,
                source_reliability=row.reliability_score,
                replay_policy=replay_policy,
            )
        )

    if inserts:
        db.add_all(inserts)

    await db.commit()
    return len(inserts)


async def get_replay_news_schedule(
    symbol: str,
    target_date: str,
    delay_seconds: int = DEFAULT_DELAY_SECONDS,
    replay_policy: str = DEFAULT_POLICY,
) -> list[dict]:
    """
    Deterministic schedule consumed by replay websocket loop.
    All timestamps returned as naive IST datetimes for direct comparison with replay clock.
    """
    trading_date = datetime.strptime(target_date, "%Y-%m-%d").date()
    symbol_scope = "ALL"

    async with await get_session() as db:
        stmt = (
            select(ReplayNewsEvent)
            .where(
                ReplayNewsEvent.trading_date_ist == trading_date,
                ReplayNewsEvent.delay_seconds == delay_seconds,
                ReplayNewsEvent.replay_policy == replay_policy,
                ReplayNewsEvent.symbol_scope.in_([symbol_scope, symbol.upper()]),
            )
            .order_by(ReplayNewsEvent.flash_time_ist.asc())
            .limit(400)
        )
        res = await db.execute(stmt)
        rows = list(res.scalars().all())

        if not rows:
            # Try snapshot + materialization when first replay of the day happens.
            await ingest_news_snapshot_for_date(trading_date)

            # Rebuild with requested delay/policy if they differ from defaults.
            if delay_seconds != DEFAULT_DELAY_SECONDS or replay_policy != DEFAULT_POLICY:
                await materialize_replay_events_for_date(
                    db,
                    trading_date=trading_date,
                    delay_seconds=delay_seconds,
                    replay_policy=replay_policy,
                    symbol_scope=symbol_scope,
                )

            res = await db.execute(stmt)
            rows = list(res.scalars().all())

    schedule = []
    for row in rows:
        flash_ts = row.flash_time_ist
        schedule.append(
            {
                "event_id": row.event_key,
                "symbol": symbol,
                "title": row.title,
                "description": row.description or "",
                "timestamp": flash_ts,
                "time_str": flash_ts.strftime("%H:%M:%S"),
                "source": row.source,
                "url": row.source_url,
                "imageUrl": row.image_url,
                "is_simulated": True,
                "publish_time_ist": row.publish_time_ist.strftime("%Y-%m-%d %H:%M:%S"),
                "flash_time_ist": row.flash_time_ist.strftime("%Y-%m-%d %H:%M:%S"),
                "delay_seconds": row.delay_seconds,
                "source_reliability": row.source_reliability,
            }
        )

    return schedule


def prune_news_parallel_with_market_window_sync(keep_trading_days: int = 7) -> dict[str, int]:
    """
    Keep replay news strictly aligned to latest market trading window.
    When oldest market day is removed, oldest news day is removed in parallel.
    """
    engine = connect_to_database_sync()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT DISTINCT DATE(timestamp) AS d
                FROM market_candles
                ORDER BY d DESC
                LIMIT :limit
                """
            ),
            {"limit": keep_trading_days},
        ).fetchall()

        keep_dates = {r[0] for r in rows if r and r[0] is not None}
        if not keep_dates:
            return {"canonical_deleted": 0, "events_deleted": 0}

        # Delete replay events first, then canonical rows.
        del_events = conn.execute(
            delete(ReplayNewsEvent).where(~ReplayNewsEvent.trading_date_ist.in_(keep_dates))
        )

        del_canonical = conn.execute(
            delete(NewsCanonical).where(~NewsCanonical.trading_date_ist.in_(keep_dates))
        )

        conn.commit()

        return {
            "canonical_deleted": getattr(del_canonical, "rowcount", 0) or 0,
            "events_deleted": getattr(del_events, "rowcount", 0) or 0,
        }
