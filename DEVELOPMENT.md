# Development Setup (Cursor + Docker Compose)

This repository supports a single workflow for developing backend and frontend together in Cursor.

## Recommended Workflow

1. Open the repo in Cursor.
2. Reopen `backend/` in Dev Container (`backend/.devcontainer/devcontainer.json`).
3. Start both services from compose:

```bash
cd /workspace/infra
docker compose up --build backend frontend
```

Endpoints:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`

## Frontend Development Commands

Inside Cursor terminal:

```bash
cd /workspace/frontend
npm ci
npm run dev -- --host 0.0.0.0 --port 8080
```

Other useful commands:

```bash
npm run lint
npm run test
npm run build
```

## Environment Configuration

- Compose/runtime defaults: `infra/.env` (template: `infra/.env.example`)
- Frontend env template: `frontend/.env.example`
- Frontend API URL variable: `VITE_API_BASE_URL`

## More Detailed Guide

For full troubleshooting and operational notes, see:

- `backend/docs/cursor-compose-dev.md`
