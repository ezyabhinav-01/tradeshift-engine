from __future__ import annotations

import datetime as dt
import hashlib
import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Iterable

import pandas as pd
from redis import Redis


logger = logging.getLogger(__name__)


REPLAY_CACHE_VERSION = os.getenv("REPLAY_CACHE_VERSION", "v1")
REPLAY_CANDLE_CACHE_TTL_SECONDS = max(int(os.getenv("REPLAY_CANDLE_CACHE_TTL_SECONDS", "86400")), 60)
REPLAY_TICK_CACHE_TTL_SECONDS = max(int(os.getenv("REPLAY_TICK_CACHE_TTL_SECONDS", "21600")), 60)
REPLAY_META_CACHE_TTL_SECONDS = max(int(os.getenv("REPLAY_META_CACHE_TTL_SECONDS", "3600")), 60)


@dataclass(frozen=True)
class ReplayCacheKeys:
    symbol: str
    date: str
    version: str = REPLAY_CACHE_VERSION

    @property
    def candles(self) -> str:
        return f"replay:candles:{self.symbol}:{self.date}:1m"

    @property
    def ticks(self) -> str:
        return f"replay:ticks:{self.symbol}:{self.date}:{self.version}"

    @property
    def meta(self) -> str:
        return f"replay:meta:{self.symbol}:{self.date}:{self.version}"


def stable_seed(*parts: Any) -> int:
    raw = "|".join(str(part) for part in parts)
    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big", signed=False) % (2**32)


def canonical_timestamp(value: Any) -> str:
    ts = pd.to_datetime(value)
    if getattr(ts, "tzinfo", None) is not None:
        ts = ts.tz_convert(None)
    return ts.isoformat()


def epoch_ms(value: Any) -> int:
    ts = pd.to_datetime(value)
    if getattr(ts, "tzinfo", None) is None:
        ts = ts.tz_localize("UTC")
    return int(ts.timestamp() * 1000)


def normalize_candle_record(record: dict[str, Any]) -> dict[str, Any]:
    ts_value = record.get("datetime") or record.get("date") or record.get("time")
    return {
        "datetime": canonical_timestamp(ts_value),
        "open": float(record.get("open", 0) or 0),
        "high": float(record.get("high", 0) or 0),
        "low": float(record.get("low", 0) or 0),
        "close": float(record.get("close", 0) or 0),
        "volume": float(record.get("volume", 0) or 0),
    }


def normalize_candle_records(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [normalize_candle_record(record) for record in records]


def compact_tick(ts_ms: int, price: float, volume: float | int = 0) -> list[float | int]:
    return [int(ts_ms), round(float(price), 2), int(volume or 0)]


def expand_compact_tick(symbol: str, tick: list[float | int]) -> dict[str, Any]:
    ts_ms, price, volume = tick
    timestamp = dt.datetime.fromtimestamp(int(ts_ms) / 1000, dt.timezone.utc).replace(tzinfo=None).isoformat() + "Z"
    return {
        "symbol": symbol,
        "price": round(float(price), 2),
        "timestamp": timestamp,
        "volume": int(volume or 0),
    }


class ReplayRedisCache:
    def __init__(self, redis_client: Redis | None):
        self.redis = redis_client

    @property
    def available(self) -> bool:
        return self.redis is not None

    def get_candles(self, symbol: str, date: str) -> list[dict[str, Any]] | None:
        if not self.redis:
            return None
        key = ReplayCacheKeys(symbol, date).candles
        try:
            raw = self.redis.get(key)
            if not raw:
                return None
            payload = json.loads(raw)
            candles = payload.get("candles", payload)
            if isinstance(candles, list):
                logger.info("⚡ Replay candle cache hit: %s (%s rows)", key, len(candles))
                return candles
        except Exception as exc:
            logger.warning("⚠️ Replay candle cache read failed for %s/%s: %s", symbol, date, exc)
        return None

    def set_candles(self, symbol: str, date: str, candles: list[dict[str, Any]], source: str) -> None:
        if not self.redis or not candles:
            return
        keyset = ReplayCacheKeys(symbol, date)
        try:
            normalized = normalize_candle_records(candles)
            self.redis.setex(
                keyset.candles,
                REPLAY_CANDLE_CACHE_TTL_SECONDS,
                json.dumps(
                    {
                        "symbol": symbol,
                        "date": date,
                        "timeframe": "1m",
                        "source": source,
                        "rows": len(normalized),
                        "candles": normalized,
                    },
                    separators=(",", ":"),
                ),
            )
            self.redis.hset(
                keyset.meta,
                mapping={
                    "symbol": symbol,
                    "date": date,
                    "version": keyset.version,
                    "candle_rows": len(normalized),
                    "source": source,
                    "first_ts": normalized[0]["datetime"],
                    "last_ts": normalized[-1]["datetime"],
                },
            )
            self.redis.expire(keyset.meta, REPLAY_META_CACHE_TTL_SECONDS)
        except Exception as exc:
            logger.warning("⚠️ Replay candle cache write failed for %s/%s: %s", symbol, date, exc)

    def get_ticks(self, symbol: str, date: str) -> list[list[float | int]] | None:
        if not self.redis:
            return None
        key = ReplayCacheKeys(symbol, date).ticks
        try:
            raw = self.redis.get(key)
            if not raw:
                return None
            payload = json.loads(raw)
            ticks = payload.get("ticks", payload)
            if isinstance(ticks, list):
                logger.info("⚡ Replay tick cache hit: %s (%s ticks)", key, len(ticks))
                return ticks
        except Exception as exc:
            logger.warning("⚠️ Replay tick cache read failed for %s/%s: %s", symbol, date, exc)
        return None

    def set_ticks(
        self,
        symbol: str,
        date: str,
        ticks: list[list[float | int]],
        *,
        candle_rows: int,
        seed: int,
    ) -> None:
        if not self.redis or not ticks:
            return
        keyset = ReplayCacheKeys(symbol, date)
        try:
            self.redis.setex(
                keyset.ticks,
                REPLAY_TICK_CACHE_TTL_SECONDS,
                json.dumps(
                    {
                        "symbol": symbol,
                        "date": date,
                        "version": keyset.version,
                        "seed": seed,
                        "rows": len(ticks),
                        "ticks": ticks,
                    },
                    separators=(",", ":"),
                ),
            )
            self.redis.hset(
                keyset.meta,
                mapping={
                    "symbol": symbol,
                    "date": date,
                    "version": keyset.version,
                    "tick_rows": len(ticks),
                    "candle_rows": candle_rows,
                    "seed": seed,
                    "first_tick_ms": ticks[0][0],
                    "last_tick_ms": ticks[-1][0],
                },
            )
            self.redis.expire(keyset.meta, REPLAY_META_CACHE_TTL_SECONDS)
        except Exception as exc:
            logger.warning("⚠️ Replay tick cache write failed for %s/%s: %s", symbol, date, exc)
