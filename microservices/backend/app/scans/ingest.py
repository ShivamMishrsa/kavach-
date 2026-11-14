"""Checks what was uploaded, and fingerprints it before anything else touches it."""

import hashlib
import re
from datetime import datetime
from typing import Literal

from fastapi import UploadFile

from app.models import EvidenceHash

FileKind = Literal["image", "pdf"]

# The first bytes of each allowed type. The browser's stated type is not trusted.
_SIGNATURES: tuple[tuple[bytes, FileKind], ...] = (
    (b"\xff\xd8\xff", "image"),  # JPEG
    (b"\x89PNG\r\n\x1a\n", "image"),  # PNG
    (b"%PDF-", "pdf"),
)
MAX_NAME_LENGTH = 100


def detect_file_kind(data: bytes) -> FileKind | None:
    for signature, kind in _SIGNATURES:
        if data.startswith(signature):
            return kind
    return None


async def read_limited(file: UploadFile, limit: int) -> bytes | None:
    """The file's bytes, or None when it is larger than `limit`."""
    data = await file.read(limit + 1)
    return None if len(data) > limit else data


def safe_name(filename: str | None) -> str:
    """Only the file's own name: no folders, no control or text-direction characters, not too long.

    A right-to-left override can make "invoice<override>gnp.exe" read as "invoiceexe.png", so those
    characters are removed.
    """
    name = (filename or "").replace("\\", "/").split("/")[-1]
    name = re.sub(r"[\x00-\x1f\x7f‎‏‪-‮⁦-⁩]", "", name)
    return name.strip()[:MAX_NAME_LENGTH] or "upload"


def fingerprint(name: str, data: bytes, captured_at: datetime) -> EvidenceHash:
    return EvidenceHash(name=name, sha256=hashlib.sha256(data).hexdigest(), captured_at=captured_at)
