import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.core.logging import logger

# Simple in-memory rate-limiter fallback when Redis is unreachable during local testing
_memory_rate_limit_store: dict[str, list[float]] = defaultdict(list)


def rate_limiter(requests_per_minute: int = 20, key_prefix: str = "rl") -> Callable:
    """FastAPI Rate Limiting Dependency with Redis support and in-memory fallback."""

    async def dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "127.0.0.1"
        key = f"{key_prefix}:{client_ip}"
        now = time.time()
        window_start = now - 60.0

        try:
            import redis.asyncio as aioredis

            r = aioredis.from_url(settings.REDIS_URL, socket_timeout=2)
            async with r:
                pipe = r.pipeline()
                pipe.zremrangebyscore(key, 0, window_start)
                pipe.zadd(key, {str(now): now})
                pipe.zcard(key)
                pipe.expire(key, 60)
                results = await pipe.execute()
                current_requests = results[2]
                if current_requests > requests_per_minute:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "code": "RATE_LIMIT_EXCEEDED",
                            "message": f"Too many requests. Limit is {requests_per_minute} per minute.",
                        },
                    )
                return
        except HTTPException:
            raise
        except Exception as e:
            logger.debug(f"Redis rate limiter fallback to in-memory: {e}")

        # In-memory fallback
        store = _memory_rate_limit_store[key]
        _memory_rate_limit_store[key] = [t for t in store if t > window_start]
        _memory_rate_limit_store[key].append(now)

        if len(_memory_rate_limit_store[key]) > requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Too many requests. Limit is {requests_per_minute} per minute.",
                },
            )

    return dependency
