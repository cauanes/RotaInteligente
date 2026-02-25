"""
Endpoints REST da API.

Endpoints:
  POST /routes                 — Inicia análise de rota (async, clima + trânsito)
  GET  /routes/{route_id}      — Consulta status/resultado
  GET  /traffic-history        — Histórico de trânsito com padrões por hora
  GET  /best-departure         — Predição do melhor horário de viagem
  GET  /holidays               — Próximos feriados com impacto no trânsito
  GET  /health                 — Health check
  GET  /metrics                — Métricas básicas

Todos os horários são em America/Sao_Paulo (BRT/BRST).
"""

import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from app.core.background import (
    RouteStatus,
    create_job,
    get_job,
)
from app.schemas import (
    BestDepartureResponse,
    Coordinates,
    HealthResponse,
    MetricsResponse,
    RouteCreateResponse,
    RouteRequest,
    RouteResultResponse,
    TrafficHistoryResponse,
)
from app.services.route_service import RouteService
from app.services.holiday_service import (
    get_historical_pattern,
    predict_best_departure,
    get_all_holidays,
    is_holiday_or_extended,
)
from app.core.cache import cache_service

BRT = ZoneInfo("America/Sao_Paulo")

router = APIRouter()
route_service = RouteService()

# ── Métricas simples in-memory ───────────────────────────────────
_metrics = {
    "requests_total": 0,
    "cache_hits": 0,
    "cache_misses": 0,
    "response_times": [],
}


# ═══════════════════════════════════════════════════════════════
# POST /routes — Cria análise de rota (background task)
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/routes",
    response_model=RouteCreateResponse,
    status_code=202,
    tags=["routes"],
    summary="Inicia análise de rota com previsão meteorológica e trânsito",
    description="""
    Recebe origem/destino (lat/lon), perfil de roteamento e parâmetros opcionais.
    Cria um job em background e retorna imediatamente um `route_id`.
    Use `GET /routes/{route_id}` para consultar o progresso/resultado.

    O horário de partida usa fuso America/Sao_Paulo.
    Se `departure_time` for omitido, usa agora (BRT).

    A análise inclui:
    - Cálculo da rota (ORS / OSRM)
    - Previsão meteorológica para cada ponto (Open-Meteo → OpenWeather → Mock)
    - Análise de trânsito em tempo real (TomTom → heurística)
    """,
)
async def create_route(
    request: RouteRequest,
    background_tasks: BackgroundTasks,
):
    _metrics["requests_total"] += 1
    start = time.time()

    # Garante que o horário está em BRT
    departure = request.departure_time
    if departure is None:
        departure = datetime.now(tz=BRT)
    elif departure.tzinfo is None:
        departure = departure.replace(tzinfo=BRT)

    route_id = create_job()
    background_tasks.add_task(
        route_service.compute_route_weather,
        route_id,
        request.origin,
        request.destination,
        departure,
        request.profile.value,
    )

    _metrics["response_times"].append(time.time() - start)

    return RouteCreateResponse(
        route_id=route_id,
        status=RouteStatus.PENDING,
    )


# ═══════════════════════════════════════════════════════════════
# GET /routes/{route_id} — Status e resultado
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/routes/{route_id}",
    response_model=RouteResultResponse,
    tags=["routes"],
    summary="Consulta status e resultado de análise de rota",
    responses={
        200: {"description": "Resultado da análise"},
        404: {"description": "Route ID não encontrado"},
    },
)
async def get_route(route_id: str):
    _metrics["requests_total"] += 1

    job = get_job(route_id)

    if not job:
        cached_job = await cache_service.get(f"route_job:{route_id}")
        if cached_job:
            job = cached_job
            _metrics["cache_hits"] += 1
        else:
            _metrics["cache_misses"] += 1

    if not job:
        raise HTTPException(404, detail=f"Route '{route_id}' não encontrada.")

    result = job.get("result") or {}

    return RouteResultResponse(
        route_id=route_id,
        status=job["status"],
        error=job.get("error"),
        route_geometry=result.get("route_geometry"),
        summary=result.get("summary"),
        samples=result.get("samples"),
        segments=result.get("segments"),
        traffic_summary=result.get("traffic_summary"),
        traffic_samples=result.get("traffic_samples"),
        created_at=job.get("created_at"),
    )


