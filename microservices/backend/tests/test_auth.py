"""Signing in with an emailed link, sessions, and who can see what."""

import logging
import re
import sqlite3
from dataclasses import replace

from fastapi.testclient import TestClient

from app.accounts.mail import FileMailer, NoMailer, SmtpMailer
from app.main import create_app, default_mailer
from tests.conftest import FakeOcr, InlineExecutor
from tests.test_deletion import NOTICE, PNG
from tests.test_dossier import ENGLISH

EMAIL = "ravi@example.com"
OTHER_SITE = {"Origin": "https://evil.example"}
OUR_SITE = {"Origin": "http://localhost:5173"}


def ask(client, outbox, email=EMAIL, **extra):
    response = client.post("/v1/auth/magic-link", json={"email": email, **extra})
    assert response.status_code == 202
    return outbox.last_token() if outbox.sent else None


def sign_in(client, outbox, email=EMAIL):
    token = ask(client, outbox, email)
    response = client.post("/v1/auth/verify", json={"token": token})
    assert response.status_code == 200, response.text
    return response.json()


def scan(client):
    response = client.post(
        "/v1/scans", data={"kind": "notice"}, files={"file": ("n.png", PNG, "image/png")}
    )
    assert response.status_code == 201
    return response.json()["id"]


def item(item_id="abcdefgh12345", risk="high"):
    return {"id": item_id, "kind": "notice", "riskLevel": risk, "createdAt": "2026-11-13T10:00:00Z"}


def count(settings, table):
    with sqlite3.connect(settings.database_path) as db:
        return db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


# ----- the sign-in link -----


def test_the_link_answers_the_same_for_a_new_and_a_known_address(make_client, outbox):
    client = make_client()
    first = client.post("/v1/auth/magic-link", json={"email": EMAIL})
    sign_in(client, outbox)  # now the account exists
    second = client.post("/v1/auth/magic-link", json={"email": EMAIL})
    stranger = client.post("/v1/auth/magic-link", json={"email": "new@example.com"})
    assert first.status_code == second.status_code == stranger.status_code == 202
    assert first.json() == second.json() == stranger.json() == {}


def test_the_email_has_a_link_to_the_website_in_the_persons_language(make_client, outbox):
    client = make_client()
    ask(client, outbox, language="hi")
    to, subject, body = outbox.sent[0]
    assert to == EMAIL and "कवच" in subject
    assert re.search(r"http://localhost:5173/auth/verify#token=[\w-]{40,}", body)
    assert "15" in body


def test_a_link_works_once(make_client, outbox):
    client = make_client()
    token = ask(client, outbox)
    assert client.post("/v1/auth/verify", json={"token": token}).status_code == 200
    again = TestClient(client.app).post("/v1/auth/verify", json={"token": token})
    assert again.status_code == 401 and again.json()["error"]["code"] == "unauthorized"


def test_a_link_expires_after_15_minutes(make_client, outbox, clock):
    client = make_client()
    token = ask(client, outbox)
    clock.advance(minutes=16)
    assert client.post("/v1/auth/verify", json={"token": token}).status_code == 401


def test_a_made_up_or_malformed_link_is_refused(make_client):
    client = make_client()
    assert client.post("/v1/auth/verify", json={"token": "x" * 43}).status_code == 401
    assert client.post("/v1/auth/verify", json={"token": "short"}).status_code == 400
    assert client.post("/v1/auth/magic-link", json={"email": "not-an-email"}).status_code == 400


def test_the_address_is_cleaned_up_so_one_person_has_one_account(make_client, outbox):
    client = make_client()
    first = sign_in(client, outbox, "  Ravi@Example.COM ")
    second = sign_in(TestClient(client.app), outbox, EMAIL)
    assert first["email"] == EMAIL and first["id"] == second["id"]


def test_secrets_are_not_stored_as_they_are(make_client, outbox, settings):
    client = make_client()
    token = ask(client, outbox)
    client.post("/v1/auth/verify", json={"token": token})
    session = client.cookies.get("kavach_session")
    database = settings.database_path.read_bytes()
    assert token.encode() not in database and session.encode() not in database


def test_one_address_cannot_be_flooded_with_emails(make_client, outbox):
    client = make_client()
    for _ in range(8):
        assert client.post("/v1/auth/magic-link", json={"email": EMAIL}).status_code == 202
    assert len(outbox.sent) == 5  # the rest were quietly dropped, with the same answer


