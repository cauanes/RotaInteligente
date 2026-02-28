"""
Clientes de clima com fallback automático e backoff exponencial.

Prioridade: Open-Meteo (gratuito, sem chave)
           → OpenWeather (requer OPENWEATHER_API_KEY)
           → Mock generator (sempre disponível)

Transparência: cada resposta inclui o campo `source` indicando o provedor.
"""

import asyncio
import random
import time
from datetime import date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from app.clients import HTTPClient
from app.core.config import get_settings
from app.schemas import RainRisk

settings = get_settings()
BRT = ZoneInfo("America/Sao_Paulo")


class WeatherClient:
    """Gerencia múltiplos provedores de clima com fallback e retry."""

    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, dict]] = {}
        self._cache_ttl = 300  # 5 min in-memory

    # ── API pública ──────────────────────────────────────────────

    async def get_forecast(
        self,
        lat: float,
        lon: float,
        target_dt: datetime,
    ) -> Optional[dict[str, Any]]:
        """
        Retorna dict com campos padronizados:
          temperature_c, precip_prob, precip_mm, wind_speed_kmh,
          humidity_percent, source, forecast_time
        """
        # Cache rápido em memória
        key = f"{lat:.3f}_{lon:.3f}_{target_dt.strftime('%Y%m%d%H')}"
        if key in self._cache:
            ts, data = self._cache[key]
            if time.time() - ts < self._cache_ttl:
                return data

        # Tenta provedores em ordem
        providers = [
            ("open-meteo", self._fetch_open_meteo),
            ("openweather", self._fetch_openweather),
            ("mock", self._generate_mock),
        ]

        for name, handler in providers:
            # Pula OpenWeather se não tiver chave
            if name == "openweather" and not settings.OPENWEATHER_API_KEY:
                continue
            try:
                data = await self._retry_with_backoff(handler, lat, lon, target_dt)
                if data:
                    data["source"] = name
                    self._cache[key] = (time.time(), data)
                    return data
            except Exception as exc:
                print(f"⚠️  {name} falhou: {exc}")
                continue

        return None

    # ── Retry com backoff exponencial ────────────────────────────

    @staticmethod
    async def _retry_with_backoff(func, *args, max_retries: int = 3):
        """
        Executa `func` com retry e backoff exponencial.
        Em caso de rate-limit (429), espera mais tempo.
        """
        for attempt in range(max_retries):
            try:
                return await func(*args)
            except Exception as exc:
                is_rate_limit = "429" in str(exc)
                wait = (2 ** attempt) * (5 if is_rate_limit else 1)
                if attempt < max_retries - 1:
                    await asyncio.sleep(wait)
                else:
                    raise

    # ── Open-Meteo (gratuito) ────────────────────────────────────

    async def _fetch_open_meteo(
        self, lat: float, lon: float, target_dt: datetime
    ) -> Optional[dict]:
        target_date = target_dt.date() if isinstance(target_dt, datetime) else target_dt
        start = target_date
        end = target_date + timedelta(days=1)

        async with HTTPClient() as http:
            data = await http.get(
                f"{settings.OPENMETEO_BASE_URL}/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": (
                        "temperature_2m,precipitation_probability,precipitation,"
                        "windspeed_10m,relativehumidity_2m,visibility,weathercode"
                    ),
                    "start_date": start.isoformat(),
                    "end_date": end.isoformat(),
                    "timezone": "America/Sao_Paulo",
                },
            )

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        if not times:
            return None

        # Encontra hora mais próxima
        idx = self._closest_index(times, target_dt)
        if idx is None:
            return None

        visibility = (hourly.get("visibility") or [None])[idx]
        weathercode = (hourly.get("weathercode") or [0])[idx]
        fog_risk = self._classify_fog(visibility, weathercode)

        return {
            "temperature_c": (hourly.get("temperature_2m") or [None])[idx],
            "precip_prob": (hourly.get("precipitation_probability") or [0])[idx],
            "precip_mm": (hourly.get("precipitation") or [0.0])[idx],
            "wind_speed_kmh": (hourly.get("windspeed_10m") or [0.0])[idx],
            "humidity_percent": (hourly.get("relativehumidity_2m") or [None])[idx],
            "visibility_m": int(visibility) if visibility is not None else None,
            "fog_risk": fog_risk,
            "forecast_time": times[idx],
        }

    # ── OpenWeather (fallback pago) ──────────────────────────────

    async def _fetch_openweather(
        self, lat: float, lon: float, target_dt: datetime
    ) -> Optional[dict]:
        if not settings.OPENWEATHER_API_KEY:
            return None

        async with HTTPClient() as http:
            data = await http.get(
                f"{settings.OPENWEATHER_BASE_URL}/data/2.5/forecast",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": settings.OPENWEATHER_API_KEY,
                    "units": "metric",
                    "lang": "pt_br",
                },
            )

        forecasts = data.get("list", [])
        if not forecasts:
            return None

        # Encontra previsão mais próxima (converte para aware)
        target_aware = target_dt if target_dt.tzinfo else target_dt.replace(tzinfo=BRT)
        best = min(
            forecasts,
            key=lambda f: abs(
                datetime.fromtimestamp(f["dt"], tz=BRT) - target_aware
            ).total_seconds(),
        )

        main = best.get("main", {})
        wind = best.get("wind", {})
        rain = best.get("rain", {})
        pop = best.get("pop", 0) * 100

        return {
            "temperature_c": main.get("temp"),
            "precip_prob": int(pop),
            "precip_mm": rain.get("3h", rain.get("1h", 0)),
            "wind_speed_kmh": round((wind.get("speed", 0)) * 3.6, 1),
            "humidity_percent": main.get("humidity"),
            "forecast_time": datetime.fromtimestamp(best["dt"], tz=BRT).isoformat(),
        }

    # ── Mock (sempre disponível) ─────────────────────────────────

    async def _generate_mock(
        self, lat: float, lon: float, target_dt: datetime
    ) -> dict:
        """Dados realistas para demo/testes quando nenhuma API está disponível."""
        hour = target_dt.hour
        # Padrão: chuva mais provável à tarde no Brasil
        if 14 <= hour <= 18:
            base_prob, base_mm = 55, 2.0
        elif 6 <= hour <= 10:
            base_prob, base_mm = 25, 0.8
        else:
            base_prob, base_mm = 12, 0.3

        prob = max(0, min(100, base_prob + random.randint(-15, 15)))
        mm = round(max(0, base_mm + random.uniform(-0.5, 1.0)), 1) if prob > 30 else 0

        # Neblina é mais comum em madrugadas/manhãs frias
        is_foggy = (0 <= hour <= 8) and random.random() < 0.15
        visibility_m = random.randint(300, 800) if is_foggy else random.randint(8000, 25000)
        fog_risk = self._classify_fog(visibility_m, None)

        return {
            "temperature_c": round(random.uniform(18, 32), 1),
            "precip_prob": prob,
            "precip_mm": mm,
            "wind_speed_kmh": round(random.uniform(5, 25), 1),
            "humidity_percent": random.randint(40, 95),
            "visibility_m": visibility_m,
            "fog_risk": fog_risk,
            "forecast_time": target_dt.isoformat(),
        }

    # ── Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _closest_index(times: list[str], target: datetime) -> Optional[int]:
        best_idx, best_diff = None, float("inf")
        # Garante que target é timezone-aware para comparação
        if target.tzinfo is None:
            target = target.replace(tzinfo=BRT)
        for i, t in enumerate(times):
            try:
                dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
                # Se dt é naive, assume BRT (Open-Meteo retorna no fuso solicitado)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=BRT)
                diff = abs((dt - target).total_seconds())
                if diff < best_diff:
                    best_diff = diff
                    best_idx = i
            except Exception:
                continue
        # Se diferença > 6h, dado é irrelevante
        return best_idx if best_idx is not None and best_diff < 6 * 3600 else None

    @staticmethod
    def _classify_fog(visibility_m, weathercode) -> str:
        """Classifica risco de neblina a partir da visibilidade (m) e código WMO."""
        code = int(weathercode or 0)
        # WMO codes 40-49 = neblina / nevoeiro
        if 40 <= code <= 49:
            return "high"
        vis = visibility_m if visibility_m is not None else 10000
        if vis < 1000:
            return "high"
        if vis < 3000:
            return "moderate"
        if vis < 8000:
            return "low"
        return "none"

    @staticmethod
    def classify_risk(prob: int, mm: float) -> str:
        """Classifica risco de chuva → RainRisk enum value."""
        if prob < 20:
            return RainRisk.NONE
        if prob < 40:
            return RainRisk.LOW
        if prob < 60:
            return RainRisk.MODERATE
        if prob < 80 and mm < 5:
            return RainRisk.HIGH
        return RainRisk.VERY_HIGH
