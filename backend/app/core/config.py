"""
Configuração centralizada via Pydantic Settings.

Todas as variáveis sensíveis são lidas de variáveis de ambiente ou de um
arquivo .env na raiz do backend.  Nunca commite o .env real — use .env.example
como template.

Por que pydantic-settings?
  - Validação automática de tipos (int, bool, listas, etc.)
  - Suporte nativo a .env files
  - Singleton via lru_cache → instância única em toda a aplicação
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configurações da aplicação — carregar do .env ou variáveis de ambiente."""

    # ── App ──────────────────────────────────────────────────────────
    APP_NAME: str = "Weather Route Planner API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # ── API Keys ─────────────────────────────────────────────────────
    ORS_API_KEY: str = ""                # OpenRouteService (obrigatório para rotas reais)
    OPENWEATHER_API_KEY: str = ""        # Opcional — fallback para Open-Meteo gratuito

    # ── CORS ─────────────────────────────────────────────────────────
    CORS_ORIGINS: str = (
        "http://localhost:5173,"
        "http://localhost:3000,"
        "http://127.0.0.1:5173,"
        "http://127.0.0.1:3000"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Converte a string separada por vírgulas em uma lista."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ── Redis / Cache ────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 3600          # TTL padrão em segundos (1 h)
    CACHE_WEATHER_TTL: int = 1800  # TTL para dados meteo (30 min)
    CACHE_ROUTE_TTL: int = 7200    # TTL para rotas (2 h)

    # ── Rate-Limiting ────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    # ── URLs externas ────────────────────────────────────────────────
    OPENMETEO_BASE_URL: str = "https://api.open-meteo.com"
    OPENWEATHER_BASE_URL: str = "https://api.openweathermap.org"
    ORS_BASE_URL: str = "https://api.openrouteservice.org"
    OSRM_BASE_URL: str = "https://router.project-osrm.org"
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    TOMTOM_BASE_URL: str = "https://api.tomtom.com"
    TOMTOM_API_KEY: str = ""             # TomTom Traffic (gratuito, 2500 req/dia)

    # ── Timezone ─────────────────────────────────────────────────────
    TIMEZONE: str = "America/Sao_Paulo"

    # ── Timeouts ─────────────────────────────────────────────────────
    HTTP_TIMEOUT: int = 30

    # ── Routing defaults ─────────────────────────────────────────────
    MAX_ROUTE_POINTS: int = 50
    MIN_DISTANCE_KM: float = 10.0

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Retorna singleton de Settings (cacheado por lru_cache)."""
    return Settings()
