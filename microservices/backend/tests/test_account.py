"""Changing the email address, the list of sign-ins, inactive accounts and the email texts."""

import sqlite3
from datetime import timedelta

from fastapi.testclient import TestClient

from app.accounts.mail import message
from app.accounts.store import AccountStore
from tests.test_auth import EMAIL, OTHER_SITE, OUR_SITE, ask, count, sign_in

NEW = "ravi.new@example.com"


def change(client, outbox, new=NEW, **extra):
    """Asks to change the address and returns the secret from the email, if one was sent."""
    before = len(outbox.sent)
    response = client.post("/v1/account/email", json={"email": new, **extra}, headers=OUR_SITE)
    assert response.status_code == 202 and response.json() == {}
    return outbox.last_token() if len(outbox.sent) > before else None


# ----- changing the email address -----


def test_the_new_address_gets_a_link_and_changes_only_when_it_is_opened(make_client, outbox):
    client = make_client()
    before = sign_in(client, outbox)
    token = change(client, outbox)
    assert outbox.sent[-1][0] == NEW and "/auth/confirm-email#token=" in outbox.sent[-1][2]
    assert client.get("/v1/auth/me").json()["email"] == EMAIL  # not yet

    done = client.post("/v1/account/email/confirm", json={"token": token}, headers=OUR_SITE)
    assert done.status_code == 200
    assert done.json()["email"] == NEW and done.json()["id"] == before["id"]
    assert client.get("/v1/auth/me").json()["email"] == NEW
    assert client.get("/v1/account/export").json()["account"]["email"] == NEW


def test_the_old_address_is_no_longer_the_account(make_client, outbox):
    client = make_client()
    account = sign_in(client, outbox)
    token = change(client, outbox)
    client.post("/v1/account/email/confirm", json={"token": token}, headers=OUR_SITE)
    elsewhere = sign_in(TestClient(client.app), outbox, EMAIL)  # starts a new, empty account
    assert elsewhere["id"] != account["id"]
    assert sign_in(TestClient(client.app), outbox, NEW)["id"] == account["id"]


def test_the_link_works_once_and_expires(make_client, outbox, clock):
    client = make_client()
    sign_in(client, outbox)
    token = change(client, outbox)
    assert (
        client.post(
            "/v1/account/email/confirm", json={"token": token}, headers=OUR_SITE
        ).status_code
        == 200
    )
    again = client.post("/v1/account/email/confirm", json={"token": token}, headers=OUR_SITE)
    assert again.status_code == 401
    late = change(client, outbox, "late@example.com")
    clock.advance(minutes=16)
    assert (
        client.post("/v1/account/email/confirm", json={"token": late}, headers=OUR_SITE).status_code
        == 401
    )


def test_somebody_elses_link_does_nothing(make_client, outbox):
    ravi = make_client()
    sita = TestClient(ravi.app)
    sign_in(ravi, outbox)
    sign_in(sita, outbox, "sita@example.com")
    token = change(ravi, outbox)
    stolen = sita.post("/v1/account/email/confirm", json={"token": token}, headers=OUR_SITE)
    assert stolen.status_code == 401
    assert sita.get("/v1/auth/me").json()["email"] == "sita@example.com"
    # the link was used up by the attempt, so it cannot be used by the right person either
    assert (
        ravi.post("/v1/account/email/confirm", json={"token": token}, headers=OUR_SITE).status_code
        == 401
    )


def test_an_address_that_belongs_to_someone_else_gets_the_same_answer_and_no_email(
    make_client, outbox
):
    ravi = make_client()
    sita = TestClient(ravi.app)
    sign_in(ravi, outbox)
    sign_in(sita, outbox, NEW)
    assert change(ravi, outbox) is None  # 202 {}, but nothing is sent


def test_the_address_cannot_be_taken_between_asking_and_confirming(make_client, outbox):
    ravi = make_client()
    sita = TestClient(ravi.app)
    sign_in(ravi, outbox)
    token = change(ravi, outbox)
    sign_in(sita, outbox, NEW)  # someone signs up with it first
    refused = ravi.post("/v1/account/email/confirm", json={"token": token}, headers=OUR_SITE)
    assert refused.status_code == 401 and ravi.get("/v1/auth/me").json()["email"] == EMAIL


def test_changing_the_address_needs_a_session_and_our_site(make_client, outbox):
    client = make_client()
    assert client.post("/v1/account/email", json={"email": NEW}).status_code == 401
    sign_in(client, outbox)
    other = client.post("/v1/account/email", json={"email": NEW}, headers=OTHER_SITE)
    assert other.status_code == 403
    assert (
        client.post("/v1/account/email", json={"email": "bad"}, headers=OUR_SITE).status_code == 400
    )
    assert client.post("/v1/account/email/confirm", json={"token": "x" * 43}).status_code == 401


