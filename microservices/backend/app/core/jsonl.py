"""The little that is written to disk: one JSON line per feedback or consent record."""

import json
import os
import threading
from datetime import datetime
from pathlib import Path

_LOCK = threading.Lock()


def append_record(path: Path, record: dict[str, object]) -> None:
    line = json.dumps(record, ensure_ascii=False)
    with _LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as log:
            log.write(line + "\n")


def _is_recent(line: str, cutoff: datetime) -> bool:
    try:
        return datetime.fromisoformat(json.loads(line)["at"]) >= cutoff
    except (ValueError, KeyError, TypeError):
        return False  # a line without a readable time cannot be kept for a known period


def purge_older_than(path: Path, cutoff: datetime) -> int:
    """Deletes the records written before `cutoff`. Returns how many were removed."""
    with _LOCK:
        if not path.exists():
            return 0
        lines = path.read_text(encoding="utf-8").splitlines()
        kept = [line for line in lines if _is_recent(line, cutoff)]
        if len(kept) == len(lines):
            return 0
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text("".join(line + "\n" for line in kept), encoding="utf-8")
        os.replace(temporary, path)
        return len(lines) - len(kept)
