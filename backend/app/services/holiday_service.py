"""
Serviço de feriados brasileiros e previsão de melhor horário de viagem.

Inclui:
  - Feriados fixos nacionais
  - Feriados móveis (Carnaval, Páscoa, Corpus Christi)
  - Detecção de feriado prolongado (ponte)
  - Padrões históricos de fluxo rodoviário
  - Predição do melhor horário de partida

Dados históricos simulados baseados em padrões reais do DER-SP / ANTT.
Em produção, substituir por dados da API do DNIT ou concessionárias.
"""

from datetime import date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

BRT = ZoneInfo("America/Sao_Paulo")


# ═══════════════════════════════════════════════════════════════
# Calendário de feriados nacionais brasileiros
# ═══════════════════════════════════════════════════════════════

FIXED_HOLIDAYS: dict[str, str] = {
    "01-01": "Confraternização Universal",
    "04-21": "Tiradentes",
    "05-01": "Dia do Trabalho",
    "09-07": "Independência do Brasil",
    "10-12": "Nossa Senhora Aparecida",
    "11-02": "Finados",
    "11-15": "Proclamação da República",
    "12-25": "Natal",
}


def _easter(year: int) -> date:
    """Calcula domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def get_movable_holidays(year: int) -> dict[date, str]:
    """Retorna feriados móveis para o ano especificado."""
    easter = _easter(year)
    return {
        easter - timedelta(days=47): "Carnaval (terça)",
        easter - timedelta(days=48): "Carnaval (segunda)",
        easter - timedelta(days=49): "Carnaval (domingo)",
        easter - timedelta(days=2): "Sexta-feira Santa",
        easter: "Páscoa",
        easter + timedelta(days=60): "Corpus Christi",
    }


def get_all_holidays(year: int) -> dict[date, str]:
    """Retorna todos os feriados (fixos + móveis) para o ano."""
    holidays: dict[date, str] = {}
    # Fixos
    for md, name in FIXED_HOLIDAYS.items():
        month, day = map(int, md.split("-"))
        holidays[date(year, month, day)] = name
    # Móveis
    holidays.update(get_movable_holidays(year))
    return holidays


def is_holiday(d: date) -> tuple[bool, Optional[str]]:
    """Verifica se uma data é feriado. Retorna (True, nome) ou (False, None)."""
    holidays = get_all_holidays(d.year)
    name = holidays.get(d)
    return (True, name) if name else (False, None)


def is_holiday_or_extended(d: date) -> bool:
    """
    Verifica se a data faz parte de um feriado prolongado.
    Considera: dia do feriado + dia-ponte (sexta/segunda entre feriado e fim de semana).
    """
    is_hol, _ = is_holiday(d)
    if is_hol:
        return True

    # Verifica se é uma ponte
    weekday = d.weekday()
    if weekday == 0:  # Segunda — verifica se terça é feriado
        is_hol_tue, _ = is_holiday(d + timedelta(days=1))
        if is_hol_tue:
            return True
    elif weekday == 4:  # Sexta — verifica se quinta é feriado
        is_hol_thu, _ = is_holiday(d - timedelta(days=1))
        if is_hol_thu:
            return True

    return False


# ═══════════════════════════════════════════════════════════════
# Padrões históricos de fluxo rodoviário
# ═══════════════════════════════════════════════════════════════

# Volume relativo por hora (0-23h), normalizado de 0.0 a 1.0
# Baseado em dados de praças de pedágio do DER-SP

WEEKDAY_PATTERN = {
    0: 0.05, 1: 0.03, 2: 0.02, 3: 0.02, 4: 0.04, 5: 0.15,
    6: 0.40, 7: 0.75, 8: 0.85, 9: 0.65, 10: 0.50, 11: 0.55,
    12: 0.60, 13: 0.55, 14: 0.50, 15: 0.55, 16: 0.70, 17: 0.90,
    18: 1.00, 19: 0.80, 20: 0.50, 21: 0.30, 22: 0.15, 23: 0.08,
}

WEEKEND_PATTERN = {
    0: 0.05, 1: 0.03, 2: 0.02, 3: 0.02, 4: 0.03, 5: 0.08,
    6: 0.20, 7: 0.35, 8: 0.55, 9: 0.70, 10: 0.80, 11: 0.75,
    12: 0.65, 13: 0.60, 14: 0.70, 15: 0.80, 16: 0.90, 17: 1.00,
    18: 0.85, 19: 0.65, 20: 0.45, 21: 0.30, 22: 0.15, 23: 0.08,
}

# Feriado prolongado — padrão de SAÍDA (véspera e manhã do feriado)
HOLIDAY_EXIT_PATTERN = {
    0: 0.05, 1: 0.03, 2: 0.02, 3: 0.02, 4: 0.05, 5: 0.20,
    6: 0.50, 7: 0.80, 8: 0.95, 9: 1.00, 10: 0.90, 11: 0.80,
    12: 0.70, 13: 0.75, 14: 0.85, 15: 0.95, 16: 1.00, 17: 0.90,
    18: 0.70, 19: 0.45, 20: 0.30, 21: 0.20, 22: 0.12, 23: 0.07,
}

# Feriado prolongado — padrão de RETORNO (último dia)
HOLIDAY_RETURN_PATTERN = {
    0: 0.05, 1: 0.03, 2: 0.02, 3: 0.02, 4: 0.03, 5: 0.10,
    6: 0.25, 7: 0.40, 8: 0.55, 9: 0.65, 10: 0.70, 11: 0.65,
    12: 0.60, 13: 0.65, 14: 0.80, 15: 0.95, 16: 1.00, 17: 1.00,
    18: 0.95, 19: 0.85, 20: 0.65, 21: 0.45, 22: 0.25, 23: 0.12,
}

# Rodovias brasileiras com mais tráfego interestadual
MAJOR_ROUTES = {
    "SP-RJ": {
        "name": "Via Dutra / Rio-Santos",
        "cities": [
            ("São Paulo", -23.55, -46.63),
            ("Rio de Janeiro", -22.91, -43.17),
        ],
        "holidays_factor": 1.8,  # Trânsito quase dobra em feriados
    },
    "SP-Litoral": {
        "name": "Anchieta-Imigrantes / Mogi-Bertioga",
        "cities": [
            ("São Paulo", -23.55, -46.63),
            ("Santos", -23.96, -46.33),
        ],
        "holidays_factor": 2.2,
    },
    "SP-Interior": {
        "name": "Bandeirantes / Anhanguera",
        "cities": [
            ("São Paulo", -23.55, -46.63),
            ("Campinas", -22.91, -47.06),
        ],
        "holidays_factor": 1.5,
    },
    "SP-Curitiba": {
        "name": "Régis Bittencourt",
        "cities": [
            ("São Paulo", -23.55, -46.63),
            ("Curitiba", -25.43, -49.27),
        ],
        "holidays_factor": 1.7,
    },
    "BH-RJ": {
        "name": "BR-040",
        "cities": [
            ("Belo Horizonte", -19.92, -43.94),
            ("Rio de Janeiro", -22.91, -43.17),
        ],
        "holidays_factor": 1.6,
    },
}


# ═══════════════════════════════════════════════════════════════
# Serviço de predição
# ═══════════════════════════════════════════════════════════════

def get_flow_pattern(d: date) -> dict[int, float]:
    """Retorna o padrão de volume horário para uma data."""
    is_hol, _ = is_holiday(d)
    is_ext = is_holiday_or_extended(d)

    if is_hol or is_ext:
        # Verifica se é véspera/primeiro dia (saída) ou último dia (retorno)
        next_day_hol, _ = is_holiday(d + timedelta(days=1))
        if next_day_hol:
            return HOLIDAY_EXIT_PATTERN
        return HOLIDAY_RETURN_PATTERN

    if d.weekday() >= 5:
        return WEEKEND_PATTERN

    return WEEKDAY_PATTERN


def predict_best_departure(
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
    travel_date: date,
    base_duration_min: float = 300,
) -> dict[str, Any]:
    """
    Prediz os melhores horários de partida para uma viagem.

    Retorna ranking de horários com scores (quanto menor, melhor).
    Considera: volume de trânsito ao longo da viagem inteira.
    """
    pattern = get_flow_pattern(travel_date)
    is_hol, hol_name = is_holiday(travel_date)
    is_ext = is_holiday_or_extended(travel_date)

    # Para cada hora de partida possível (0-23h)
    hourly_scores: list[dict[str, Any]] = []

    for departure_hour in range(24):
        # Calcula o score médio de trânsito durante toda a viagem
        duration_hours = base_duration_min / 60
        samples = max(4, int(duration_hours * 2))
        total_flow = 0.0

        for i in range(samples):
            progress = i / max(samples - 1, 1)
            travel_hour = (departure_hour + progress * duration_hours) % 24
            # Interpola entre horas inteiras
            h_floor = int(travel_hour) % 24
            h_ceil = (h_floor + 1) % 24
            frac = travel_hour - int(travel_hour)
            flow_val = pattern[h_floor] * (1 - frac) + pattern[h_ceil] * frac
            total_flow += flow_val

        avg_flow = total_flow / samples

        # Penalidade: viajando de madrugada é perigoso
        safety_penalty = 0
        if departure_hour < 5:
            safety_penalty = 0.3
        elif departure_hour >= 23:
            safety_penalty = 0.2

        score = avg_flow + safety_penalty

        # Estima atraso adicional
        extra_delay_min = round(avg_flow * base_duration_min * 0.15, 0)
        estimated_total = base_duration_min + extra_delay_min
        arrival_hour = departure_hour + estimated_total / 60

        hourly_scores.append({
            "departure_hour": departure_hour,
            "departure_label": f"{departure_hour:02d}:00",
            "score": round(score, 3),
            "avg_flow_ratio": round(avg_flow, 3),
            "estimated_extra_delay_min": int(extra_delay_min),
            "estimated_total_min": int(estimated_total),
            "estimated_arrival": f"{int(arrival_hour) % 24:02d}:{int((arrival_hour % 1) * 60):02d}",
            "safety": "low" if departure_hour < 5 or departure_hour >= 23 else "ok",
        })

    # Ordena por score (menor = melhor)
    hourly_scores.sort(key=lambda x: x["score"])
    best = hourly_scores[:3]
    worst = sorted(hourly_scores, key=lambda x: x["score"], reverse=True)[:3]

    # Resumo em linguagem natural
    best_hours = ", ".join(h["departure_label"] for h in best)
    avoid_hours = ", ".join(h["departure_label"] for h in worst)

    day_type = "feriado" if is_hol else ("feriado prolongado" if is_ext else
                "fim de semana" if travel_date.weekday() >= 5 else "dia útil")

    return {
        "date": travel_date.isoformat(),
        "day_type": day_type,
        "is_holiday": is_hol,
        "holiday_name": hol_name,
        "is_extended_holiday": is_ext,
        "base_duration_minutes": int(base_duration_min),
        "best_departures": best,
        "worst_departures": worst,
        "all_hours": hourly_scores,
        "recommendation": (
            f"📅 {day_type.title()}"
            + (f" ({hol_name})" if hol_name else "")
            + f". Melhores horários: {best_hours}."
            + f" Evite sair às {avoid_hours}."
        ),
        "upcoming_holidays": _get_upcoming_holidays(travel_date, days_ahead=60),
    }


def _get_upcoming_holidays(from_date: date, days_ahead: int = 60) -> list[dict]:
    """Lista próximos feriados com indicador de prolongamento."""
    holidays = get_all_holidays(from_date.year)
    # Inclui próximo ano se estiver perto do fim
    if from_date.month >= 11:
        holidays.update(get_all_holidays(from_date.year + 1))

    upcoming = []
    for d, name in sorted(holidays.items()):
        if from_date <= d <= from_date + timedelta(days=days_ahead):
            weekday_name = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][d.weekday()]
            is_ext = is_holiday_or_extended(d)
            upcoming.append({
                "date": d.isoformat(),
                "name": name,
                "weekday": weekday_name,
                "is_extended": is_ext,
                "expected_flow": "very_high" if is_ext else "high",
            })

    return upcoming


def get_historical_pattern(
    lat: float,
    lon: float,
    target_date: date,
) -> dict[str, Any]:
    """
    Retorna padrão histórico de trânsito para uma localização e data.
    Baseado em dados simulados de praças de pedágio.
    """
    pattern = get_flow_pattern(target_date)
    is_hol, hol_name = is_holiday(target_date)
    is_ext = is_holiday_or_extended(target_date)
    weekday = target_date.weekday()

    day_type = "feriado" if is_hol else ("feriado prolongado" if is_ext else
                "fim de semana" if weekday >= 5 else "dia útil")

    # Horários de pico
    sorted_hours = sorted(pattern.items(), key=lambda x: x[1], reverse=True)
    peak_hours = [f"{h:02d}:00" for h, _ in sorted_hours[:4]]
    quiet_hours = [f"{h:02d}:00" for h, _ in sorted_hours[-4:]]

    return {
        "location": {"lat": lat, "lon": lon},
        "date": target_date.isoformat(),
        "day_type": day_type,
        "is_holiday": is_hol,
        "holiday_name": hol_name,
        "is_extended_holiday": is_ext,
        "hourly_pattern": {f"{h:02d}:00": round(v, 3) for h, v in sorted(pattern.items())},
        "peak_hours": peak_hours,
        "quiet_hours": quiet_hours,
        "data_source": "historical_model",
    }
