# Frontend Documentation

## Overview

Frontend is a React + TypeScript SPA in `frontend/`, built with Vite and served by default on `http://localhost:8080`.

Main stack:
- React 18
- TypeScript
- Vite
- TanStack Query
- React Router
- Tailwind + shadcn/ui components
- Zustand for auth/session store

## Project Structure

Key directories:
- `frontend/src/pages` - page-level views
- `frontend/src/components` - reusable UI and map components
- `frontend/src/api` - API client functions
- `frontend/src/store` - app stores
- `frontend/src/lib` - shared helpers

## Environment and API Integration

Frontend API URL is controlled by:
- `VITE_API_BASE_URL`

Default local value (compose):
- `http://localhost:8000/api`

Relevant files:
- `infra/.env`
- `frontend/.env.example`
- `frontend/src/api/api.ts`

## Running Frontend

### Recommended (Compose, shared with backend)

From repository root:

```bash
cd infra
docker compose up --build backend frontend
```

Frontend URL:
- `http://localhost:8080`

### Manual run in frontend workspace

```bash
cd frontend
npm ci
npm run dev -- --host 0.0.0.0 --port 8080
```

## Build, Test, Lint

From `frontend/`:

```bash
npm run lint
npm run test
npm run build
```

Available scripts (see `frontend/package.json`):
- `dev`
- `build`
- `build:dev`
- `lint`
- `preview`
- `test`
- `test:watch`

## UI Patterns and Behavior

Implemented patterns in this project:
- list + detail dialog flows
- role-based action visibility
- status transitions triggered by action buttons
- map-based preview/detail visualization for operations and flight orders

When adding new pages:
- keep API calls in `src/api`
- keep role guards close to action rendering
- prefer immutable state updates
- keep forms validated before mutation

## Troubleshooting

- Frontend cannot call backend:
  - check `VITE_API_BASE_URL`
  - confirm backend is up on `:8000`
- HMR does not refresh:
  - ensure files are edited under `frontend/src`
  - restart service: `docker compose restart frontend`
- Dependency issues:
  - run `npm ci` again in `frontend/`
