# Deployment Documentation

## Scope

Current repository ships a Docker Compose-based deployment flow optimized for local development and demo environments.

Primary deployment artifact:
- `infra/docker-compose.yml`

## Services

Compose starts two services:

1. `backend`
- Built from `infra/Dockerfile` (target: `builder`)
- Exposes `8000:8000`
- Starts FastAPI with Uvicorn

2. `frontend`
- Uses `node:22-bookworm`
- Exposes `8080:8080`
- Starts Vite dev server with API base URL from env

Persistent/dev volume:
- `frontend_node_modules`

## Environment Configuration

Environment file:
- `infra/.env` (template: `infra/.env.example`)

Minimum required values:
- `COMPOSE_PROJECT_NAME`
- `AERO_JWT_SECRET`
- `AERO_DATABASE_URL`
- `VITE_API_BASE_URL`

Production hardening recommendations:
- use strong `AERO_JWT_SECRET` (32+ chars)
- externalize DB from SQLite to managed RDBMS
- pin explicit CORS origins
- terminate TLS at reverse proxy

## Deployment Steps (Compose)

From repository root:

```bash
cd infra
docker compose up --build -d backend frontend
```

Verify:

```bash
docker compose ps
curl -I http://localhost:8080
curl -I http://localhost:8000/docs
curl -I http://localhost:8000/health
```

Expected:
- frontend returns HTTP `200`
- backend docs returns HTTP `200`
- health endpoint returns HTTP `200`

## Logs and Operations

Useful commands:

```bash
cd infra
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
docker compose restart frontend
docker compose down
```

## Release Checklist

Before go-live:
- replace all development secrets
- configure non-development database
- verify CORS allowlist
- run backend tests and lint
- run frontend tests and build
- perform smoke tests for:
  - login
  - operations flow
  - flight orders flow
  - role-based access restrictions

## Rollback

For compose-based environments:
1. stop current stack (`docker compose down`)
2. checkout previous stable revision
3. start stack again (`docker compose up --build -d`)

Keep database backup strategy aligned with chosen DB engine.
