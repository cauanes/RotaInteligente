"""
Cliente de trânsito em tempo real via TomTom Traffic Flow API.

API gratuita (2500 req/dia) — requer cadastro em developer.tomtom.com
mas NÃO requer cartão de crédito.

Fallback: quando não há chave ou a API falha, retorna estimativa
baseada em heurísticas (horário de pico, dia da semana, feriados).
"""

import math
import random
from datetime import datetime
from typing import Any, Optional

from app.clients import HTTPClient
from app.core.config import get_settings

settings = get_settings()


class TrafficClient:
    """Consulta dados de trânsito em tempo real + fallback heurístico."""

    # ── API pública ──────────────────────────────────────────────

    async def get_traffic_flow(
        self,
        lat: float,
        lon: float,
        target_dt: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """
        Retorna dados de fluxo de trânsito para um ponto:
          current_speed_kmh, free_flow_speed_kmh, congestion_ratio,
          congestion_level, delay_minutes, source
        """
        if settings.TOMTOM_API_KEY:
            try:
                return await self._fetch_tomtom(lat, lon)
            except Exception as exc:
                print(f"⚠️  TomTom Traffic falhou: {exc}")

        # Fallback heurístico
        return self._estimate_traffic(lat, lon, target_dt)

    async def get_route_traffic(
        self,
        points: list[tuple[float, float]],
        departure_time: datetime,
        duration_minutes: float,
    ) -> dict[str, Any]:
        """
        Consulta trânsito para múltiplos pontos ao longo da rota.
        Retorna resumo geral + dados por ponto.
        """
        total = len(points)
        samples: list[dict[str, Any]] = []
        total_delay = 0.0

        for idx, (lat, lon) in enumerate(points):
            progress = idx / max(total - 1, 1)
            from datetime import timedelta
            eta = departure_time + timedelta(minutes=progress * duration_minutes)

            flow = await self.get_traffic_flow(lat, lon, eta)
            flow["lat"] = lat
            flow["lon"] = lon
            flow["eta"] = eta.isoformat()
            total_delay += flow.get("delay_minutes", 0)
            samples.append(flow)

        # Calcula resumo
        speeds = [s["current_speed_kmh"] for s in samples if s.get("current_speed_kmh")]
        avg_speed = sum(speeds) / len(speeds) if speeds else 60.0
        congestion_ratios = [s["congestion_ratio"] for s in samples if s.get("congestion_ratio")]
        avg_congestion = sum(congestion_ratios) / len(congestion_ratios) if congestion_ratios else 0.0

        if avg_congestion < 0.15:
            overall_level = "free"
        elif avg_congestion < 0.35:
            overall_level = "light"
        elif avg_congestion < 0.55:
            overall_level = "moderate"
        elif avg_congestion < 0.75:
            overall_level = "heavy"
        else:
            overall_level = "severe"

        return {
            "summary": {
                "avg_speed_kmh": round(avg_speed, 1),
                "avg_congestion_ratio": round(avg_congestion, 2),
                "overall_congestion": overall_level,
                "total_delay_minutes": round(total_delay, 1),
                "samples_count": total,
            },
            "samples": samples,
        }

    # ── Incidents (acidentes e ocorrências) ──────────────────────

    async def get_incidents(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
    ) -> list[dict[str, Any]]:
        """
        Retorna acidentes e incidentes de trânsito na bounding box.
        Usa TomTom Traffic Incidents API (requer TOMTOM_API_KEY).
        Sem chave: retorna lista vazia (sem fallback heurístico para incidentes reais).
        """
        if not settings.TOMTOM_API_KEY:
            return []
        try:
            return await self._fetch_tomtom_incidents(min_lat, min_lon, max_lat, max_lon)
        except Exception as exc:
            print(f"⚠️  TomTom Incidents: {exc}")
            return []

    async def _fetch_tomtom_incidents(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
    ) -> list[dict[str, Any]]:
        """
        TomTom Traffic Incidents Details API v5.
        Docs: https://developer.tomtom.com/traffic-api/documentation/traffic-incidents/incident-details
        """
        _type_map: dict[int, str] = {
            0: "Desconhecido", 1: "Acidente", 2: "Neblina", 3: "Perigo",
            4: "Obras",        5: "Bloqueio", 6: "Congestionamento",
            7: "Evento",       8: "Gelo",     9: "Chuva forte",
        }
        _severity_map: dict[int, str] = {
            0: "minor", 1: "minor", 2: "moderate", 3: "major", 4: "severe",
        }

        async with HTTPClient() as http:
            data = await http.get(
                f"{settings.TOMTOM_BASE_URL}/traffic/services/5/incidentDetails",
                params={
                    "key": settings.TOMTOM_API_KEY,
                    "bbox": f"{min_lon},{min_lat},{max_lon},{max_lat}",
                    "categoryFilter": "0,1,2,3,4,5,6,7,8,9,10,11,14",
                    "timeValidityFilter": "present",
                    "language": "pt-BR",
                },
            )

        incidents: list[dict[str, Any]] = []
        for incident in data.get("incidents", []):
            geo = incident.get("geometry", {})
            coords = geo.get("coordinates", [None, None])
            if not coords or None in coords:
                continue
            props = incident.get("properties", {})
            category = int(props.get("iconCategory", 0))
            events: list[dict] = props.get("events") or [{}]
            desc = events[0].get("description", "") if events else ""
            delay_s = props.get("delay", 0) or 0
            incidents.append({
                "lat": coords[1],
                "lon": coords[0],
                "type": _type_map.get(category, "Incidente"),
                "severity": _severity_map.get(props.get("magnitudeOfDelay", 0), "unknown"),
                "description": desc,
                "delay_minutes": round(delay_s / 60, 1),
            })
        return incidents

    # ── TomTom Traffic Flow API ──────────────────────────────────

    async def _fetch_tomtom(self, lat: float, lon: float) -> dict[str, Any]:
        """
        TomTom Flow Segment Data:
        https://developer.tomtom.com/traffic-api/documentation/traffic-flow/flow-segment-data
        """
        async with HTTPClient() as http:
            data = await http.get(
                f"{settings.TOMTOM_BASE_URL}/traffic/services/4/flowSegmentData"
                f"/absolute/10/json",
                params={
                    "key": settings.TOMTOM_API_KEY,
                    "point": f"{lat},{lon}",
                    "unit": "KMPH",
                },
            )

        flow = data.get("flowSegmentData", {})
        current = flow.get("currentSpeed", 60)
        free_flow = flow.get("freeFlowSpeed", 80)

        # Congestion ratio: 0 = livre, 1 = parado
        ratio = max(0, 1 - (current / max(free_flow, 1)))
        delay_per_km = (1 / max(current, 1) - 1 / max(free_flow, 1)) * 60  # min/km

        return {
            "current_speed_kmh": round(current, 1),
            "free_flow_speed_kmh": round(free_flow, 1),
            "congestion_ratio": round(ratio, 2),
            "congestion_level": self._level_from_ratio(ratio),
            "delay_minutes": round(max(0, delay_per_km * 5), 1),  # ~5km por segmento
            "confidence": flow.get("confidence", 0.8),
            "source": "tomtom",
        }

    # ── Fallback heurístico ──────────────────────────────────────

    def _estimate_traffic(
        self, lat: float, lon: float, target_dt: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """
        Estimativa sem API, baseada em:
          - Horário de pico
          - Dia da semana / feriado
          - Proximidade de centros urbanos brasileiros
        """
        from app.services.holiday_service import is_holiday_or_extended

        now = target_dt or datetime.now()
        hour = now.hour
        weekday = now.weekday()
        is_hol = is_holiday_or_extended(now.date())

        # Fator base por horário (pico manhã/tarde)
        if 7 <= hour <= 9:
            peak_factor = 0.65
        elif 17 <= hour <= 19:
            peak_factor = 0.70
        elif 12 <= hour <= 14:
            peak_factor = 0.35
        elif 20 <= hour <= 22:
            peak_factor = 0.30
        else:
            peak_factor = 0.15

        # Fim de semana reduz congestionamento urbano
        if weekday >= 5:
            peak_factor *= 0.5

        # Feriado prolongado: rodovias ficam congestionadas, cidade esvazia
        if is_hol:
            peak_factor *= 1.3 if self._is_highway_region(lat, lon) else 0.4

        # Proximidade de capitais aumenta trânsito
        city_factor = self._city_proximity_factor(lat, lon)
        ratio = min(1.0, peak_factor * city_factor + random.uniform(-0.05, 0.05))

        free_flow = 80 + random.uniform(-10, 10)
        current = free_flow * (1 - ratio)

        return {
            "current_speed_kmh": round(max(10, current), 1),
            "free_flow_speed_kmh": round(free_flow, 1),
            "congestion_ratio": round(max(0, ratio), 2),
            "congestion_level": self._level_from_ratio(ratio),
            "delay_minutes": round(max(0, ratio * 8), 1),
            "confidence": 0.4,
            "source": "heuristic",
        }

    # ── Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _level_from_ratio(ratio: float) -> str:
        if ratio < 0.15:
            return "free"
        if ratio < 0.35:
            return "light"
        if ratio < 0.55:
            return "moderate"
        if ratio < 0.75:
            return "heavy"
        return "severe"

    @staticmethod
    def _city_proximity_factor(lat: float, lon: float) -> float:
        """Fator de trânsito baseado na proximidade de grandes cidades BR."""
        cities = [
            (-23.55, -46.63, "São Paulo"),
            (-22.91, -43.17, "Rio de Janeiro"),
            (-19.92, -43.94, "Belo Horizonte"),
            (-25.43, -49.27, "Curitiba"),
            (-30.03, -51.23, "Porto Alegre"),
            (-15.78, -47.93, "Brasília"),
            (-12.97, -38.51, "Salvador"),
            (-8.05, -34.87, "Recife"),
            (-3.72, -38.52, "Fortaleza"),
            (-22.91, -47.06, "Campinas"),
            (-23.18, -45.88, "São José dos Campos"),
        ]
        min_dist = float("inf")
        for clat, clon, _ in cities:
            d = math.sqrt((lat - clat) ** 2 + (lon - clon) ** 2)
            min_dist = min(min_dist, d)

        # Quanto mais perto, maior o fator (0.5–2.0)
        if min_dist < 0.3:
            return 2.0
        if min_dist < 0.8:
            return 1.5
        if min_dist < 2.0:
            return 1.0
        return 0.6

    @staticmethod
    def _is_highway_region(lat: float, lon: float) -> bool:
        """Heurística: regiões entre grandes cidades = rodovias."""
        # Eixo SP-RJ (Via Dutra)
        if -23.6 < lat < -22.8 and -46.7 < lon < -43.1:
            return True
        # Eixo SP-Campinas
        if -23.6 < lat < -22.8 and -47.2 < lon < -46.5:
            return True
        # Eixo SP-Curitiba
        if -25.5 < lat < -23.5 and -49.5 < lon < -46.5:
            return True
        return False
