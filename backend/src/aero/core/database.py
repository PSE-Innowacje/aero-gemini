from collections.abc import Generator
from time import perf_counter

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from loguru import logger

from aero.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


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
