"""
Fixtures compartilhadas entre todos os testes.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    """
    TestClient assíncrono para testes de integração.
    Usa httpx.AsyncClient com ASGITransport — não precisa de servidor real.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
