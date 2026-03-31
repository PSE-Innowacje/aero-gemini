# Frontend Test Checklist (Devcontainer + Compose)

This checklist verifies that frontend development is ready when using the backend devcontainer (`backend/.devcontainer/devcontainer.json`) and shared compose file (`infra/docker-compose.yml`).

## 1) Start environment

Open the repository in Cursor and reopen `backend/` in the devcontainer.

Compose services should start with:

```bash
cd /workspace/infra
docker compose up --build backend frontend
```

## 2) Check containers

```bash
cd /workspace/infra
docker compose ps
```

Expected:

- `backend` is `Up` with `0.0.0.0:8000->8000`
- `frontend` is `Up` with `0.0.0.0:8080->8080`

## 3) Check endpoints from host

```bash
curl -I http://localhost:8080
curl -I http://localhost:8000/docs
```

Expected result:

- both endpoints return HTTP `200`

## 4) Run frontend tests

```bash
cd /workspace/infra
docker compose exec frontend npm run test
```

Expected result:

- vitest run completes successfully

## 5) Optional validation

```bash
cd /workspace/infra
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

Use this when validating changes before merge.
