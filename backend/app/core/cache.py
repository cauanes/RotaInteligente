"""
Cache service com Redis + fallback para memória local.

Por que Redis?
  - Persistência entre restarts da API
  - Compartilhamento entre workers (gunicorn/uvicorn)
  - TTL nativo por chave

Se o Redis não estiver disponível (e.g. dev local sem Docker), o fallback
usa um dict em memória — funcional mas perde dados ao reiniciar.
"""

import hashlib
import json
import time
from functools import wraps
from typing import Any, Optional

from app.core.config import get_settings

settings = get_settings()


class CacheService:
    """Gerencia cache Redis com fallback em memória."""

    def __init__(self) -> None:
        self.redis_client = None
        # Fallback em memória: {key: (expire_timestamp, value)}
        self._local: dict[str, tuple[float, Any]] = {}

    # ── Lifecycle ────────────────────────────────────────────────────

    async def connect(self) -> None:
        """Tenta conectar ao Redis; falha silenciosamente para fallback local."""
        try:
            import redis.asyncio as aioredis

            self.redis_client = await aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            await self.redis_client.ping()
            print("✅ Redis conectado")
        except Exception as exc:
            print(f"⚠️  Redis indisponível ({exc}). Usando cache local.")
            self.redis_client = None

    async def close(self) -> None:
        if self.redis_client:
            await self.redis_client.close()

    async def is_connected(self) -> bool:
        if not self.redis_client:
            return False
        try:
            await self.redis_client.ping()
            return True
        except Exception:
            return False

    # ── CRUD ─────────────────────────────────────────────────────────

    async def get(self, key: str) -> Optional[Any]:
        try:
            if self.redis_client:
                raw = await self.redis_client.get(key)
                return json.loads(raw) if raw else None
            # Fallback local com TTL manual
            entry = self._local.get(key)
            if entry and entry[0] > time.time():
                return entry[1]
            # Expirado ou inexistente
            self._local.pop(key, None)
            return None
        except Exception:
            return None

    async def set(self, key: str, value: Any, ttl: int = settings.CACHE_TTL) -> None:
        try:
            serialized = json.dumps(value, default=str)
            if self.redis_client:
                await self.redis_client.setex(key, ttl, serialized)
            else:
                self._local[key] = (time.time() + ttl, json.loads(serialized))
        except Exception as exc:
            print(f"⚠️  Erro ao gravar cache: {exc}")

    async def delete(self, key: str) -> None:
        try:
            if self.redis_client:
                await self.redis_client.delete(key)
            else:
                self._local.pop(key, None)
        except Exception:
            pass

    # ── Helpers ──────────────────────────────────────────────────────

    @staticmethod
    def make_key(*args: Any, **kwargs: Any) -> str:
        """Gera hash MD5 determinístico a partir dos argumentos."""
        raw = str(args) + str(sorted(kwargs.items()))
        return hashlib.md5(raw.encode()).hexdigest()


# Singleton global
cache_service = CacheService()


# ── Decorator ────────────────────────────────────────────────────────

def cached(ttl: int = settings.CACHE_TTL):
    """Decorator que cacheia resultados de funções async."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__module__}.{func.__name__}:{cache_service.make_key(*args, **kwargs)}"
            hit = await cache_service.get(key)
            if hit is not None:
                return hit
            result = await func(*args, **kwargs)
            if result is not None:
                await cache_service.set(key, result, ttl)
            return result

        return wrapper

    return decorator