# ═══════════════════════════════════════════════════════════════
# GET /traffic-history — Histórico com padrões horários
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/traffic-history",
    response_model=TrafficHistoryResponse,
    tags=["traffic"],
    summary="Consulta padrão histórico de trânsito para localização e data",
    description="Retorna padrão horário de volume, horários de pico e tipo de dia.",
)
async def traffic_history(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    date: str = Query(..., pattern=r"\d{4}-\d{2}-\d{2}", description="YYYY-MM-DD"),
):
    _metrics["requests_total"] += 1
    target = datetime.strptime(date, "%Y-%m-%d").date()
    data = get_historical_pattern(lat, lon, target)
    return data


# ═══════════════════════════════════════════════════════════════
# GET /best-departure — Predição de melhor horário de viagem
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/best-departure",
    response_model=BestDepartureResponse,
    tags=["traffic"],
    summary="Predição do melhor horário de partida",
    description="""
    Analisa padrões históricos de trânsito para prever o melhor horário
    de viagem. Especialmente útil para feriados prolongados e períodos
    de alto fluxo intermunicipal/interestadual.

    Considera:
    - Padrões de dia útil, fim de semana, feriado
    - Feriados fixos e móveis (Carnaval, Páscoa, Corpus Christi)
    - Feriados prolongados (pontes)
    - Segurança (penaliza madrugada)
    """,
)
async def best_departure(
    origin_lat: float = Query(..., ge=-90, le=90, description="Latitude de origem"),
    origin_lon: float = Query(..., ge=-180, le=180, description="Longitude de origem"),
    dest_lat: float = Query(..., ge=-90, le=90, description="Latitude de destino"),
    dest_lon: float = Query(..., ge=-180, le=180, description="Longitude de destino"),
    date: str = Query(..., pattern=r"\d{4}-\d{2}-\d{2}", description="Data da viagem YYYY-MM-DD"),
    base_duration_min: float = Query(
        300, ge=30, le=1440,
        description="Duração base da viagem em minutos (sem trânsito)",
    ),
):
    _metrics["requests_total"] += 1
    travel_date = datetime.strptime(date, "%Y-%m-%d").date()
    result = predict_best_departure(
        origin_lat, origin_lon, dest_lat, dest_lon,
        travel_date, base_duration_min,
    )
    return result


# ═══════════════════════════════════════════════════════════════
# GET /holidays — Próximos feriados
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/holidays",
    tags=["traffic"],
    summary="Lista próximos feriados brasileiros com impacto no trânsito",
)
async def holidays(
    year: int = Query(default=None, description="Ano (padrão: ano atual)"),
):
    _metrics["requests_total"] += 1
    y = year or datetime.now(tz=BRT).year
    all_hols = get_all_holidays(y)
    result = []
    for d, name in sorted(all_hols.items()):
        weekday_name = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][d.weekday()]
        is_ext = is_holiday_or_extended(d)
        result.append({
            "date": d.isoformat(),
            "name": name,
            "weekday": weekday_name,
            "is_extended": is_ext,
            "expected_flow": "very_high" if is_ext else "high",
        })
    return {"year": y, "holidays": result, "total": len(result)}


# ═══════════════════════════════════════════════════════════════
# GET /health — Health check
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["infra"],
    summary="Verifica saúde da aplicação",
)
async def health():
    from app.core.config import get_settings
    s = get_settings()
    cache_status = "connected" if await cache_service.is_connected() else "local_fallback"

    return HealthResponse(
        status="healthy",
        version=s.APP_VERSION,
        cache=cache_status,
        timezone=s.TIMEZONE,
        apis={
            "openroute": "configured" if s.ORS_API_KEY else "missing_key",
            "openweather": "configured" if s.OPENWEATHER_API_KEY else "not_configured",
            "tomtom_traffic": "configured" if s.TOMTOM_API_KEY else "heuristic_fallback",
            "open_meteo": "available",
            "osrm_fallback": "available",
        },
    )


# ═══════════════════════════════════════════════════════════════
# GET /metrics — Métricas básicas
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/metrics",
    response_model=MetricsResponse,
    tags=["infra"],
    summary="Métricas da aplicação",
)
async def metrics():
    from app.core.background import _jobs

    times = _metrics["response_times"][-100:]
    avg_ms = (sum(times) / len(times) * 1000) if times else 0

    return MetricsResponse(
        requests_total=_metrics["requests_total"],
        cache_hits=_metrics["cache_hits"],
        cache_misses=_metrics["cache_misses"],
        avg_response_ms=round(avg_ms, 2),
        active_jobs=sum(
            1 for j in _jobs.values()
            if j["status"] in (RouteStatus.PENDING, RouteStatus.PROCESSING)
        ),
    )
