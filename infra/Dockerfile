ARG PYTHON_VERSION=3.12.8

FROM python:${PYTHON_VERSION}-bookworm AS base

# ---- Builder Stage ----
FROM base AS builder

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV UV_PROJECT_ENVIRONMENT=/usr/local
ENV PATH="${UV_PROJECT_ENVIRONMENT}/bin:$PATH"

RUN apt-get update && \
    apt-get install --no-install-recommends -y \
    build-essential \
    locales && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN locale-gen C.UTF-8

COPY --from=ghcr.io/astral-sh/uv:0.6.7 /uv /uvx /bin/

# Set working dir
WORKDIR /workspace/backend

# Copy project configuration so dependencies are known
COPY backend/pyproject.toml pyproject.toml

# Generate uv lock
RUN uv lock

# Install non-dev dependencies only
RUN uv sync --no-install-project --no-dev

# Now include, build and install project as package
COPY backend/src src
RUN uv sync --no-dev --no-editable

# ---- Production Stage ----
FROM base AS production

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV UV_PROJECT_ENVIRONMENT=/usr/local
ENV PATH="${UV_PROJECT_ENVIRONMENT}/bin:$PATH"
ENV PORT=8000

# Copy virtual env created in builder stage
# It will already contain project/app as a package
COPY --from=builder ${UV_PROJECT_ENVIRONMENT} ${UV_PROJECT_ENVIRONMENT}

# Create a user and group
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
# Create /app directory and change its ownership so the non-root user can write files
RUN mkdir -p /app && chown -R appuser:appgroup /app
# Ensure correct permissions on /app (read, write, execute)
RUN chmod -R 755 /app

WORKDIR /app

USER appuser

EXPOSE ${PORT}

CMD ["sh", "-c", "uvicorn aero.main:app --host 0.0.0.0 --port ${PORT}"]
