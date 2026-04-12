# Backend Documentation

## Overview

Backend is a FastAPI application located in `backend/src/aero` and exposed by default on `http://localhost:8000`.

Main characteristics:
- Python `3.12.8` (managed in `backend/pyproject.toml`)
- FastAPI + SQLAlchemy
- JWT-based authentication
- SQLite database in development (`backend/aero.db`)
- OpenAPI docs at `/docs`

## Project Structure

Key directories:
- `backend/src/aero/api` - API routers and dependency wiring
- `backend/src/aero/services` - business logic
- `backend/src/aero/models` - SQLAlchemy models and enums
- `backend/src/aero/core` - config, database, logging
- `backend/tests` - test suite
- `backend/seed.py` - seed script

## Runtime and Configuration

Configuration is read from environment variables with `AERO_` prefix. In local Docker Compose flow values come from `infra/.env`.

Important variables:
- `AERO_APP_NAME`
- `AERO_JWT_SECRET`
- `AERO_JWT_ALGORITHM`
- `AERO_ACCESS_TOKEN_EXPIRE_MINUTES`
- `AERO_DATABASE_URL`

Security note:
- Do not use the default development JWT secret outside local development.

## Running Backend

### Recommended (Compose, shared with frontend)

From repository root:

```bash
cd infra
docker compose up --build backend frontend
```

Backend endpoints:
- API root: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

### Backend-only inside container

The backend service starts with:

```bash
cd /workspace/backend
uv sync
uv run uvicorn aero.main:app --host 0.0.0.0 --port 8000
```

## Database and Seeding

Development uses SQLite by default (`AERO_DATABASE_URL=sqlite:////workspace/backend/aero.db`).

Seed data:
- Script: `backend/seed.py`
- Profile selector: `SEED_PROFILE` in `infra/.env` (`minimal` or `full`)

Example execution (inside backend container):

```bash
cd /workspace/backend
uv run python seed.py
```

## Testing and Quality

Inside backend environment:

```bash
cd /workspace/backend
uv run pytest
uv run ruff check .
uv run mypy src
```

Tooling configured in `backend/pyproject.toml`:
- `pytest`
- `ruff`
- `mypy`

## Logging and Observability

Request middleware adds:
- request ID (`X-Request-ID`)
- structured request lifecycle logs
- response timing

Health check endpoint:
- `GET /health` returns `{"status":"ok"}`

## Common Troubleshooting

- Backend not starting:
  - verify `AERO_DATABASE_URL` and `AERO_JWT_SECRET` in `infra/.env`
  - inspect logs: `docker compose logs -f backend`
- 401/403 authorization issues:
  - verify JWT secret consistency between token issuer and API
  - verify role mapping in seed data
- Schema mismatch in local DB:
  - remove local dev DB and reseed in non-production scenarios
