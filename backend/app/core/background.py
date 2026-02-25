"""
Background tasks para recomputar previsões pesadas.

Versão atual: FastAPI BackgroundTasks (simples, sem infra extra).

═══════════════════════════════════════════════════════════════
MIGRAÇÃO PARA CELERY (quando necessário em produção):

1. Instalar: pip install celery[redis]

2. Criar app/core/celery_app.py:
   ```python
   from celery import Celery
   celery = Celery("weather_route", broker="redis://localhost:6379/1")
   celery.conf.task_serializer = "json"
   ```

3. Converter as funções abaixo em tasks Celery:
   ```python
   @celery.task(bind=True, max_retries=3)
   def compute_route_weather_task(self, route_id: str, params: dict):
       ...  # mesma lógica, mas sync (usar httpx sync ou requests)
   ```

4. No endpoint POST /routes, trocar:
   ```python
   # DE:
   background_tasks.add_task(compute_weather, route_id, ...)
   # PARA:
   compute_route_weather_task.delay(route_id, ...)
   ```

5. Rodar worker: celery -A app.core.celery_app worker --loglevel=info

Tradeoffs:
  - BackgroundTasks: zero infra extra, roda na mesma process → bom para dev/MVP
  - Celery: workers separados, retry built-in, rate limiting, monitoramento
    (Flower) → necessário em produção com alto tráfego
═══════════════════════════════════════════════════════════════
"""

import asyncio
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from zoneinfo import ZoneInfo

from app.core.cache import cache_service

BRT = ZoneInfo("America/Sao_Paulo")


class RouteStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ── Armazenamento in-memory de jobs (em produção usar Redis) ─────

_jobs: dict[str, dict[str, Any]] = {}


def create_job() -> str:
    """Cria um job e retorna seu ID (UUID4)."""
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": RouteStatus.PENDING,
        "created_at": datetime.now(tz=BRT).isoformat(),
        "result": None,
        "error": None,
    }
    return job_id


def get_job(job_id: str) -> dict[str, Any] | None:
    return _jobs.get(job_id)


def update_job(job_id: str, **kwargs: Any) -> None:
    if job_id in _jobs:
        _jobs[job_id].update(kwargs)


async def persist_job_to_cache(job_id: str) -> None:
    """Salva o resultado do job no Redis (se disponível)."""
    job = _jobs.get(job_id)
    if job:
        await cache_service.set(f"route_job:{job_id}", job, ttl=7200)
