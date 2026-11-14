"""Consent and feedback records are deleted after the retention period."""

import json
import time
from dataclasses import replace
from datetime import timedelta

from fastapi.testclient import TestClient

from app.core.jsonl import append_record, purge_older_than
from app.main import create_app
from tests.conftest import FakeOcr, InlineExecutor


def lines(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_only_records_older_than_the_cutoff_are_removed(tmp_path, clock):
    log = tmp_path / "consent.jsonl"
    old = clock.now - timedelta(days=91)
    recent = clock.now - timedelta(days=89)
    append_record(log, {"at": old.isoformat(), "version": "old"})
    append_record(log, {"at": recent.isoformat(), "version": "recent"})

    removed = purge_older_than(log, clock.now - timedelta(days=90))

    assert removed == 1
    assert [record["version"] for record in lines(log)] == ["recent"]
    assert not log.with_suffix(".jsonl.tmp").exists()


def test_a_line_without_a_readable_time_is_removed(tmp_path, clock):
    log = tmp_path / "feedback.jsonl"
    log.write_text('not json\n{"type": "other"}\n{"at": "yesterday"}\n', encoding="utf-8")
    assert purge_older_than(log, clock.now) == 3
    assert log.read_text(encoding="utf-8") == ""


def test_a_missing_file_is_fine(tmp_path, clock):
    assert purge_older_than(tmp_path / "none.jsonl", clock.now) == 0


def test_the_default_period_is_90_days(settings):
    assert settings.retention_days == 90


def test_the_background_sweep_deletes_old_records(settings, clock):
    fast = replace(settings, purge_interval_seconds=0.02, records_purge_seconds=0.02)
    app = create_app(fast, ocr=FakeOcr(), executor=InlineExecutor(), clock=clock)
    with TestClient(app) as client:
        assert (
            client.post(
                "/v1/consent", json={"version": fast.consent_version, "granted": True}
            ).status_code
            == 204
        )
        assert (
            client.post("/v1/feedback", json={"scanId": "scn_x", "type": "other"}).status_code
            == 204
        )
        clock.advance(days=91)
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline and (
            fast.consent_path.read_text(encoding="utf-8")
            or fast.feedback_path.read_text(encoding="utf-8")
        ):
            time.sleep(0.02)
        assert fast.consent_path.read_text(encoding="utf-8") == ""
        assert fast.feedback_path.read_text(encoding="utf-8") == ""


def test_the_server_access_log_that_shows_ip_addresses_is_switched_off(settings):
    import logging

    create_app(settings, ocr=FakeOcr(), executor=InlineExecutor())
    assert logging.getLogger("uvicorn.access").disabled
