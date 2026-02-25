"""Testes de integração — endpoints da API via httpx AsyncClient."""

import pytest
from datetime import datetime
from zoneinfo import ZoneInfo
import asyncio

BRT = ZoneInfo("America/Sao_Paulo")


class TestHealthAndMetrics:
    @pytest.mark.asyncio
    async def test_root(self, client):
        r = await client.get("/")
        assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_health(self, client):
        r = await client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert data["timezone"] == "America/Sao_Paulo"
        assert "tomtom_traffic" in data["apis"]

    @pytest.mark.asyncio
    async def test_metrics(self, client):
        r = await client.get("/metrics")
        assert r.status_code == 200
        data = r.json()
        assert "requests_total" in data
        assert "active_jobs" in data

    @pytest.mark.asyncio
    async def test_docs_accessible(self, client):
        r = await client.get("/docs")
        assert r.status_code == 200


class TestRouteEndpoints:
    @pytest.mark.asyncio
    async def test_create_route_returns_202(self, client):
        r = await client.post("/routes", json={
            "origin": {"lat": -23.55, "lon": -46.63},
            "destination": {"lat": -22.91, "lon": -43.17},
            "departure_time": "2026-02-20T08:00:00-03:00",
            "profile": "driving-car",
        })
        assert r.status_code == 202
        data = r.json()
        assert "route_id" in data
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_create_route_missing_fields(self, client):
        r = await client.post("/routes", json={"origin": {"lat": -23.55, "lon": -46.63}})
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_get_route_not_found(self, client):
        r = await client.get("/routes/nonexistent-id")
        assert r.status_code == 404

    @pytest.mark.asyncio
    async def test_full_flow(self, client):
        """Cria rota, espera completar, verifica resultado com trânsito."""
        r = await client.post("/routes", json={
            "origin": {"lat": -23.55, "lon": -46.63},
            "destination": {"lat": -22.91, "lon": -43.17},
            "departure_time": "2026-02-20T08:00:00-03:00",
        })
        assert r.status_code == 202
        route_id = r.json()["route_id"]

        # Poll até completed (max 60s)
        for _ in range(40):
            r = await client.get(f"/routes/{route_id}")
            assert r.status_code == 200
            data = r.json()
            if data["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(1.5)

        assert data["status"] == "completed", f"Failed: {data.get('error')}"
        assert data["summary"] is not None
        assert data["samples"] is not None
        assert len(data["samples"]) > 0
        # Verifica que trânsito foi incluído
        assert data["traffic_summary"] is not None
        assert data["traffic_samples"] is not None
        assert data["traffic_summary"]["samples_count"] > 0


class TestTrafficEndpoints:
    @pytest.mark.asyncio
    async def test_traffic_history(self, client):
        r = await client.get("/traffic-history", params={
            "lat": -23.55, "lon": -46.63, "date": "2026-02-20",
        })
        assert r.status_code == 200
        data = r.json()
        assert "hourly_pattern" in data
        assert "peak_hours" in data
        assert "quiet_hours" in data
        assert data["data_source"] == "historical_model"

    @pytest.mark.asyncio
    async def test_best_departure(self, client):
        r = await client.get("/best-departure", params={
            "origin_lat": -23.55, "origin_lon": -46.63,
            "dest_lat": -22.91, "dest_lon": -43.17,
            "date": "2026-02-20",
            "base_duration_min": 300,
        })
        assert r.status_code == 200
        data = r.json()
        assert "best_departures" in data
        assert "worst_departures" in data
        assert "recommendation" in data
        assert len(data["best_departures"]) == 3
        assert len(data["all_hours"]) == 24

    @pytest.mark.asyncio
    async def test_best_departure_holiday(self, client):
        r = await client.get("/best-departure", params={
            "origin_lat": -23.55, "origin_lon": -46.63,
            "dest_lat": -22.91, "dest_lon": -43.17,
            "date": "2026-12-25",
            "base_duration_min": 300,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["is_holiday"] is True
        assert data["holiday_name"] == "Natal"

    @pytest.mark.asyncio
    async def test_holidays_endpoint(self, client):
        r = await client.get("/holidays", params={"year": 2026})
        assert r.status_code == 200
        data = r.json()
        assert data["year"] == 2026
        assert len(data["holidays"]) > 10  # fixos + móveis
        names = [h["name"] for h in data["holidays"]]
        assert "Natal" in names
        assert any("Carnaval" in n for n in names)
