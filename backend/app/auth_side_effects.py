from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Awaitable, Callable
from typing import Any


logger = logging.getLogger(__name__)

AUTH_SIDE_EFFECTS_ENABLED = os.getenv("AUTH_SIDE_EFFECTS_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
AUTH_AI_SIDE_EFFECTS_ENABLED = os.getenv("AUTH_AI_SIDE_EFFECTS_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}
AUTH_SIDE_EFFECT_QUEUE_SIZE = max(int(os.getenv("AUTH_SIDE_EFFECT_QUEUE_SIZE", "512")), 32)

_queue: asyncio.Queue[tuple[str, Callable[..., Awaitable[Any]], tuple[Any, ...], dict[str, Any]]] | None = None
_worker_task: asyncio.Task | None = None
_queue_loop: asyncio.AbstractEventLoop | None = None


def _ensure_queue() -> asyncio.Queue[tuple[str, Callable[..., Awaitable[Any]], tuple[Any, ...], dict[str, Any]]]:
    global _queue, _queue_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _queue is None or (current_loop is not None and _queue_loop is not current_loop):
        _queue = asyncio.Queue(maxsize=AUTH_SIDE_EFFECT_QUEUE_SIZE)
        _queue_loop = current_loop
    return _queue


async def start_auth_side_effect_worker() -> None:
    global _worker_task
    if not AUTH_SIDE_EFFECTS_ENABLED or _worker_task is not None:
        return

    queue = _ensure_queue()

    async def _runner() -> None:
        while True:
            name, fn, args, kwargs = await queue.get()
            try:
                await fn(*args, **kwargs)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # pragma: no cover - best effort side effect
                logger.warning("Auth side effect '%s' failed: %s", name, exc)
            finally:
                queue.task_done()

    _worker_task = asyncio.create_task(_runner(), name="auth-side-effects")


async def stop_auth_side_effect_worker() -> None:
    global _worker_task, _queue, _queue_loop
    if _worker_task is None:
        _queue = None
        _queue_loop = None
        return
    _worker_task.cancel()
    try:
        await _worker_task
    except asyncio.CancelledError:
        pass
    _worker_task = None
    _queue = None
    _queue_loop = None


def enqueue_auth_side_effect(
    name: str,
    fn: Callable[..., Awaitable[Any]],
    *args: Any,
    ai_related: bool = False,
    **kwargs: Any,
) -> bool:
    if not AUTH_SIDE_EFFECTS_ENABLED:
        return False
    if ai_related and not AUTH_AI_SIDE_EFFECTS_ENABLED:
        logger.info("Skipping auth AI side effect '%s' because AUTH_AI_SIDE_EFFECTS_ENABLED is false.", name)
        return False

    queue = _ensure_queue()
    try:
        queue.put_nowait((name, fn, args, kwargs))
        return True
    except asyncio.QueueFull:
        logger.warning("Dropping auth side effect '%s' because the queue is full.", name)
        return False
