"""
Compatibilidade: redireciona para holiday_service.

Mantido apenas para não quebrar imports antigos.
"""

from app.services.holiday_service import get_historical_pattern as get_traffic_history

__all__ = ["get_traffic_history"]
