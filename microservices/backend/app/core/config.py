"""Settings loaded from environment variables. No secrets in code."""

import os
from dataclasses import dataclass, field


def _split(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    env: str = field(default_factory=lambda: os.getenv("KAVACH_ENV", "dev"))
    cors_origins: list[str] = field(
        default_factory=lambda: _split(
            os.getenv("KAVACH_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        )
    )


settings = Settings()