def test_one_person_cannot_ask_for_endless_links(make_client):
    client = make_client()
    codes = [
        client.post("/v1/auth/magic-link", json={"email": f"a{i}@example.com"}).status_code
        for i in range(22)
    ]
    assert codes[:20] == [202] * 20 and codes[20] == 429


# ----- the session -----


def test_the_session_cookie_cannot_be_read_by_scripts(make_client, outbox):
    client = make_client()
    token = ask(client, outbox)
    cookie = client.post("/v1/auth/verify", json={"token": token}).headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Max-Age=1209600" in cookie  # 14 days
    assert "Secure" not in cookie  # development over http


def test_the_session_cookie_is_secure_in_production(make_client, outbox, settings):
    client = make_client(config=replace(settings, env="prod"))
    token = ask(client, outbox)
    assert "Secure" in client.post("/v1/auth/verify", json={"token": token}).headers["set-cookie"]


def test_me_needs_a_session(make_client, outbox):
    client = make_client()
    assert client.get("/v1/auth/me").status_code == 401
    account = sign_in(client, outbox)
    assert client.get("/v1/auth/me").json() == account
    assert account["language"] is None and account["syncHistory"] is False


def test_a_session_ends_after_14_days(make_client, outbox, clock):
    client = make_client()
    sign_in(client, outbox)
    clock.advance(days=13)
    assert client.get("/v1/auth/me").status_code == 200
    clock.advance(days=2)
    assert client.get("/v1/auth/me").status_code == 401


def test_logging_out_ends_this_session_only(make_client, outbox):
    phone = make_client()
    laptop = TestClient(phone.app)
    sign_in(phone, outbox)
    sign_in(laptop, outbox)
    assert phone.post("/v1/auth/logout", headers=OUR_SITE).status_code == 204
    assert phone.get("/v1/auth/me").status_code == 401
    assert laptop.get("/v1/auth/me").status_code == 200


def test_logout_everywhere_ends_every_session(make_client, outbox):
    phone = make_client()
    laptop = TestClient(phone.app)
    sign_in(phone, outbox)
    sign_in(laptop, outbox)
    assert phone.post("/v1/auth/logout-all", headers=OUR_SITE).status_code == 204
    assert phone.get("/v1/auth/me").status_code == 401
    assert laptop.get("/v1/auth/me").status_code == 401


