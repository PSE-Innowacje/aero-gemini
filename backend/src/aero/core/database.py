from collections.abc import Generator
from time import perf_counter

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from loguru import logger

from aero.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@event.listens_for(engine, "connect")
def _configure_sqlite_spatialite(dbapi_connection, _connection_record) -> None:
    if not settings.database_url.startswith("sqlite"):
        return

    if not hasattr(dbapi_connection, "enable_load_extension"):
        return

    try:
        dbapi_connection.enable_load_extension(True)
    except Exception:  # noqa: BLE001
        logger.bind(event="database", component="spatialite").warning("spatialite_extension_loading_not_supported")
        return

    loaded = False
    for extension_name in ("mod_spatialite", "libspatialite"):
        try:
            dbapi_connection.load_extension(extension_name)
            loaded = True
            logger.bind(event="database", component="spatialite", extension=extension_name).info(
                "spatialite_extension_loaded"
            )
            break
        except Exception:  # noqa: BLE001
            continue
    dbapi_connection.enable_load_extension(False)

    if not loaded:
        logger.bind(event="database", component="spatialite").warning("spatialite_extension_unavailable")
        return

    try:
        dbapi_connection.execute("SELECT InitSpatialMetaData(1);")
    except Exception:  # noqa: BLE001
        # Metadata may already be initialized on existing databases.
        pass


def get_db() -> Generator[Session, None, None]:
    started = perf_counter()
    db = SessionLocal()
    logger.bind(event="db_session", session_id=id(db)).debug("session_opened")
    try:
        yield db
    except Exception:  # noqa: BLE001
        logger.bind(event="db_session", session_id=id(db)).exception("session_failed")
        raise
    finally:
        db.close()
        logger.bind(
            event="db_session",
            session_id=id(db),
            duration_ms=round((perf_counter() - started) * 1000, 2),
        ).debug("session_closed")
