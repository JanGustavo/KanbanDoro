from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./kanbandoro.db"
    jwt_secret: str = "development-only-change-before-deploy"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    cors_origins: list[str] = ["http://localhost:5173"]
    google_client_id: str = ""
    google_client_secret: str = ""
    google_extension_id: str = ""
    google_extension_ids: list[str] = []
    google_token_encryption_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
