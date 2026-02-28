"""
Schemas Pydantic para toda a API.

Definem os contratos de request/response e são usados na geração
automática da documentação OpenAPI (Swagger / ReDoc).
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════════════════

class RainRisk(str, Enum):
    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class CongestionLevel(str, Enum):
    FREE = "free"
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"
    SEVERE = "severe"


class RouteProfile(str, Enum):
    DRIVING_CAR = "driving-car"
    DRIVING_HGV = "driving-hgv"
    CYCLING = "cycling-regular"
    WALKING = "foot-walking"


class RouteStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ═══════════════════════════════════════════════════════════════
# Modelos base
# ═══════════════════════════════════════════════════════════════

class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")


class TollPoint(BaseModel):
    """Ponto de pedágio identificado via OpenStreetMap."""
    lat: float
    lon: float
    name: str = "Pedágio"
    operator: str = ""


class AccidentPoint(BaseModel):
    """Acidente ou incidente de trânsito em tempo real (TomTom Incidents)."""
    lat: float
    lon: float
    type: str = "Acidente"
    severity: str = "unknown"   # minor / moderate / major / severe
    description: str = ""
    delay_minutes: float = 0.0


class CongestionSegment(BaseModel):
    """Segmento da rota com nível de congestionamento para coloração no mapa."""
    coordinates: list[list[float]] = Field(
        ..., description="Lista de [lon, lat] do segmento (formato GeoJSON)"
    )
    congestion_level: CongestionLevel = CongestionLevel.FREE
    congestion_ratio: float = Field(0.0, ge=0, le=1)
    avg_speed_kmh: float = 60.0
    color: str = "#16a34a"  # hex color for frontend convenience


class TrafficLightPoint(BaseModel):
    """Semáforo identificado via OpenStreetMap (Overpass API)."""
    lat: float
    lon: float
    osm_id: int = 0
    name: str = ""
    # Ciclo simulado (em segundos)
    green_duration: int = 30
    yellow_duration: int = 3
    red_duration: int = 20


# ═══════════════════════════════════════════════════════════════
# Route — Request / Response
# ═══════════════════════════════════════════════════════════════

class RouteRequest(BaseModel):
    """POST /routes — corpo da requisição."""

    origin: Coordinates = Field(..., description="Coordenadas de origem")
    destination: Coordinates = Field(..., description="Coordenadas de destino")
    departure_time: Optional[datetime] = Field(
        default=None,
        description="Horário de partida (ISO 8601, fuso America/Sao_Paulo). Se omitido, usa agora.",
    )
    profile: RouteProfile = Field(
        default=RouteProfile.DRIVING_CAR,
        description="Perfil de roteamento",
    )
    avoid: list[str] = Field(
        default_factory=list,
        description="Features a evitar (ex: ['tollways', 'ferries'])",
    )

    model_config = {"json_schema_extra": {
        "examples": [{
            "origin": {"lat": -23.5505, "lon": -46.6333},
            "destination": {"lat": -22.9068, "lon": -43.1729},
            "departure_time": "2026-02-20T08:00:00-03:00",
            "profile": "driving-car",
            "avoid": [],
        }]
    }}


class WeatherSample(BaseModel):
    """Um ponto amostrado com dados meteorológicos ao longo da rota."""

    lat: float
    lon: float
    timestamp: datetime = Field(..., description="ETA estimada neste ponto (BRT)")
    precip_mm: float = Field(0.0, ge=0, description="Precipitação em mm")
    precip_prob: int = Field(0, ge=0, le=100, description="Probabilidade de chuva (%)")
    temperature_c: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    humidity_percent: Optional[int] = None
    visibility_m: Optional[int] = None
    fog_risk: str = "none"         # none / low / moderate / high
    rain_risk: RainRisk = RainRisk.NONE
    source: str = Field("open-meteo", description="Provedor de dados")
    description: str = ""


class TrafficSample(BaseModel):
    """Dados de trânsito para um ponto da rota."""

    lat: float
    lon: float
    eta: str
    current_speed_kmh: float
    free_flow_speed_kmh: float
    congestion_ratio: float = Field(0.0, ge=0, le=1, description="0=livre, 1=parado")
    congestion_level: CongestionLevel = CongestionLevel.FREE
    delay_minutes: float = 0.0
    source: str = "heuristic"


class TrafficSummary(BaseModel):
    """Resumo de trânsito para toda a rota."""

    avg_speed_kmh: float
    avg_congestion_ratio: float
    overall_congestion: CongestionLevel = CongestionLevel.FREE
    total_delay_minutes: float = 0.0
    samples_count: int = 0


class RouteSegment(BaseModel):
    """Segmento contíguo da rota com mesmo nível de risco."""

    start: Coordinates
    end: Coordinates
    has_rain: bool
    rain_risk: RainRisk
    point_count: int


class RouteSummary(BaseModel):
    distance_km: float
    duration_minutes: float
    total_samples: int
    rain_samples: int
    overall_risk: RainRisk
    recommendation: str
    confidence: float = Field(
        ..., ge=0, le=1, description="Confiança dos dados (0-1)"
    )
    sources: list[str] = Field(default_factory=list)
    fog_risk: str = "none"                      # none / low / moderate / high
    traffic_lights_delay_minutes: float = 0.0   # atraso estimado em semáforos


class RouteCreateResponse(BaseModel):
    """Resposta imediata do POST /routes (job criado)."""

    route_id: str
    status: RouteStatus = RouteStatus.PENDING
    message: str = "Route analysis started. Poll GET /routes/{route_id} for results."


class RouteResultResponse(BaseModel):
    """GET /routes/{route_id} — resultado completo."""

    route_id: str
    status: RouteStatus
    error: Optional[str] = None
    route_geometry: Optional[dict[str, Any]] = Field(
        None, description="GeoJSON LineString da rota"
    )
    summary: Optional[RouteSummary] = None
    samples: Optional[list[WeatherSample]] = None
    segments: Optional[list[RouteSegment]] = None
    traffic_summary: Optional[TrafficSummary] = None
    traffic_samples: Optional[list[TrafficSample]] = None
    toll_points: Optional[list[TollPoint]] = None
    accident_points: Optional[list[AccidentPoint]] = None
    congestion_segments: Optional[list[CongestionSegment]] = None
    traffic_light_points: Optional[list[TrafficLightPoint]] = None
    created_at: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# Traffic History
# ═══════════════════════════════════════════════════════════════

class TrafficHistoryResponse(BaseModel):
    location: Coordinates
    date: str
    day_type: str = "dia útil"
    is_holiday: bool
    holiday_name: Optional[str] = None
    is_extended_holiday: bool = False
    hourly_pattern: Optional[dict[str, float]] = None
    peak_hours: list[str]
    quiet_hours: list[str] = Field(default_factory=list)
    avg_speed_kmh: float = 0.0
    congestion_level: str = "unknown"
    data_source: str = "historical_model"


# ═══════════════════════════════════════════════════════════════
# Best Departure Prediction
# ═══════════════════════════════════════════════════════════════

class BestDepartureHour(BaseModel):
    departure_hour: int
    departure_label: str
    score: float
    avg_flow_ratio: float
    estimated_extra_delay_min: int
    estimated_total_min: int
    estimated_arrival: str
    safety: str = "ok"


class UpcomingHoliday(BaseModel):
    date: str
    name: str
    weekday: str
    is_extended: bool
    expected_flow: str


class BestDepartureResponse(BaseModel):
    date: str
    day_type: str
    is_holiday: bool
    holiday_name: Optional[str] = None
    is_extended_holiday: bool = False
    base_duration_minutes: int
    best_departures: list[BestDepartureHour]
    worst_departures: list[BestDepartureHour]
    all_hours: list[BestDepartureHour]
    recommendation: str
    upcoming_holidays: list[UpcomingHoliday]


# ═══════════════════════════════════════════════════════════════
# Health / Metrics
# ═══════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    status: str
    version: str
    cache: str
    timezone: str = "America/Sao_Paulo"
    apis: dict[str, str]


class MetricsResponse(BaseModel):
    requests_total: int
    cache_hits: int
    cache_misses: int
    avg_response_ms: float
    active_jobs: int
