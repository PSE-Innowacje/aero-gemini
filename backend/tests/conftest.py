"""Pytest fixtures."""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from src.aero.main import create_app


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Async HTTP client against the ASGI app (no live server)."""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://127.0.0.1:8000/health") as ac:
        yield ac