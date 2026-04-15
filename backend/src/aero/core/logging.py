import sys
from collections.abc import Awaitable, Callable
from functools import wraps
from inspect import iscoroutinefunction, signature
from pathlib import Path
from time import perf_counter
from typing import Any
from typing import ParamSpec, TypeVar, cast

from loguru import logger
from sqlalchemy.engine.url import make_url

from aero.core.config import BACKEND_DIR, settings

P = ParamSpec("P")
R = TypeVar("R")
ContextFactory = Callable[[dict[str, Any]], dict[str, Any]]


def _patch_log_record(record: dict[str, Any]) -> None:
    extra = record["extra"]
    context_parts = [f"{key}={value!r}" for key, value in sorted(extra.items())]
    extra["context"] = " ".join(context_parts) if context_parts else "-"


def _resolve_logs_dir() -> Path:
    if settings.log_dir is not None:
        return settings.log_dir
    url = make_url(settings.database_url)
    if url.drivername == "sqlite" and url.database not in (None, ":memory:"):
        db_str = url.database
        db_path = Path(db_str)
        # POSIX paths in URL (e.g. /app/data/aero.db) must count as absolute even on Windows hosts.
        if db_path.is_absolute() or db_str.startswith("/"):
            return db_path.parent / "logs"
    return BACKEND_DIR / "logs"


def configure_logging() -> None:
    """Configure console + file logging with non-blocking sinks."""
    logger.remove()
    logger.configure(patcher=_patch_log_record)

    logs_dir = _resolve_logs_dir()
    json_log_path = logs_dir / "app.jsonl"

    logger.add(
        sys.stdout,
        level="DEBUG",
        serialize=False,
        colorize=True,
        enqueue=True,
        backtrace=True,
        diagnose=False,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level:<8}</level> | "
            "<cyan>{name}:{function}:{line}</cyan> | "
            "<level>{message}</level> | "
            "<magenta>{extra[context]}</magenta>\n"
        ),
    )
    try:
        logs_dir.mkdir(parents=True, exist_ok=True)
        test_file = logs_dir / ".write_check"
        test_file.write_text("", encoding="utf-8")
        test_file.unlink(missing_ok=True)
    except OSError:
        logger.bind(event="logging_config").warning(
            "file_log_sink_skipped_logs_dir_not_writable",
        )
    else:
        logger.add(
            json_log_path,
            level="DEBUG",
            serialize=True,
            enqueue=True,
            backtrace=True,
            diagnose=False,
            rotation="10 MB",
            retention=5,
        )


def log_duration(
    *,
    event: str,
    started_message: str | None = None,
    completed_message: str = "operation_completed",
    context: ContextFactory | None = None,
    level: str = "info",
) -> Callable[[Callable[P, R] | Callable[P, Awaitable[R]]], Callable[P, R] | Callable[P, Awaitable[R]]]:
    """Decorate a function and emit duration_ms on completion."""

    def decorator(
        func: Callable[P, R] | Callable[P, Awaitable[R]],
    ) -> Callable[P, R] | Callable[P, Awaitable[R]]:
        func_signature = signature(func)

        def _build_logger(args: tuple[Any, ...], kwargs: dict[str, Any]):
            bound_args = func_signature.bind_partial(*args, **kwargs)
            base_context = {"event": event}
            if context is not None:
                base_context.update(context(dict(bound_args.arguments)))
            operation_logger = logger.bind(**base_context)
            return operation_logger, perf_counter()

        if iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
                operation_logger, started = _build_logger(args, kwargs)
                if started_message is not None:
                    getattr(operation_logger, level)(started_message)
                result = await cast(Callable[P, Awaitable[R]], func)(*args, **kwargs)
                operation_logger.bind(
                    duration_ms=round((perf_counter() - started) * 1000, 2)
                ).info(completed_message)
                return result

            return async_wrapper

        @wraps(func)
        def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            operation_logger, started = _build_logger(args, kwargs)
            if started_message is not None:
                getattr(operation_logger, level)(started_message)
            result = cast(Callable[P, R], func)(*args, **kwargs)
            operation_logger.bind(
                duration_ms=round((perf_counter() - started) * 1000, 2)
            ).info(completed_message)
            return result

        return sync_wrapper

    return decorator

