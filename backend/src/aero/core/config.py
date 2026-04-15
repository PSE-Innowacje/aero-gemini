from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[3]
DEFAULT_DB_PATH = BACKEND_DIR / "aero.db"


class Settings(BaseSettings):
    app_name: str = "Aero Backend"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    # JSONL file logs; default is <SQLite file parent>/logs (e.g. /app/data/logs in Docker).
    log_dir: Path | None = None
    # When False, /docs, /redoc, and /openapi.json are disabled (recommended in production).
    expose_openapi: bool = True
    cors_allow_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]

    model_config = SettingsConfigDict(env_prefix="AERO_", env_file=".env", extra="ignore")

    @field_validator("log_dir", mode="before")
    @classmethod
    def _empty_log_dir_as_none(cls, value: object) -> Path | None:
        if value is None or value == "":
            return None
        return Path(value) if isinstance(value, str) else value


settings = Settings()
