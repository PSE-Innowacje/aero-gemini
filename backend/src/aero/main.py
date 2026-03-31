from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI
from fastapi.requests import Request
from loguru import logger

from aero.api.router import api_router
from aero.core.database import Base, engine
from aero.core.logging import configure_logging
from aero.models import audit, crew_member, flight_order, helicopter, landing_site, planned_operation, user  # noqa: F401


async def request_observability_middleware(request: Request, call_next):
    started = perf_counter()
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    request_logger = logger.bind(
        event="http_request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )
    request_logger.info("request_started")
    try:
        response = await call_next(request)
    except Exception:  # noqa: BLE001
        request_logger.bind(duration_ms=round((perf_counter() - started) * 1000, 2)).exception(
            "request_failed"
        )
        raise

    duration_ms = round((perf_counter() - started) * 1000, 2)
    request_logger.bind(status_code=response.status_code, duration_ms=duration_ms).info("request_completed")
    response.headers["X-Request-ID"] = request_id
    return response


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title="Aero Backend", version="0.1.0")
    logger.bind(event="app_bootstrap", app=app.title, version=app.version).info("application_created")
    app.middleware("http")(request_observability_middleware)
    app.include_router(api_router, prefix="/api")
    return app


app = create_app()


@app.get("/health")
def health_check() -> dict[str, str]:
    logger.bind(event="health", status="ok").debug("health_check_called")
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    started = perf_counter()
    logger.bind(event="startup").info("startup_begin")
    Base.metadata.create_all(bind=engine)
    logger.bind(event="startup", duration_ms=round((perf_counter() - started) * 1000, 2)).info(
        "startup_complete"
    )
