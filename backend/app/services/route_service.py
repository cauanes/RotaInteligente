"""
Serviço de análise de rotas com dados meteorológicos e trânsito.

Orquestra os clientes (routing, weather, traffic) e aplica a lógica
de negócio: interpolar pontos, buscar previsão para cada ponto,
consultar trânsito, classificar riscos e montar a resposta final.

Todos os horários usam America/Sao_Paulo (BRT/BRST).
"""

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.clients.geocoding_client import GeocodingClient
from app.clients.openroute_client import OpenRouteClient
from app.clients.traffic_client import TrafficClient
from app.clients.weather_client import WeatherClient
from app.core.background import RouteStatus, get_job, update_job, persist_job_to_cache
from app.core.cache import cached
from app.core.config import get_settings
from app.schemas import (
    Coordinates,
    RainRisk,
    RouteResultResponse,
    RouteSegment,
    RouteSummary,
    WeatherSample,
)

settings = get_settings()
BRT = ZoneInfo("America/Sao_Paulo")


class RouteService:
    """Orquestra o pipeline de análise de rota + clima + trânsito."""

    def __init__(self) -> None:
        self.routing = OpenRouteClient()
        self.weather = WeatherClient()
        self.traffic = TrafficClient()
        self.geocoding = GeocodingClient()

    # ── Pipeline completo (chamado em background) ────────────────

    async def compute_route_weather(
        self,
        route_id: str,
        origin: Coordinates,
        destination: Coordinates,
        departure_time: datetime,
        profile: str = "driving-car",
    ) -> None:
        """
        Executa o pipeline completo e salva resultado no job store.
        Chamada como background task pelo endpoint POST /routes.
        """
        update_job(route_id, status=RouteStatus.PROCESSING)

        try:
            # Garante que departure_time está em BRT
            if departure_time.tzinfo is None:
                departure_time = departure_time.replace(tzinfo=BRT)

            # 1. Calcula rota
            route_data = await self.routing.calculate_route(origin, destination, profile)

            # 2. Interpola pontos
            points = self.routing.interpolate_points(
                route_data["coordinates"],
                max_points=settings.MAX_ROUTE_POINTS,
                min_distance_km=settings.MIN_DISTANCE_KM,
            )

            # 3. Busca previsão meteorológica para cada ponto
            #    NOTA: usa o ETA *futuro* de cada ponto, não o horário atual
            samples: list[dict[str, Any]] = []
            sources_set: set[str] = set()
            total_points = len(points)

            for idx, (lat, lon) in enumerate(points):
                # Calcula ETA baseado no progresso da rota (em BRT)
                progress = idx / max(total_points - 1, 1)
                eta = departure_time + timedelta(
                    minutes=progress * route_data["duration_min"]
                )

                # Busca previsão para o horário FUTURO (ETA), não o horário atual
                forecast = await self.weather.get_forecast(lat, lon, eta)
                if not forecast:
                    continue

                risk = self.weather.classify_risk(
                    forecast.get("precip_prob", 0),
                    forecast.get("precip_mm", 0),
                )
                source = forecast.get("source", "unknown")
                sources_set.add(source)

                # Monta descrição
                if idx == 0:
                    desc = "Partida"
                elif idx == total_points - 1:
                    desc = "Chegada"
                else:
                    desc = f"Trecho {int(progress * 100)}%"

                samples.append({
                    "lat": lat,
                    "lon": lon,
                    "timestamp": eta.isoformat(),
                    "precip_mm": forecast.get("precip_mm", 0),
                    "precip_prob": forecast.get("precip_prob", 0),
                    "temperature_c": forecast.get("temperature_c"),
                    "wind_speed_kmh": forecast.get("wind_speed_kmh"),
                    "humidity_percent": forecast.get("humidity_percent"),
                    "rain_risk": risk,
                    "source": source,
                    "description": desc,
                })

            # 4. Busca dados de trânsito para cada ponto da rota
            traffic_data = await self.traffic.get_route_traffic(
                points, departure_time, route_data["duration_min"]
            )

            # 5. Calcula segmentos e resumo (clima)
            segments = self._build_segments(samples)
            summary = self._build_summary(route_data, samples, list(sources_set))

            # 6. Salva resultado completo
            result = {
                "route_id": route_id,
                "status": RouteStatus.COMPLETED,
                "route_geometry": route_data["geometry"],
                "summary": summary,
                "samples": samples,
                "segments": segments,
                "traffic_summary": traffic_data["summary"],
                "traffic_samples": traffic_data["samples"],
            }

            update_job(route_id, status=RouteStatus.COMPLETED, result=result)
            await persist_job_to_cache(route_id)

        except Exception as exc:
            update_job(
                route_id,
                status=RouteStatus.FAILED,
                error=str(exc),
            )

    # ── Helpers ──────────────────────────────────────────────────

    def _build_segments(self, samples: list[dict]) -> list[dict]:
        """Agrupa pontos consecutivos com mesmo nível de risco."""
        if len(samples) < 2:
            return []

        segments: list[dict] = []
        seg_start = samples[0]
        current_risk = samples[0]["rain_risk"]
        count = 1

        for s in samples[1:]:
            if s["rain_risk"] == current_risk:
                count += 1
            else:
                segments.append({
                    "start": {"lat": seg_start["lat"], "lon": seg_start["lon"]},
                    "end": {"lat": samples[samples.index(s) - 1]["lat"],
                            "lon": samples[samples.index(s) - 1]["lon"]},
                    "has_rain": current_risk != RainRisk.NONE,
                    "rain_risk": current_risk,
                    "point_count": count,
                })
                seg_start = s
                current_risk = s["rain_risk"]
                count = 1

        # Último segmento
        segments.append({
            "start": {"lat": seg_start["lat"], "lon": seg_start["lon"]},
            "end": {"lat": samples[-1]["lat"], "lon": samples[-1]["lon"]},
            "has_rain": current_risk != RainRisk.NONE,
            "rain_risk": current_risk,
            "point_count": count,
        })
        return segments

    def _build_summary(
        self,
        route_data: dict,
        samples: list[dict],
        sources: list[str],
    ) -> dict:
        rain_count = sum(1 for s in samples if s["precip_prob"] > 20)
        risks = [s["rain_risk"] for s in samples]

        risk_order = {
            RainRisk.NONE: 0, RainRisk.LOW: 1, RainRisk.MODERATE: 2,
            RainRisk.HIGH: 3, RainRisk.VERY_HIGH: 4,
        }
        overall = max(risks, key=lambda r: risk_order.get(r, 0)) if risks else RainRisk.NONE

        recs = {
            RainRisk.NONE: "✅ Viagem tranquila, sem previsão de chuva significativa.",
            RainRisk.LOW: "🌤️ Baixo risco de chuva. Viagem deve ser tranquila.",
            RainRisk.MODERATE: "⚠️ Chuva moderada em alguns trechos. Atenção redobrada.",
            RainRisk.HIGH: "🌧️ Alto risco de chuva. Dirija com cautela.",
            RainRisk.VERY_HIGH: "⛈️ Chuva forte prevista. Considere adiar a viagem.",
        }

        conf = 0.9 if "open-meteo" in sources or "openweather" in sources else 0.5

        return {
            "distance_km": route_data["distance_km"],
            "duration_minutes": route_data["duration_min"],
            "total_samples": len(samples),
            "rain_samples": rain_count,
            "overall_risk": overall,
            "recommendation": recs.get(overall, "Sem recomendação."),
            "confidence": conf,
            "sources": sources,
        }
