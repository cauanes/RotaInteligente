"""Testes unitários para serviços (route_service, holiday_service)."""

import pytest
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.services.route_service import RouteService
from app.services.holiday_service import (
    _easter,
    get_all_holidays,
    get_movable_holidays,
    is_holiday,
    is_holiday_or_extended,
    get_flow_pattern,
    predict_best_departure,
    get_historical_pattern,
)
from app.schemas import RainRisk

BRT = ZoneInfo("America/Sao_Paulo")


class TestRouteService:
    def setup_method(self):
        self.service = RouteService()

    def test_build_segments_empty(self):
        assert self.service._build_segments([]) == []

    def test_build_segments_single(self):
        samples = [{"lat": -23.55, "lon": -46.63, "rain_risk": RainRisk.NONE}]
        assert self.service._build_segments(samples) == []

    def test_build_segments_uniform(self):
        samples = [
            {"lat": -23.55, "lon": -46.63, "rain_risk": RainRisk.LOW},
            {"lat": -23.0, "lon": -45.0, "rain_risk": RainRisk.LOW},
            {"lat": -22.91, "lon": -43.17, "rain_risk": RainRisk.LOW},
        ]
        segs = self.service._build_segments(samples)
        assert len(segs) == 1
        assert segs[0]["rain_risk"] == RainRisk.LOW

    def test_build_summary(self):
        route_data = {"distance_km": 430, "duration_min": 320}
        samples = [
            {"precip_prob": 10, "rain_risk": RainRisk.NONE},
            {"precip_prob": 50, "rain_risk": RainRisk.MODERATE},
            {"precip_prob": 30, "rain_risk": RainRisk.LOW},
        ]
        summary = self.service._build_summary(route_data, samples, ["open-meteo"])
        assert summary["distance_km"] == 430
        assert summary["overall_risk"] == RainRisk.MODERATE
        assert summary["confidence"] == 0.9


class TestHolidayService:
    def test_easter_2026(self):
        easter = _easter(2026)
        assert easter == date(2026, 4, 5)

    def test_easter_2025(self):
        easter = _easter(2025)
        assert easter == date(2025, 4, 20)

    def test_movable_holidays_include_carnaval(self):
        holidays = get_movable_holidays(2026)
        carnaval_dates = [d for d, n in holidays.items() if "Carnaval" in n]
        assert len(carnaval_dates) >= 2

    def test_all_holidays_has_fixed_and_movable(self):
        holidays = get_all_holidays(2026)
        names = list(holidays.values())
        assert "Natal" in names
        assert any("Carnaval" in n for n in names)
        assert any("Páscoa" in n for n in names)
        assert any("Corpus" in n for n in names)

    def test_is_holiday_natal(self):
        is_hol, name = is_holiday(date(2026, 12, 25))
        assert is_hol is True
        assert name == "Natal"

    def test_is_holiday_normal_day(self):
        is_hol, name = is_holiday(date(2026, 3, 15))
        assert is_hol is False
        assert name is None

    def test_is_holiday_or_extended_ponte(self):
        # 2026-04-21 é Tiradentes (terça)
        # 2026-04-20 é segunda → ponte!
        assert is_holiday_or_extended(date(2026, 4, 21)) is True  # feriado
        assert is_holiday_or_extended(date(2026, 4, 20)) is True  # ponte (segunda antes de terça feriado)

    def test_flow_pattern_weekday(self):
        pattern = get_flow_pattern(date(2026, 2, 20))  # Sexta
        assert isinstance(pattern, dict)
        assert len(pattern) == 24
        # Pico da manhã deve ser maior que madrugada
        assert pattern[8] > pattern[3]

    def test_flow_pattern_holiday(self):
        pattern = get_flow_pattern(date(2026, 12, 25))  # Natal
        assert isinstance(pattern, dict)
        assert len(pattern) == 24

    def test_predict_best_departure(self):
        result = predict_best_departure(
            -23.55, -46.63, -22.91, -43.17,
            date(2026, 2, 20), 300,
        )
        assert "best_departures" in result
        assert "worst_departures" in result
        assert "recommendation" in result
        assert len(result["best_departures"]) == 3
        assert len(result["worst_departures"]) == 3
        # Melhor horário deve ter score menor que pior
        assert result["best_departures"][0]["score"] <= result["worst_departures"][0]["score"]

    def test_predict_best_departure_holiday(self):
        result = predict_best_departure(
            -23.55, -46.63, -22.91, -43.17,
            date(2026, 12, 25), 300,
        )
        assert result["is_holiday"] is True
        assert result["holiday_name"] == "Natal"
        assert "feriado" in result["day_type"]

    def test_historical_pattern(self):
        result = get_historical_pattern(-23.55, -46.63, date(2026, 2, 20))
        assert "hourly_pattern" in result
        assert "peak_hours" in result
        assert "quiet_hours" in result
        assert len(result["hourly_pattern"]) == 24
