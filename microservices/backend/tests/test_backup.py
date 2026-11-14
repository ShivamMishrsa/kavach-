"""Backups: a consistent copy, a working restore, and old copies leaving."""

import sqlite3
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.tools.backup import PREFIX, STAMP, make_backup, prune, restore
from tests.test_auth import OUR_SITE, ask, sign_in

DAY = datetime(2026, 11, 14, tzinfo=UTC)


def users(path) -> list[str]:
    db = sqlite3.connect(path)
    try:
        return [row[0] for row in db.execute("SELECT email FROM users ORDER BY email")]
    finally:
        db.close()


@pytest.fixture
def live(make_client, outbox, settings):
    """A running service with an account, a history item, a consent and a feedback record."""
    client = make_client()
    sign_in(client, outbox, "ravi@example.com")
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    item = {
        "id": "abcdefgh12345",
        "kind": "notice",
        "riskLevel": "high",
        "createdAt": "2026-11-13T10:00:00Z",
    }
    client.put("/v1/history", json={"items": [item]}, headers=OUR_SITE)
    client.post("/v1/consent", json={"version": settings.consent_version, "granted": True})
    client.post("/v1/feedback", json={"scanId": "scn_x", "type": "other"})
    return client


def test_a_copy_holds_the_database_and_both_logs(live, settings, tmp_path):
    folder = make_backup(settings, tmp_path / "backups", DAY)
    assert folder.name == f"{PREFIX}20261114T000000Z"
    assert sorted(path.name for path in folder.iterdir()) == [
        "consent.jsonl",
        "feedback.jsonl",
        "kavach.db",
    ]
    assert users(folder / "kavach.db") == ["ravi@example.com"]


def test_later_changes_are_not_in_a_copy_that_was_already_made(live, settings, tmp_path, outbox):
    folder = make_backup(settings, tmp_path / "b", DAY)
    sign_in(TestClient(live.app), outbox, "sita@example.com")
    assert users(folder / "kavach.db") == ["ravi@example.com"]


def test_a_restore_brings_the_accounts_back_and_they_still_work(
    live, settings, tmp_path, make_client, outbox
):
    folder = make_backup(settings, tmp_path / "b", DAY)
    fresh = replace(settings, data_dir=tmp_path / "restored")
    restore(folder, fresh.data_dir)
    assert users(fresh.database_path) == ["ravi@example.com"]
    client = make_client(config=fresh)
    ask(client, outbox, "ravi@example.com")
    account = client.post("/v1/auth/verify", json={"token": outbox.last_token()}).json()
    assert account["syncHistory"] is True and len(client.get("/v1/history").json()) == 1


def test_a_restore_will_not_overwrite_data_unless_told_to(live, settings, tmp_path):
    folder = make_backup(settings, tmp_path / "b", DAY)
    with pytest.raises(FileExistsError):
        restore(folder, settings.data_dir)
    restore(folder, settings.data_dir, force=True)


def test_an_empty_service_can_be_copied_too(settings, tmp_path):
    folder = make_backup(settings, tmp_path / "b", DAY)
    assert list(folder.iterdir()) == []


def test_old_copies_are_removed_and_recent_ones_stay(tmp_path):
    now = datetime(2026, 12, 20, tzinfo=UTC)
    for days in (1, 10, 29, 31, 90):
        (tmp_path / f"{PREFIX}{(now - timedelta(days=days)).strftime(STAMP)}").mkdir()
    (tmp_path / "something-else").mkdir()
    removed = prune(tmp_path, keep_days=30, now=now)
    assert len(removed) == 2
    assert len(list(tmp_path.glob(f"{PREFIX}*"))) == 3
    assert (tmp_path / "something-else").exists()  # only our own folders are touched


def test_a_damaged_database_stops_the_copy_and_leaves_nothing_behind(settings, tmp_path):
    settings.database_path.write_bytes(b"this is not a database" * 100)
    with pytest.raises(sqlite3.DatabaseError):
        make_backup(settings, tmp_path / "b", DAY)
    assert list((tmp_path / "b").iterdir()) == []
