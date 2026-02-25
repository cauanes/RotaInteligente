"""
Cliente HTTP assíncrono reutilizável.

Por que httpx?
  - API compatível com requests, mas com suporte nativo a async/await
  - Connection pooling, HTTP/2, timeouts granulares
  - Ideal para múltiplas chamadas paralelas a APIs externas
"""

import httpx
from typing import Any, Optional

from app.core.config import get_settings

settings = get_settings()


class HTTPClient:
    """Context-manager que fornece um httpx.AsyncClient configurado."""

    def __init__(self, timeout: int | None = None) -> None:
        self._timeout = timeout or settings.HTTP_TIMEOUT
        self.client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> "HTTPClient":
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self._timeout),
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=100,
            ),
            headers={"User-Agent": f"{settings.APP_NAME}/{settings.APP_VERSION}"},
        )
        return self

    async def __aexit__(self, *exc: Any) -> None:
        if self.client:
            await self.client.aclose()

    async def get(
        self,
        url: str,
        params: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        """GET com tratamento de erros padronizado."""
        assert self.client, "Use dentro de 'async with HTTPClient() as c:'"
        resp = await self.client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def post(
        self,
        url: str,
        json: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        assert self.client, "Use dentro de 'async with HTTPClient() as c:'"
        resp = await self.client.post(url, json=json, headers=headers)
        resp.raise_for_status()
        return resp.json()
