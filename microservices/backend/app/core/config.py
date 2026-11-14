"""Settings loaded from environment variables. No secrets in code."""

import os
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

    # Feedback is the only thing written to disk (type and a short note, never a file).
    feedback_path: Path = field(
        default_factory=lambda: Path(os.getenv("KAVACH_FEEDBACK_PATH", "data/feedback.jsonl"))
    )


settings = Settings()