def test_the_confirmation_email_is_in_the_persons_language(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    change(client, outbox, language="mr")
    assert outbox.sent[-1][1] == message("change_email", "mr", "L", 15)[0]


# ----- where the account is signed in -----


def test_the_list_shows_every_sign_in_and_marks_this_one(make_client, outbox):
    phone = make_client()
    laptop = TestClient(phone.app)
    sign_in(phone, outbox)
    sign_in(laptop, outbox)
    rows = phone.get("/v1/auth/sessions").json()
    assert len(rows) == 2 and [row["current"] for row in rows].count(True) == 1
    assert [row["current"] for row in laptop.get("/v1/auth/sessions").json()].count(True) == 1
    assert set(rows[0]) == {"id", "createdAt", "expiresAt", "current"}
    secret = phone.cookies.get("kavach_session")
    assert secret not in phone.get("/v1/auth/sessions").text
    assert TestClient(phone.app).get("/v1/auth/sessions").status_code == 401


def test_one_sign_in_can_be_ended_from_another_device(make_client, outbox):
    phone = make_client()
    laptop = TestClient(phone.app)
    sign_in(phone, outbox)
    sign_in(laptop, outbox)
    lost = next(row for row in phone.get("/v1/auth/sessions").json() if not row["current"])
    assert phone.delete(f"/v1/auth/sessions/{lost['id']}", headers=OUR_SITE).status_code == 204
    assert phone.get("/v1/auth/me").status_code == 200
    assert laptop.get("/v1/auth/me").status_code == 401
    assert len(phone.get("/v1/auth/sessions").json()) == 1


def test_ending_this_sign_in_signs_out(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    mine = client.get("/v1/auth/sessions").json()[0]
    assert client.delete(f"/v1/auth/sessions/{mine['id']}", headers=OUR_SITE).status_code == 204
    assert client.get("/v1/auth/me").status_code == 401


def test_nobody_can_end_another_accounts_sign_in(make_client, outbox):
    ravi = make_client()
    sita = TestClient(ravi.app)
    sign_in(ravi, outbox)
    sign_in(sita, outbox, "sita@example.com")
    hers = sita.get("/v1/auth/sessions").json()[0]["id"]
    ravi.delete(f"/v1/auth/sessions/{hers}", headers=OUR_SITE)
    assert sita.get("/v1/auth/me").status_code == 200
    refused = ravi.delete(f"/v1/auth/sessions/{hers}", headers=OTHER_SITE)
    assert refused.status_code == 403


# ----- accounts nobody uses -----


def test_an_account_nobody_signed_in_to_for_a_year_is_deleted(make_client, outbox, clock, settings):
    client = make_client()
    sign_in(client, outbox)
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    item = {
        "id": "abcdefgh12345",
        "kind": "notice",
        "riskLevel": "high",
        "createdAt": "2026-11-13T10:00:00Z",
    }
    client.put("/v1/history", json={"items": [item]}, headers=OUR_SITE)
    services = client.app.state.services

    clock.advance(days=364)
    services.accounts.purge()
    assert count(settings, "users") == 1

    clock.advance(days=2)
    services.accounts.purge()
    for table in ("users", "history", "sessions", "email_changes"):
        assert count(settings, table) == 0, table


def test_signing_in_starts_the_year_again(make_client, outbox, clock, settings):
    client = make_client()
    sign_in(client, outbox)
    clock.advance(days=300)
    sign_in(TestClient(client.app), outbox)
    clock.advance(days=300)  # 600 days after the first sign-in, 300 after the last
    client.app.state.services.accounts.purge()
    assert count(settings, "users") == 1


def test_a_database_from_before_the_sign_in_time_was_kept_is_updated_without_deleting_anyone(
    tmp_path, clock
):
    path = tmp_path / "old.db"
    with sqlite3.connect(path) as db:
        db.execute(
            "CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, language TEXT,"
            " sync_history INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)"
        )
        db.execute("INSERT INTO users VALUES ('usr_old', 'old@example.com', NULL, 0, 1)")
    store = AccountStore(
        path,
        clock,
        link_ttl=timedelta(minutes=15),
        session_ttl=timedelta(days=14),
        inactive_ttl=timedelta(days=365),
    )
    store.purge()
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


# ----- the email texts -----


def test_every_language_has_its_own_sign_in_and_confirmation_email():
    for kind in ("sign_in", "change_email"):
        texts = {
            language: message(kind, language, "https://x.example/#token=abc", 15)
            for language in ("en", "hi", "mr", "bn", "ta", "te", "gu")
        }
        assert len(set(texts.values())) == 7, kind
        for subject, body in texts.values():
            assert "https://x.example/#token=abc" in body and "15" in body and subject
        assert message(kind, None, "L", 15) == message(kind, "en", "L", 15)


def test_a_link_for_a_language_we_do_not_have_gets_english():
    assert message("sign_in", "xx", "L", 15) == message("sign_in", "en", "L", 15)


def test_the_email_language_is_taken_from_the_request(make_client, outbox):
    client = make_client()
    ask(client, outbox, language="gu")
    assert outbox.sent[0][1] == message("sign_in", "gu", "L", 15)[0]
