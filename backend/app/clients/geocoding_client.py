"""
Cliente Nominatim (OpenStreetMap) para geocoding.
Converte nomes de cidades em coordenadas e vice-versa.
"""

from typing import Optional

from app.clients import HTTPClient
from app.core.config import get_settings
from app.schemas import Coordinates

settings = get_settings()


class GeocodingClient:
    """Geocoding via Nominatim (gratuito, sem chave)."""

    def __init__(self) -> None:
        self.base_url = settings.NOMINATIM_BASE_URL

    async def search(self, query: str, limit: int = 5) -> list[dict]:
        """Busca cidades pelo nome, retornando lista de resultados."""
        if not query or len(query.strip()) < 2:
            return []

        async with HTTPClient() as http:
            raw = await http.get(
                f"{self.base_url}/search",
                params={
                    "q": query,
                    "format": "json",
                    "addressdetails": 1,
                    "limit": limit * 2,
                    "featuretype": "city,town,municipality",
                },
            )

        seen: set[tuple[float, float]] = set()
        results: list[dict] = []

        for item in raw:
            addr = item.get("address", {})
            name = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
                or item.get("display_name", "").split(",")[0]
            ).strip()
            if not name:
                continue

            lat, lon = float(item["lat"]), float(item["lon"])
            key = (round(lat, 2), round(lon, 2))
            if key in seen:
                continue
            seen.add(key)

            state = addr.get("state", "")
            display = f"{name}, {state}" if state else name

            results.append({
                "name": name,
                "display_name": display,
                "coordinates": {"lat": lat, "lon": lon},
                "importance": item.get("importance", 0),
            })

        results.sort(key=lambda x: x["importance"], reverse=True)
        return results[:limit]

    async def get_coordinates(self, city_name: str) -> Optional[dict]:
        """Retorna primeira cidade encontrada ou None."""
        hits = await self.search(city_name, limit=1)
        return hits[0] if hits else None
