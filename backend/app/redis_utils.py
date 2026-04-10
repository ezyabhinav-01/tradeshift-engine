import logging
import os

from redis import Redis


logger = logging.getLogger(__name__)


def get_redis_client(
    *,
    decode_responses: bool = True,
    log_prefix: str = "Redis",
    redis_url: str | None = None,
    redis_host: str | None = None,
    redis_port: int | None = None,
) -> Redis | None:
    redis_url = (redis_url if redis_url is not None else os.getenv("REDIS_URL", "")).strip()
    redis_host = (redis_host if redis_host is not None else os.getenv("REDIS_HOST", "")).strip()
    redis_port = redis_port if redis_port is not None else int(os.getenv("REDIS_PORT", "6379"))

    try:
        if redis_url:
            client = Redis.from_url(redis_url, decode_responses=decode_responses)
        else:
            host = redis_host or "localhost"
            client = Redis(host=host, port=redis_port, decode_responses=decode_responses)
        client.ping()
        return client
    except Exception as e:
        logger.warning(f"{log_prefix} unavailable: {e}. Continuing without cache.")
        return None
