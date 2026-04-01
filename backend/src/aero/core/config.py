from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[3]
DEFAULT_DB_PATH = BACKEND_DIR / "aero.db"


class Settings(BaseSettings):
    app_name: str = "Aero Backend"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    cors_allow_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]

    model_config = SettingsConfigDict(env_prefix="AERO_", env_file=".env", extra="ignore")


settings = Settings()