def test_requests_that_change_an_account_must_come_from_our_site(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    for method, path in [
        ("post", "/v1/auth/logout"),
        ("post", "/v1/auth/logout-all"),
        ("delete", "/v1/account"),
        ("delete", "/v1/history"),
    ]:
        refused = getattr(client, method)(path, headers=OTHER_SITE)
        assert refused.status_code == 403, path
    assert client.put("/v1/auth/profile", json={}, headers=OTHER_SITE).status_code == 403
    assert client.get("/v1/auth/me").status_code == 200  # nothing happened


def test_cross_site_pages_may_not_read_the_account(make_client):
    reply = make_client().options(
        "/v1/auth/me",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in reply.headers


def test_our_site_may_send_the_cookie(make_client):
    reply = make_client().options(
        "/v1/auth/me", headers={**OUR_SITE, "Access-Control-Request-Method": "GET"}
    )
    assert reply.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert reply.headers["access-control-allow-credentials"] == "true"


# ----- the profile and the history -----


def test_the_language_is_kept_in_the_account(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    updated = client.put("/v1/auth/profile", json={"language": "ta"}, headers=OUR_SITE).json()
    assert updated["language"] == "ta"
    assert TestClient(client.app).get("/v1/auth/me").status_code == 401
    assert client.get("/v1/auth/me").json()["language"] == "ta"
    bad = client.put("/v1/auth/profile", json={"language": "xx"}, headers=OUR_SITE)
    assert bad.status_code == 400


def test_history_is_refused_until_the_person_turns_sync_on(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    assert client.put("/v1/history", json={"items": [item()]}, headers=OUR_SITE).status_code == 403
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    assert client.put("/v1/history", json={"items": [item()]}, headers=OUR_SITE).status_code == 204
    assert [row["id"] for row in client.get("/v1/history").json()] == ["abcdefgh12345"]


def test_history_can_be_updated_and_deleted(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    client.put("/v1/history", json={"items": [item(), item("second-item-1")]}, headers=OUR_SITE)
    client.put("/v1/history", json={"items": [item(risk="low")]}, headers=OUR_SITE)  # update
    rows = {row["id"]: row for row in client.get("/v1/history").json()}
    assert rows["abcdefgh12345"]["riskLevel"] == "low" and len(rows) == 2
    client.delete("/v1/history/second-item-1", headers=OUR_SITE)
    assert len(client.get("/v1/history").json()) == 1
    client.delete("/v1/history", headers=OUR_SITE)
    assert client.get("/v1/history").json() == []


def test_turning_sync_off_removes_what_the_server_held(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    client.put("/v1/history", json={"items": [item()]}, headers=OUR_SITE)
    client.put("/v1/auth/profile", json={"syncHistory": False}, headers=OUR_SITE)
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    assert client.get("/v1/history").json() == []


def test_history_only_holds_the_kind_risk_and_time(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    extra = {**item(), "text": "secret notice", "entities": [{"type": "utr", "value": "1"}]}
    client.put("/v1/history", json={"items": [extra]}, headers=OUR_SITE)
    assert set(client.get("/v1/history").json()[0]) == {"id", "kind", "riskLevel", "createdAt"}
    assert "secret notice" not in client.get("/v1/account/export").text


def test_bad_history_items_are_refused(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    for bad in [item("short"), {**item(), "kind": "voice"}, {**item(), "riskLevel": "safe"}]:
        assert client.put("/v1/history", json={"items": [bad]}, headers=OUR_SITE).status_code == 400
    assert client.put("/v1/history", json={"items": []}, headers=OUR_SITE).status_code == 400


def test_nobody_can_reach_another_accounts_history(make_client, outbox):
    ravi = make_client()
    sita = TestClient(ravi.app)
    sign_in(ravi, outbox, EMAIL)
    sign_in(sita, outbox, "sita@example.com")
    for person in (ravi, sita):
        person.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    ravi.put("/v1/history", json={"items": [item()]}, headers=OUR_SITE)
    assert sita.get("/v1/history").json() == []
    sita.delete("/v1/history/abcdefgh12345", headers=OUR_SITE)  # not hers: nothing happens
    assert len(ravi.get("/v1/history").json()) == 1
    sita.put("/v1/history", json={"items": [item(risk="low")]}, headers=OUR_SITE)  # her own row
    assert ravi.get("/v1/history").json()[0]["riskLevel"] == "high"


def test_history_needs_a_session(make_client):
    client = make_client()
    assert client.get("/v1/history").status_code == 401
    assert client.put("/v1/history", json={"items": [item()]}).status_code == 401


# ----- export and deletion -----


def test_the_export_has_everything_held_and_no_secrets(make_client, outbox):
    client = make_client()
    sign_in(client, outbox)
    client.put("/v1/auth/profile", json={"language": "hi", "syncHistory": True}, headers=OUR_SITE)
    client.put("/v1/history", json={"items": [item()]}, headers=OUR_SITE)
    response = client.get("/v1/account/export")
    assert "attachment" in response.headers["content-disposition"]
    data = response.json()
    assert data["account"]["email"] == EMAIL and data["account"]["language"] == "hi"
    assert data["activeSessions"] == 1 and data["history"][0]["id"] == "abcdefgh12345"
    assert client.cookies.get("kavach_session") not in response.text
    assert TestClient(client.app).get("/v1/account/export").status_code == 401


def test_deleting_the_account_removes_everything(make_client, outbox, settings):
    client = make_client()
    sign_in(client, outbox)
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    client.put("/v1/history", json={"items": [item()]}, headers=OUR_SITE)
    own_scan = scan(client)
    ask(client, outbox)  # an unused sign-in link too

    assert client.delete("/v1/account", headers=OUR_SITE).status_code == 204

    assert client.get("/v1/auth/me").status_code == 401
    assert client.get(f"/v1/scans/{own_scan}").status_code == 404
    for table in ("users", "sessions", "history", "login_tokens"):
        assert count(settings, table) == 0, table
    fresh = sign_in(TestClient(client.app), outbox)  # the same address starts again from nothing
    assert fresh["language"] is None and fresh["syncHistory"] is False


def test_expired_links_and_sessions_are_swept_away(make_client, outbox, clock, settings):
    client = make_client()
    ask(client, outbox)
    sign_in(client, outbox, "sita@example.com")
    clock.advance(days=15)
    client.app.state.services.accounts.purge()
    assert count(settings, "login_tokens") == 0 and count(settings, "sessions") == 0
    assert count(settings, "users") == 1  # the account stays


# ----- who can see a scan -----


def test_a_scan_made_while_signed_in_belongs_to_that_account(make_client, outbox):
    ravi = make_client(FakeOcr(text=NOTICE))
    sita = TestClient(ravi.app)
    guest = TestClient(ravi.app)
    sign_in(ravi, outbox, EMAIL)
    sign_in(sita, outbox, "sita@example.com")
    scan_id = scan(ravi)
    assert ravi.get(f"/v1/scans/{scan_id}").status_code == 200
    for stranger in (sita, guest):
        assert stranger.get(f"/v1/scans/{scan_id}").status_code == 404
        change = stranger.put(f"/v1/scans/{scan_id}/entities", json={"entities": []})
        assert change.status_code == 404
        assert stranger.delete(f"/v1/scans/{scan_id}").status_code == 404
    assert ravi.get(f"/v1/scans/{scan_id}").status_code == 200  # still there
    assert ravi.put(f"/v1/scans/{scan_id}/entities", json={"entities": []}).status_code == 200


def test_the_summary_pdf_of_a_signed_in_scan_is_not_for_others(make_client, outbox):
    ravi = make_client(FakeOcr(text=NOTICE))
    guest = TestClient(ravi.app)
    sign_in(ravi, outbox)
    scan_id = scan(ravi)
    ravi.put(f"/v1/scans/{scan_id}/entities", json={"entities": []})
    assert guest.post(f"/v1/scans/{scan_id}/dossier", json=ENGLISH).status_code == 404
    assert ravi.post(f"/v1/scans/{scan_id}/dossier", json=ENGLISH).status_code == 201


def test_a_scan_made_without_an_account_works_for_whoever_has_its_address(make_client, outbox):
    guest = make_client(FakeOcr(text=NOTICE))
    scan_id = scan(guest)
    ravi = TestClient(guest.app)
    sign_in(ravi, outbox)
    assert ravi.get(f"/v1/scans/{scan_id}").status_code == 200


# ----- the email itself -----


def test_in_development_the_email_goes_to_a_file(settings):
    assert isinstance(default_mailer(settings), FileMailer)
    default_mailer(settings).send("a@example.com", "Hello", "Body")
    assert "a@example.com" in settings.outbox_path.read_text("utf-8")


def test_in_production_without_mail_settings_nothing_is_sent_or_written(settings):
    mailer = default_mailer(replace(settings, env="prod"))
    assert isinstance(mailer, NoMailer)
    mailer.send("a@example.com", "Hello", "Body")
    assert not settings.outbox_path.exists()


def test_smtp_settings_send_a_real_message(settings, monkeypatch):
    sent = []

    class FakeSmtp:
        def __init__(self, host, port, timeout):
            sent.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self):
            sent.append("tls")

        def login(self, user, password):
            sent.append(("login", user))

        def send_message(self, message):
            sent.append((message["To"], message["From"], message["Subject"]))

    monkeypatch.setattr("app.accounts.mail.smtplib.SMTP", FakeSmtp)
    config = replace(settings, smtp_host="mail.example.com", smtp_user="u", smtp_password="p")
    mailer = default_mailer(config)
    assert isinstance(mailer, SmtpMailer)
    mailer.send("a@example.com", "Hello", "Body")
    assert sent == [
        ("connect", "mail.example.com", 587),
        "tls",
        ("login", "u"),
        ("a@example.com", config.mail_from, "Hello"),
    ]


def test_nothing_about_the_person_reaches_the_logs(make_client, outbox, caplog):
    client = make_client()
    with caplog.at_level(logging.DEBUG):
        token = ask(client, outbox)
        client.post("/v1/auth/verify", json={"token": token})
        client.put("/v1/auth/profile", json={"language": "hi"}, headers=OUR_SITE)
        client.post("/v1/auth/logout", headers=OUR_SITE)
        create_app(client.app.state.services.settings, ocr=FakeOcr(), executor=InlineExecutor())
        NoMailer().send(EMAIL, "s", "b")
    log = caplog.text
    assert EMAIL not in log and token not in log and "ravi" not in log
