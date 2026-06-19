"""Centralized, environment-driven configuration for the Kapruka Flow API.

All runtime tunables live here so deployments can be configured purely through
environment variables (12-factor style) without touching code.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import List


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int) -> int:
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _as_float(value: str | None, default: float) -> float:
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _as_list(value: str | None, default: List[str]) -> List[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    """Immutable view over the process environment."""

    def __init__(self) -> None:
        self.app_name: str = os.getenv("APP_NAME", "Kapruka Flow API")
        self.app_version: str = os.getenv("APP_VERSION", "1.0.0")
        self.environment: str = os.getenv("ENVIRONMENT", "development")

        # Kapruka MCP
        self.mcp_url: str = os.getenv("MCP_URL", "https://mcp.kapruka.com/mcp")
        self.mcp_timeout: float = _as_float(os.getenv("MCP_TIMEOUT"), 8.0)
        self.mcp_max_retries: int = _as_int(os.getenv("MCP_MAX_RETRIES"), 2)
        self.mcp_retry_backoff: float = _as_float(os.getenv("MCP_RETRY_BACKOFF"), 0.75)

        # Behaviour flags
        self.allow_simulated_checkout: bool = _as_bool(
            os.getenv("ALLOW_SIMULATED_CHECKOUT"), False
        )
        self.allow_fallback_catalog: bool = _as_bool(
            os.getenv("ALLOW_FALLBACK_CATALOG"), True
        )

        # Persistence
        default_db = os.path.join(os.path.dirname(__file__), "..", "flow.db")
        self.db_path: str = os.getenv("DB_PATH", default_db)

        # CORS — comma separated origins. "*" allowed only without credentials.
        self.allowed_origins: List[str] = _as_list(
            os.getenv("ALLOWED_ORIGINS"),
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        )

        # Logging
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
