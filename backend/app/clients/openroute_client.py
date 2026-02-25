"""
Cliente OpenRouteService para cálculo de rotas.

Requer ORS_API_KEY no .env.  Quando a chave não está configurada, o
fallback usa OSRM (gratuito, sem chave).
"""

import math
from typing import Any

from app.clients import HTTPClient
from app.core.config import get_settings
from app.schemas import Coordinates

settings = get_settings()


class OpenRouteClient:
    """Calcula rotas via OpenRouteService (com fallback OSRM)."""

    def __init__(self) -> None:
        self.ors_key = settings.ORS_API_KEY
        self.ors_base = settings.ORS_BASE_URL
        self.osrm_base = settings.OSRM_BASE_URL

    # ── Rota principal ───────────────────────────────────────────

    async def calculate_route(
        self,
        start: Coordinates,
        end: Coordinates,
        profile: str = "driving-car",
    ) -> dict[str, Any]:
        """
        Retorna dict com:
          geometry   — GeoJSON LineString
          distance_km
          duration_min
          coordinates — lista de [lon, lat]
        """
        if self.ors_key:
            try:
                return await self._via_ors(start, end, profile)
            except Exception as exc:
                print(f"⚠️  ORS falhou ({exc}), tentando OSRM...")

        return await self._via_osrm(start, end)

    # ── ORS ──────────────────────────────────────────────────────

    async def _via_ors(
        self, start: Coordinates, end: Coordinates, profile: str
    ) -> dict[str, Any]:
        async with HTTPClient() as http:
            url = f"{self.ors_base}/v2/directions/{profile}/geojson"
            body = {
                "coordinates": [
                    [start.lon, start.lat],
                    [end.lon, end.lat],
                ],
            }
            headers = {
                "Authorization": self.ors_key,
                "Content-Type": "application/json",
            }
            data = await http.post(url, json=body, headers=headers)

        feature = data["features"][0]
        props = feature["properties"]
        geom = feature["geometry"]
        return {
            "geometry": geom,
            "distance_km": round(props["summary"]["distance"] / 1000, 2),
            "duration_min": round(props["summary"]["duration"] / 60, 1),
            "coordinates": geom["coordinates"],
        }

    # ── OSRM (fallback sem chave) ────────────────────────────────

    async def _via_osrm(
        self, start: Coordinates, end: Coordinates
    ) -> dict[str, Any]:
        async with HTTPClient() as http:
            url = (
                f"{self.osrm_base}/route/v1/driving/"
                f"{start.lon},{start.lat};{end.lon},{end.lat}"
            )
            data = await http.get(url, params={
                "overview": "full",
                "geometries": "geojson",
                "steps": "false",
            })

        if data.get("code") != "Ok":
            raise RuntimeError(f"OSRM error: {data.get('message')}")

        route = data["routes"][0]
        geom = route["geometry"]
        return {
            "geometry": geom,
            "distance_km": round(route["distance"] / 1000, 2),
            "duration_min": round(route["duration"] / 60, 1),
            "coordinates": geom["coordinates"],
        }

    # ── Interpolação de pontos ───────────────────────────────────

    @staticmethod
    def interpolate_points(
        coordinates: list[list[float]],
        max_points: int = 50,
        min_distance_km: float = 10.0,
    ) -> list[tuple[float, float]]:
        """
        Seleciona pontos uniformes ao longo da rota para amostragem climática.

        Amostragem dinâmica:
          - se distância total > 300 km → amostra a cada 50 km
          - caso contrário → amostra a cada 30 km

        Retorna lista de (lat, lon).
        """
        if len(coordinates) < 2:
            return [(c[1], c[0]) for c in coordinates]

        def haversine(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
            R = 6371  # km
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = (
                math.sin(dlat / 2) ** 2
                + math.cos(math.radians(lat1))
                * math.cos(math.radians(lat2))
                * math.sin(dlon / 2) ** 2
            )
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        total_dist = sum(
            haversine(
                coordinates[i][0], coordinates[i][1],
                coordinates[i + 1][0], coordinates[i + 1][1],
            )
            for i in range(len(coordinates) - 1)
        )

        # Decide o passo de amostragem conforme regra do usuário
        step_km = 50.0 if total_dist > 300.0 else 30.0
        # Garantir ao menos os pontos de origem/chegada + um ponto intermediário
        estimated_points = max(3, int(total_dist / step_km) + 1)
        n_points = min(max_points, estimated_points)

        if len(coordinates) <= n_points:
            return [(c[1], c[0]) for c in coordinates]

        import numpy as np

        indices = np.linspace(0, len(coordinates) - 1, n_points, dtype=int)
        # Remove possíveis duplicatas de índice e garante ordem crescente
        unique_indices = sorted(dict.fromkeys(indices.tolist()))
        return [(coordinates[i][1], coordinates[i][0]) for i in unique_indices]
