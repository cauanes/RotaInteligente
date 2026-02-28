"""
Cliente para pontos de pedágio via OpenStreetMap (Overpass API).

Consulta a API Overpass (gratuita, sem chave necessária) para encontrar
nodes/ways com tag `barrier=toll_booth` na bounding box da rota.

Rate limit Overpass: respeita timeout=15s; em pico de carga pode falhar
graciosamente retornando lista vazia (sem afetar o pipeline principal).
"""

import httpx

from app.core.config import get_settings

settings = get_settings()

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


class TollClient:
    """Busca postos de pedágio ao longo da rota via OpenStreetMap."""

    async def get_toll_points(
        self,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
    ) -> list[dict]:
        """
        Retorna lista de pedágios na bounding box (+ margem de 0.1°).

        Campos retornados por item:
          lat, lon, name, operator
        """
        # Margem de ~11 km para capturar praças próximas à rota
        margin = 0.1
        bbox = (
            f"{min_lat - margin},{min_lon - margin},"
            f"{max_lat + margin},{max_lon + margin}"
        )
        query = (
            f"[out:json][timeout:15];"
            f'(node["barrier"="toll_booth"]({bbox});'
            f'way["barrier"="toll_booth"]({bbox}););'
            f"out center;"
        )
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(20),
                headers={"User-Agent": f"{settings.APP_NAME}/{settings.APP_VERSION}"},
            ) as client:
                resp = await client.post(OVERPASS_URL, data={"data": query})
                resp.raise_for_status()
                data = resp.json()

            results: list[dict] = []
            for el in data.get("elements", []):
                tags = el.get("tags", {})
                # Nodes têm lat/lon direto; ways usam o centro calculado
                lat = el.get("lat") or (el.get("center") or {}).get("lat")
                lon = el.get("lon") or (el.get("center") or {}).get("lon")
                if lat is None or lon is None:
                    continue
                name = (
                    tags.get("name")
                    or tags.get("ref")
                    or tags.get("operator")
                    or "Pedágio"
                )
                results.append({
                    "lat": float(lat),
                    "lon": float(lon),
                    "name": name,
                    "operator": tags.get("operator", ""),
                })
            return results

        except Exception as exc:
            print(f"⚠️  TollClient (Overpass): {exc}")
            return []
