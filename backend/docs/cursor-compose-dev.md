# Cursor + Compose Development Guide

This project is set up to develop backend and frontend together from Cursor using one devcontainer.

## Prerequisites

- Docker Desktop (or Docker Engine) with Compose v2
- Cursor with Dev Containers support

## One-time setup

1. Open the repo in Cursor.
2. Reopen `backend/` in the devcontainer (`backend/.devcontainer/devcontainer.json`).
3. Ensure compose env file exists:
   - `infra/.env` is included with safe local defaults.
   - You can reset defaults from `infra/.env.example`.

## Start both apps

From a terminal in Cursor:

```bash
cd /workspace/infra
docker compose up --build backend frontend
```

Access:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- Backend OpenAPI: `http://localhost:8000/docs`

## Frontend development in Cursor

The frontend runs in the `frontend` container with Vite hot reload.

- Edit files under `frontend/src`
- Browser updates automatically

If you want to run frontend commands manually:

```bash
cd /workspace/frontend
npm ci
npm run dev -- --host 0.0.0.0 --port 8080
```

Useful commands:

```bash
npm run lint
npm run test
npm run build
```

## API URL configuration

Frontend API base URL is environment-driven:

- `frontend/src/api/api.ts` reads `VITE_API_BASE_URL`
- fallback is `http://localhost:8000/api`

Defaults are provided in:

- `infra/.env` (compose runtime)
- `frontend/.env.example` (local frontend-only runs)

## Common compose operations

```bash
cd /workspace/infra
docker compose logs -f frontend
docker compose logs -f backend
docker compose restart frontend
docker compose down
```

## Frontend readiness checks

After starting the devcontainer and compose services, verify:

```bash
cd /workspace/infra
docker compose ps
```

Expected:

- `backend` service is `Up` on `0.0.0.0:8000->8000`
- `frontend` service is `Up` on `0.0.0.0:8080->8080`

Endpoint checks from host:

```bash
curl -I http://localhost:8080
curl -I http://localhost:8000/docs
```

Frontend test run:

```bash
cd /workspace/infra
docker compose exec frontend npm run test
```

## Troubleshooting

- Frontend does not open on `8080`:
  - run `docker compose ps`
  - confirm `frontend` container is healthy and port is mapped
- API calls fail:
  - confirm backend is up on `8000`
  - confirm `VITE_API_BASE_URL` in `infra/.env`
- HMR not updating:
  - ensure edits are inside `frontend/src`
  - restart frontend container
