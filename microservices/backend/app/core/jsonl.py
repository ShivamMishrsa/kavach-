"""The little that is written to disk: one JSON line per feedback or consent record."""

import json
import threading
from pathlib import Path

_LOCK = threading.Lock()


def append_record(path: Path, record: dict[str, object]) -> None:
    line = json.dumps(record, ensure_ascii=False)
    with _LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as log:
            log.write(line + "\n")
