"""
Serviço de semáforos via OpenStreetMap (Overpass API).

Consulta nodes com tag `highway=traffic_signals` dentro de uma bounding box
ou raio ao redor de um ponto.

Ciclo de semáforos: como dados reais de temporização não estão disponíveis
publicamente, usamos ciclos simulados baseados em classificação viária:
  - Urbano grande: 30s verde / 3s amarelo / 25s vermelho
  - Urbano médio:  25s verde / 3s amarelo / 20s vermelho
  - Urbano pequeno: 20s verde / 3s amarelo / 15s vermelho

A API Overpass é gratuita e sem chave, com rate-limit implícito.
"""

import math
import random
from typing import Any

import httpx

from app.core.config import get_settings

settings = get_settings()
OVERPASS_URL = "https://overpass-api.de/api/interpreter"


class TrafficLightService:
    """Consulta semáforos no OpenStreetMap e fornece dados simulados de ciclo."""

    async def get_route_signals(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
    ) -> list[dict[str, Any]]:
        """
        Retorna semáforos na bounding box da rota via Overpass API.
        Fallback: lista vazia se a API falhar.
        """
        try:
            return await self._fetch_overpass_bbox(min_lat, min_lon, max_lat, max_lon)
        except Exception as exc:
            print(f"⚠️  Overpass traffic_signals falhou: {exc}")
            return []

    async def get_nearby_signals(
        self,
        lat: float,
        lon: float,
        radius_m: int = 500,
    ) -> list[dict[str, Any]]:
        """
        Retorna semáforos num raio ao redor de um ponto.
        Usado no modo navegação para detectar proximidade.
        """
        try:
            return await self._fetch_overpass_radius(lat, lon, radius_m)
        except Exception as exc:
            print(f"⚠️  Overpass nearby signals falhou: {exc}")
            return []

    # ── Overpass queries ─────────────────────────────────────────

    async def _fetch_overpass_bbox(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
    ) -> list[dict[str, Any]]:
        """Consulta Overpass por semáforos na bounding box."""
        query = f"""
        [out:json][timeout:15];
        node["highway"="traffic_signals"]({min_lat},{min_lon},{max_lat},{max_lon});
        out body;
        """
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()

        return self._parse_elements(data.get("elements", []))

    async def _fetch_overpass_radius(
        self,
        lat: float,
        lon: float,
        radius_m: int,
    ) -> list[dict[str, Any]]:
        """Consulta Overpass por semáforos num raio."""
        query = f"""
        [out:json][timeout:10];
        node["highway"="traffic_signals"](around:{radius_m},{lat},{lon});
        out body;
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()

        signals = self._parse_elements(data.get("elements", []))

        # Adiciona distância ao ponto de consulta
        for s in signals:
            s["distance_m"] = round(self._haversine(lat, lon, s["lat"], s["lon"]))

        # Ordena por distância
        signals.sort(key=lambda s: s["distance_m"])
        return signals

    # ── Parsing ──────────────────────────────────────────────────

    def _parse_elements(self, elements: list[dict]) -> list[dict[str, Any]]:
        """Converte elementos Overpass em formato padronizado."""
        signals: list[dict[str, Any]] = []
        for el in elements:
            if el.get("type") != "node":
                continue
            lat = el.get("lat")
            lon = el.get("lon")
            if lat is None or lon is None:
                continue

            tags = el.get("tags", {})
            name = tags.get("name", "")

            # Ciclo simulado com variação
            green = random.randint(20, 35)
            yellow = 3
            red = random.randint(15, 30)

            signals.append({
                "lat": lat,
                "lon": lon,
                "osm_id": el.get("id", 0),
                "name": name,
                "green_duration": green,
                "yellow_duration": yellow,
                "red_duration": red,
            })

        return signals

    # ── Helpers ──────────────────────────────────────────────────

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Distância Haversine em metros."""
        R = 6_371_000  # raio da Terra em metros
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
