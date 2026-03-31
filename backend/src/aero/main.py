from fastapi import FastAPI

from aero.api.router import api_router
from aero.core.database import Base, engine
from aero.models import audit, crew_member, flight_order, helicopter, landing_site, planned_operation, user  # noqa: F401


def create_app() -> FastAPI:
    app = FastAPI(title="Aero Backend", version="0.1.0")
    app.include_router(api_router, prefix="/api")
    return app


app = create_app()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
