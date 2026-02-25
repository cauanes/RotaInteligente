"""
Script de seed para popular dados mock de histórico de trânsito.

Uso:
    python seed_traffic.py

Gera um arquivo JSON com dados de trânsito para várias cidades e datas,
útil para testes e demonstrações.
"""

import json
import random
from datetime import date, timedelta

from app.services.traffic_service import get_traffic_history

CITIES = [
    {"name": "São Paulo", "lat": -23.5505, "lon": -46.6333},
    {"name": "Rio de Janeiro", "lat": -22.9068, "lon": -43.1729},
    {"name": "Curitiba", "lat": -25.4284, "lon": -49.2733},
    {"name": "Belo Horizonte", "lat": -19.9167, "lon": -43.9345},
    {"name": "Campinas", "lat": -22.9099, "lon": -47.0626},
    {"name": "Santos", "lat": -23.9608, "lon": -46.3336},
    {"name": "Florianópolis", "lat": -27.5954, "lon": -48.5480},
]


def generate_seed_data(days: int = 30) -> list[dict]:
    """Gera dados de trânsito para os próximos `days` dias."""
    records = []
    start = date.today()

    for city in CITIES:
        for i in range(days):
            d = start + timedelta(days=i)
            record = get_traffic_history(city["lat"], city["lon"], d.isoformat())
            record["city"] = city["name"]
            records.append(record)

    return records


if __name__ == "__main__":
    data = generate_seed_data(30)
    output_path = "traffic_seed_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"✅ {len(data)} registros gerados em {output_path}")
