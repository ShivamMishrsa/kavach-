from datetime import timedelta

import pytest

from app.models import Entity, EvidenceHash, ScanResult
from app.scans.store import ScanStore
from tests.conftest import Clock

RESULT = ScanResult(
    risk_level="high",
    reason_codes=["urgency"],
    entities=[Entity(type="utr", value="400000000001")],
    statutes=[],
)


@pytest.fixture
def store(clock: Clock) -> ScanStore:
    return ScanStore(timedelta(minutes=15), clock)


def new_scan(store: ScanStore, clock: Clock):
    evidence = [EvidenceHash(name="a.png", sha256="0" * 64, captured_at=clock())]
    return store.create("notice", evidence)


def statuses(scan) -> list[str]:
    return [stage.status for stage in scan.stages]


def test_a_new_scan_has_received_done_and_reading_in_progress(store, clock):
    scan = new_scan(store, clock)
    assert scan.status == "processing"
    assert statuses(scan) == ["done", "current", "waiting", "waiting"]
    assert scan.result is None
    assert scan.expires_at - scan.created_at == timedelta(minutes=15)


def test_stages_advance_and_the_result_appears_only_when_done(store, clock):
    scan = new_scan(store, clock)
    store.advance(scan.id)
    assert statuses(store.get(scan.id)) == ["done", "done", "current", "waiting"]
    store.advance(scan.id)
    last = store.get(scan.id)
    assert statuses(last) == ["done", "done", "done", "current"]
    assert last.result is None

    store.finish(scan.id, RESULT)
    done = store.get(scan.id)
    assert done.status == "done"
    assert statuses(done) == ["done"] * 4
    assert done.result == RESULT


def test_advance_never_completes_the_last_stage_by_itself(store, clock):
    scan = new_scan(store, clock)
    for _ in range(10):
        store.advance(scan.id)
    assert store.get(scan.id).status == "processing"


def test_a_failed_scan_shows_no_result(store, clock):
    scan = new_scan(store, clock)
    store.fail(scan.id)
    failed = store.get(scan.id)
    assert failed.status == "failed"
    assert failed.result is None
    assert "current" not in statuses(failed)


def test_confirmed_details_are_returned_once_done(store, clock):
    scan = new_scan(store, clock)
    store.finish(scan.id, RESULT)
    confirmed = [Entity(type="amount", value="Rs 500")]
    assert store.confirm(scan.id, confirmed).confirmed_entities == confirmed
    assert store.get(scan.id).confirmed_entities == confirmed


def test_a_scan_is_gone_after_fifteen_minutes(store, clock):
    scan = new_scan(store, clock)
    store.finish(scan.id, RESULT)
    clock.advance(minutes=14, seconds=59)
    assert store.get(scan.id) is not None
    clock.advance(seconds=1)
    assert store.get(scan.id) is None
    assert store.confirm(scan.id, []) is None


def test_expired_scans_are_removed_from_memory_not_just_hidden(store, clock):
    scan = new_scan(store, clock)
    clock.advance(minutes=16)
    new_scan(store, clock)  # any use of the store clears what has expired
    assert scan.id not in store._records


def test_delete_removes_the_scan_and_is_safe_to_repeat(store, clock):
    scan = new_scan(store, clock)
    store.delete(scan.id)
    store.delete(scan.id)
    assert store.get(scan.id) is None


def test_ids_are_unique_and_not_guessable(store, clock):
    ids = {new_scan(store, clock).id for _ in range(50)}
    assert len(ids) == 50
    assert all(len(scan_id) >= 20 for scan_id in ids)
