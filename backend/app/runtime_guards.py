from __future__ import annotations

import os
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Deque, Dict, Iterable, List

try:
    import fcntl
except Exception:  # pragma: no cover - Windows fallback
    fcntl = None


def parse_cors_origins(raw: str | None, default_origins: Iterable[str]) -> List[str]:
    if not raw:
        return list(default_origins)
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or list(default_origins)


def should_record_activity(
    cache: Dict[str, float],
    user_key: str,
    now_monotonic: float,
    min_interval_seconds: int,
    max_entries: int = 5000,
) -> bool:
    if min_interval_seconds <= 0:
        cache[user_key] = now_monotonic
        return True

    previous = cache.get(user_key)
    if previous is not None and (now_monotonic - previous) < min_interval_seconds:
        return False

    cache[user_key] = now_monotonic

    if len(cache) > max_entries:
        # Keep the most recent ~90% to avoid unbounded growth.
        to_drop = sorted(cache.items(), key=lambda item: item[1])[: max_entries // 10]
        for key, _ in to_drop:
            cache.pop(key, None)

    return True


class TTLCache:
    """
    Small thread-safe in-memory TTL cache for auth/replay hot paths.
    """

    def __init__(self, ttl_seconds: float, max_entries: int = 5000):
        self._ttl_seconds = max(float(ttl_seconds), 0.1)
        self._max_entries = max(int(max_entries), 1)
        self._values: Dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            item = self._values.get(key)
            if item is None:
                return None
            expires_at, value = item
            if expires_at <= time.monotonic():
                self._values.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        expires_at = time.monotonic() + (self._ttl_seconds if ttl_seconds is None else max(float(ttl_seconds), 0.1))
        with self._lock:
            self._values[key] = (expires_at, value)
            self._prune_locked()

    def pop(self, key: str) -> Any | None:
        with self._lock:
            item = self._values.pop(key, None)
            return item[1] if item else None

    def clear(self) -> None:
        with self._lock:
            self._values.clear()

    def _prune_locked(self, now: float | None = None) -> None:
        current = now if now is not None else time.monotonic()
        expired = [key for key, (expires_at, _) in self._values.items() if expires_at <= current]
        for key in expired:
            self._values.pop(key, None)

        if len(self._values) <= self._max_entries:
            return

        overflow = len(self._values) - self._max_entries
        oldest = sorted(self._values.items(), key=lambda item: item[1][0])[:overflow]
        for key, _ in oldest:
            self._values.pop(key, None)


@dataclass
class RollingSuccessSnapshot:
    attempts: int
    successes: int

    @property
    def success_ratio(self) -> float:
        if self.attempts <= 0:
            return 1.0
        return self.successes / self.attempts


class RollingSuccessTracker:
    """
    Tracks a rolling success ratio over the most recent N attempts.
    """

    def __init__(self, window_size: int = 200):
        self._window_size = max(int(window_size), 1)
        self._events: Deque[bool] = deque(maxlen=self._window_size)
        self._lock = threading.Lock()

    def record(self, success: bool) -> RollingSuccessSnapshot:
        with self._lock:
            self._events.append(bool(success))
            attempts = len(self._events)
            successes = sum(1 for event in self._events if event)
            return RollingSuccessSnapshot(attempts=attempts, successes=successes)

    def snapshot(self) -> RollingSuccessSnapshot:
        with self._lock:
            attempts = len(self._events)
            successes = sum(1 for event in self._events if event)
            return RollingSuccessSnapshot(attempts=attempts, successes=successes)


import tempfile

class ProcessFileLock:
    """
    Lightweight process-level lock for single-instance scheduler jobs.
    Uses non-blocking file locks so duplicate runners skip immediately.
    """

    def __init__(self, name: str, lock_dir: str = os.path.join(tempfile.gettempdir(), "tradeshift_engine_locks")):
        safe_name = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in name)
        self._path = os.path.join(lock_dir, f"{safe_name}.lock")
        self._fd: int | None = None
        self._lock_dir = lock_dir

    def acquire(self) -> bool:
        if fcntl is None:
            # If platform lock support is unavailable, avoid hard-failing job flow.
            return True
        os.makedirs(self._lock_dir, exist_ok=True)
        fd = os.open(self._path, os.O_CREAT | os.O_RDWR, 0o644)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self._fd = fd
            return True
        except OSError:
            os.close(fd)
            return False

    def release(self) -> None:
        if self._fd is None:
            return
        if fcntl is not None:
            try:
                fcntl.flock(self._fd, fcntl.LOCK_UN)
            except OSError:
                pass
        os.close(self._fd)
        self._fd = None
