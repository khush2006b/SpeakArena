"""Application configuration.

All settings are loaded from environment variables.
Pydantic Settings validates types and provides defaults.
The application fails at startup if required secrets are missing.
"""

from functools import lru_cache
from typing import Any, Literal

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All fields with no default are required. The application will
    raise a validation error at startup if they are missing.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # --- Application ---
    APP_NAME: str = "SpeakArena"
    APP_ENV: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    SECRET_KEY: str = Field(..., min_length=32)
    APP_VERSION: str = "1.0.0"

    # --- Database ---
    DATABASE_URL: str  # Async URL: postgresql+asyncpg://...
    DATABASE_SYNC_URL: str = ""  # Sync URL: postgresql+psycopg2://...
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 20

    # --- JWT ---
    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- Cloudflare R2 ---
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""
    R2_PRESIGNED_URL_EXPIRY_UPLOAD: int = 900
    R2_PRESIGNED_URL_EXPIRY_STREAM: int = 3600
    R2_PRESIGNED_URL_EXPIRY_DOWNLOAD: int = 1800
    # Cloudflare auth for REST API uploads (api.cloudflare.com)
    # Option A — Scoped API Token (dash.cloudflare.com/profile/api-tokens)
    CLOUDFLARE_API_TOKEN: str = ""
    # Option B — Global API Key (dash.cloudflare.com/profile → Global API Key)
    CLOUDFLARE_API_KEY: str = ""
    CLOUDFLARE_EMAIL: str = ""

    # --- Razorpay ---
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # --- Email ---
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "SpeakArena"

    # --- Sentry ---
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    # --- CORS ---
    CORS_ALLOWED_ORIGINS: Any = ["http://localhost:3000"]
    CORS_ORIGINS: Any = ""
    ALLOWED_HOSTS: Any = ""

    # --- Rate Limiting ---
    # NOTE: These are high limits suitable for development.
    # In production, set these via environment variables to tighter values.
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 200
    RATE_LIMIT_REGISTER_PER_HOUR: int = 100
    RATE_LIMIT_FORGOT_PASSWORD_PER_HOUR: int = 50
    RATE_LIMIT_DEFAULT_PER_MINUTE: int = 500

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_async_db_url(cls, v: Any) -> str:
        if isinstance(v, str) and v.strip():
            url = v.strip()
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return str(v) if v else ""

    @field_validator("DATABASE_SYNC_URL", mode="before")
    @classmethod
    def assemble_sync_db_url(cls, v: Any, info: Any) -> str:
        if isinstance(v, str) and v.strip():
            url = v.strip()
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+psycopg2://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+psycopg2://"):
                url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return url
        data = info.data if hasattr(info, "data") else {}
        db_url = data.get("DATABASE_URL", "")
        if db_url:
            return db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        return ""

    @field_validator("APP_ENV")
    @classmethod
    def validate_env(cls, value: str) -> str:
        """Ensure the environment name is one of the allowed values."""
        allowed = {"development", "staging", "production"}
        if value not in allowed:
            raise ValueError(f"APP_ENV must be one of: {allowed}")
        return value

    @property
    def is_production(self) -> bool:
        """Return True when running in production environment."""
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        """Return True when running in development environment."""
        return self.APP_ENV == "development"

    @property
    def r2_endpoint_url(self) -> str:
        """Construct the Cloudflare R2 S3-compatible endpoint URL."""
        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from environment variables with sensible production defaults."""
        import json
        default_origins = [
            "https://speakarena.com",
            "https://www.speakarena.com",
            "https://speak-arena.vercel.app",
            "https://speakarena.onrender.com",
            "http://localhost:3000",
            "http://localhost:8000",
        ]
        raw = self.CORS_ALLOWED_ORIGINS or self.CORS_ORIGINS or self.ALLOWED_HOSTS or []
        res = list(default_origins)
        if isinstance(raw, list):
            res.extend([str(item).strip().rstrip("/") for item in raw if item and item != "*"])
        elif isinstance(raw, str) and raw.strip():
            raw_str = raw.strip()
            if raw_str.startswith("[") and raw_str.endswith("]"):
                try:
                    parsed = json.loads(raw_str)
                    if isinstance(parsed, list):
                        res.extend([str(item).strip().rstrip("/") for item in parsed if item and item != "*"])
                except Exception:
                    pass
            else:
                res.extend([item.strip().rstrip("/") for item in raw_str.split(",") if item.strip() and item.strip() != "*"])
        # Remove duplicates while preserving order
        seen = set()
        out = []
        for origin in res:
            if origin not in seen:
                seen.add(origin)
                out.append(origin)
        return out


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached application settings singleton.

    Uses lru_cache to ensure Settings is only instantiated once per
    process, avoiding repeated .env file reads.

    Returns:
        Settings: The validated application settings instance.
    """
    return Settings()


# Convenience alias used throughout the application.
settings: Settings = get_settings()
