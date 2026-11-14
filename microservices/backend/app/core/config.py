"""Settings loaded from environment variables. No secrets in code."""

import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # reads backend/.env when it exists (never committed)


def _split(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _optional(name: str) -> str | None:
    return os.getenv(name) or None


@dataclass(frozen=True)
class Settings:
    env: str = field(default_factory=lambda: os.getenv("KAVACH_ENV", "dev"))
    cors_origins: list[str] = field(
        default_factory=lambda: _split(
            os.getenv("KAVACH_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        )
    )

    # Uploads and the 15-minute rule.
    max_upload_bytes: int = 10 * 1024 * 1024
    max_text_chars: int = 20_000
    scan_ttl_seconds: int = 15 * 60

    # OCR (Tesseract). Both paths are optional: leave unset when Tesseract is on PATH.
    tesseract_cmd: str | None = field(default_factory=lambda: _optional("KAVACH_TESSERACT_CMD"))
    tessdata_dir: str | None = field(default_factory=lambda: _optional("KAVACH_TESSDATA_DIR"))
    ocr_languages: str = "eng+hin"  # English first: the order matters (hin first drops digits)
    ocr_timeout_seconds: int = 30
    max_pdf_pages: int = 5
    max_image_pixels: int = 40_000_000
    workers: int = 2

    # What is written to disk: only feedback and consent records, never a file or a result.
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("KAVACH_DATA_DIR", "data")))
    # Signs download links and hides IP addresses in the consent log. Set a fixed value in
    # production, otherwise a new one is made at every start (links and IP hashes then change).
    secret: bytes = field(
        default_factory=lambda: (os.getenv("KAVACH_SECRET") or secrets.token_hex(32)).encode()
    )

    # The consent text the website shows. A record for any other version is refused.
    consent_version: str = "2026-11-v1"

    # Evidence summary (PDF) download links, and the sweep that deletes expired scans.
    download_link_seconds: int = 5 * 60
    purge_interval_seconds: float = 60

    # Abuse limits: tries per person (by hashed IP address) in a time window, for each action.
    rate_limit: int = 20
    rate_window_seconds: int = 10 * 60

    @property
    def feedback_path(self) -> Path:
        return self.data_dir / "feedback.jsonl"

    @property
    def consent_path(self) -> Path:
        return self.data_dir / "consent.jsonl"

    @property
    def max_body_bytes(self) -> int:
        return self.max_upload_bytes + 64 * 1024  # a file plus the form around it


settings = Settings()
