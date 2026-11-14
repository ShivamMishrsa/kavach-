"""Where scans live while they are being worked on: in memory only, for 15 minutes.

Nothing here is written to disk. The uploaded file is never stored at all (it is read once and
dropped); what is kept is the result, the details the person confirmed, the fingerprints and the
evidence summary PDF made from them. Expired scans are removed whenever the store is used, so an
expired scan can never be read, and a background sweep (see main.py) removes them even when
nobody is using it.
"""

import secrets
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.models import (
    STAGES,
    Entity,
    EvidenceHash,
    Scan,
    ScanKind,
    ScanResult,
    ScanStatus,
    StageProgress,
)


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class _Record:
    id: str
    kind: ScanKind
    created_at: datetime
    expires_at: datetime
    evidence: list[EvidenceHash]
    status: ScanStatus = "processing"
    stages_done: int = 1  # "received" is done as soon as the scan exists
    result: ScanResult | None = None
    confirmed: list[Entity] | None = None
    dossier: bytes | None = None
    owner: str | None = None  # the account that made it, when someone was signed in


class ScanStore:
    def __init__(self, ttl: timedelta, clock: Callable[[], datetime] = utc_now) -> None:
        self._ttl = ttl
        self._clock = clock
        self._lock = threading.Lock()
        self._records: dict[str, _Record] = {}

    def create(
        self, kind: ScanKind, evidence: list[EvidenceHash], owner: str | None = None
    ) -> Scan:
        now = self._clock()
        record = _Record(
            id=secrets.token_urlsafe(16),
            kind=kind,
            created_at=now,
            expires_at=now + self._ttl,
            evidence=evidence,
            owner=owner,
        )
        with self._lock:
            self._purge()
            self._records[record.id] = record
            return self._snapshot(record)

    def advance(self, scan_id: str) -> None:
        """One more stage is done."""
        with self._lock:
            record = self._records.get(scan_id)
            if record and record.status == "processing":
                record.stages_done = min(record.stages_done + 1, len(STAGES) - 1)

    def finish(self, scan_id: str, result: ScanResult) -> None:
        with self._lock:
            record = self._records.get(scan_id)
            if record:
                record.status, record.stages_done, record.result = "done", len(STAGES), result

    def fail(self, scan_id: str) -> None:
        with self._lock:
            record = self._records.get(scan_id)
            if record:
                record.status = "failed"

    def get(self, scan_id: str) -> Scan | None:
        with self._lock:
            self._purge()
            record = self._records.get(scan_id)
            return self._snapshot(record) if record else None

    def confirm(self, scan_id: str, entities: list[Entity]) -> Scan | None:
        with self._lock:
            self._purge()
            record = self._records.get(scan_id)
            if not record:
                return None
            record.confirmed = entities
            return self._snapshot(record)

    def attach_dossier(self, scan_id: str, pdf: bytes) -> bool:
        with self._lock:
            self._purge()
            record = self._records.get(scan_id)
            if record:
                record.dossier = pdf
            return record is not None

    def dossier(self, scan_id: str) -> bytes | None:
        with self._lock:
            self._purge()
            record = self._records.get(scan_id)
            return record.dossier if record else None

    def purge(self) -> None:
        """Removes every expired scan now."""
        with self._lock:
            self._purge()

    def delete(self, scan_id: str) -> None:
        with self._lock:
            self._records.pop(scan_id, None)

    def owner_of(self, scan_id: str) -> str | None:
        """The account a scan belongs to. None for a scan made without signing in (or no scan)."""
        with self._lock:
            record = self._records.get(scan_id)
            return record.owner if record else None

    def delete_owned(self, owner: str) -> None:
        """Deletes every scan an account still has, when the account is deleted."""
        with self._lock:
            for scan_id in [r.id for r in self._records.values() if r.owner == owner]:
                del self._records[scan_id]

    def _purge(self) -> None:
        now = self._clock()
        for scan_id in [r.id for r in self._records.values() if now >= r.expires_at]:
            del self._records[scan_id]

    def _snapshot(self, record: _Record) -> Scan:
        done = record.status == "done"
        stages = [
            StageProgress(
                id=stage,
                status=(
                    "done"
                    if index < record.stages_done
                    else "current"
                    if index == record.stages_done and record.status == "processing"
                    else "waiting"
                ),
            )
            for index, stage in enumerate(STAGES)
        ]
        return Scan(
            id=record.id,
            kind=record.kind,
            status=record.status,
            stages=stages,
            result=record.result if done else None,
            confirmed_entities=record.confirmed if done else None,
            evidence=list(record.evidence),
            created_at=record.created_at,
            expires_at=record.expires_at,
        )
