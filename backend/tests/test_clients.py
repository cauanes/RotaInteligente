"""Testes unitários para clientes (weather, openroute, geocoding, traffic)."""

import pytest
from datetime import datetime, date
from zoneinfo import ZoneInfo

from app.clients.weather_client import WeatherClient
from app.clients.openroute_client import OpenRouteClient
from app.clients.geocoding_client import GeocodingClient
from app.clients.traffic_client import TrafficClient
from app.schemas import RainRisk

BRT = ZoneInfo("America/Sao_Paulo")


class TestWeatherClient:
    def setup_method(self):
        self.client = WeatherClient()

    def test_classify_risk_none(self):
        assert self.client.classify_risk(10, 0) == RainRisk.NONE

    def test_classify_risk_low(self):
        assert self.client.classify_risk(35, 1.0) == RainRisk.LOW

    def test_classify_risk_moderate(self):
        assert self.client.classify_risk(55, 2.0) == RainRisk.MODERATE

    def test_classify_risk_high(self):
        assert self.client.classify_risk(75, 3.0) == RainRisk.HIGH

    def test_classify_risk_very_high(self):
        assert self.client.classify_risk(90, 10.0) == RainRisk.VERY_HIGH

    def test_closest_index_basic(self):
        times = ["2026-02-20T08:00", "2026-02-20T09:00", "2026-02-20T10:00"]
        target = datetime(2026, 2, 20, 9, 30, tzinfo=BRT)
        idx = self.client._closest_index(times, target)
        assert idx == 1  # 09:00 é mais próximo de 09:30

    def test_closest_index_too_far_returns_none(self):
        times = ["2026-02-20T08:00"]
        target = datetime(2026, 2, 21, 20, 0, tzinfo=BRT)
        idx = self.client._closest_index(times, target)
        assert idx is None  # >6h de diferença

    @pytest.mark.asyncio
    async def test_mock_generation(self):
        data = await self.client._generate_mock(-23.55, -46.63, datetime(2026, 2, 20, 15, 0, tzinfo=BRT))
        assert "temperature_c" in data
        assert "precip_prob" in data
        assert 0 <= data["precip_prob"] <= 100


class TestOpenRouteClient:
    def setup_method(self):
        self.client = OpenRouteClient()

    def test_interpolate_points(self):
        coords = [[-46.63, -23.55], [-43.17, -22.91]]
        points = self.client.interpolate_points(coords, max_points=5, min_distance_km=10)
        assert len(points) <= 5
        assert len(points) >= 2

    def test_interpolate_returns_lat_lon_tuples(self):
        coords = [[-46.63, -23.55], [-43.17, -22.91]]
        points = self.client.interpolate_points(coords, max_points=3)
        for lat, lon in points:
            assert -90 <= lat <= 90
            assert -180 <= lon <= 180


class TestGeocodingClient:
    def setup_method(self):
        self.client = GeocodingClient()

    @pytest.mark.asyncio
    async def test_empty_query(self):
        results = await self.client.search("")
        assert results == []

    @pytest.mark.asyncio
    async def test_short_query(self):
        results = await self.client.search("ab")
        # Short queries may or may not return results depending on API
        assert isinstance(results, list)


class TestTrafficClient:
    def setup_method(self):
        self.client = TrafficClient()

    def test_estimate_traffic_returns_required_fields(self):
        now = datetime(2026, 2, 20, 8, 0, tzinfo=BRT)
        result = self.client._estimate_traffic(-23.55, -46.63, now)
        assert "current_speed_kmh" in result
        assert "free_flow_speed_kmh" in result
        assert "congestion_ratio" in result
        assert "congestion_level" in result
        assert "source" in result
        assert result["source"] == "heuristic"

    def test_level_from_ratio(self):
        assert TrafficClient._level_from_ratio(0.0) == "free"
        assert TrafficClient._level_from_ratio(0.25) == "light"
        assert TrafficClient._level_from_ratio(0.45) == "moderate"
        assert TrafficClient._level_from_ratio(0.65) == "heavy"
        assert TrafficClient._level_from_ratio(0.85) == "severe"

    def test_city_proximity_factor(self):
        # São Paulo centro
        factor_sp = TrafficClient._city_proximity_factor(-23.55, -46.63)
        assert factor_sp >= 1.5
        # Meio do nada
        factor_remote = TrafficClient._city_proximity_factor(-10.0, -55.0)
        assert factor_remote <= 1.0

    @pytest.mark.asyncio
    async def test_get_traffic_flow_heuristic(self):
        result = await self.client.get_traffic_flow(-23.55, -46.63, datetime(2026, 2, 20, 8, 0, tzinfo=BRT))
        assert result["source"] == "heuristic"
        assert 0 <= result["congestion_ratio"] <= 1

    @pytest.mark.asyncio
    async def test_get_route_traffic(self):
        points = [(-23.55, -46.63), (-23.0, -45.0), (-22.91, -43.17)]
        departure = datetime(2026, 2, 20, 8, 0, tzinfo=BRT)
        result = await self.client.get_route_traffic(points, departure, 300)
        assert "summary" in result
        assert "samples" in result
        assert result["summary"]["samples_count"] == 3
