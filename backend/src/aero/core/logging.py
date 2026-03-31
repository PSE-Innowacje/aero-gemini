import sys
from pathlib import Path
from typing import Any

from loguru import logger


def _patch_log_record(record: dict[str, Any]) -> None:
    extra = record["extra"]
    context_parts = [f"{key}={value!r}" for key, value in sorted(extra.items())]
    extra["context"] = " ".join(context_parts) if context_parts else "-"


def configure_logging() -> None:
    """Configure console + file logging with non-blocking sinks."""
    logger.remove()
    logger.configure(patcher=_patch_log_record)

    logs_dir = Path(__file__).resolve().parents[3] / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
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

