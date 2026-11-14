from dataclasses import replace

import pytest

from tests.conftest import FakeOcr

PNG = b"\x89PNG\r\n\x1a\n" + b"fake image bytes"
TEXT = {"kind": "notice", "text": "Digital arrest! Pay Rs 5000 now to the safe account."}


def scan(client, **kwargs):
    return client.post("/v1/scans", data=TEXT, **kwargs)


# ---------- headers ----------


def test_responses_are_never_cached_sniffed_or_sent_on(make_client):
    headers = make_client().get("/health").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["referrer-policy"] == "no-referrer"
    assert headers["cache-control"] == "no-store"


def test_outside_development_responses_also_forbid_scripts_and_framing(make_client, settings):
    production = make_client(config=replace(settings, env="prod"))
    assert production.get("/health").headers["content-security-policy"] == (
        "default-src 'none'; frame-ancestors 'none'"
    )
    assert production.get("/docs").status_code == 404  # no API docs page in production
    assert "content-security-policy" not in make_client().get("/health").headers


def test_the_pdf_and_error_responses_carry_the_headers_too(make_client):
    client = make_client()
    assert client.get("/v1/scans/nope").headers["cache-control"] == "no-store"
    assert (
        client.post("/v1/scans", data={"kind": "x"}).headers["x-content-type-options"] == "nosniff"
    )


# ---------- request size ----------


def test_a_body_over_the_limit_is_refused_before_it_is_read(make_client, settings):
    client = make_client()
    too_big = b"0" * (settings.max_body_bytes + 1)
    response = client.post("/v1/scans", data={"kind": "notice"}, files={"file": ("a.png", too_big)})
    assert response.status_code == 413
    assert response.json() == {"error": {"code": "invalid_input"}}


def test_a_body_without_a_declared_length_is_counted_as_it_arrives(make_client, settings):
    def chunks():
        yield b'--x\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n\r\n'
        for _ in range(8):
            yield b"0" * (settings.max_body_bytes // 4)
        yield b"\r\n--x--\r\n"

    headers = {"content-type": "multipart/form-data; boundary=x"}  # no content-length
    response = make_client().post("/v1/scans", content=chunks(), headers=headers)
    assert response.status_code == 413


def test_a_nonsense_length_is_refused(make_client):
    response = make_client().post("/v1/scans", content=b"x", headers={"content-length": "12abc"})
    assert response.status_code in (400, 413)


def test_a_file_just_under_the_limit_still_works(make_client, settings):
    ok = PNG + b"0" * (settings.max_upload_bytes - len(PNG))
    client = make_client(FakeOcr(text="hello there, nothing to see here at all"))
    response = client.post("/v1/scans", data={"kind": "notice"}, files={"file": ("a.png", ok)})
    assert response.status_code == 201


def test_a_refusal_still_carries_the_cors_headers(make_client, settings):
    too_big = b"0" * (settings.max_body_bytes + 1)
    response = make_client().post(
        "/v1/scans",
        data={"kind": "notice"},
        files={"file": ("a.png", too_big)},
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


# ---------- rate limits ----------


def test_too_many_scans_from_one_person_are_refused(make_client, settings):
    client = make_client()
    assert all(scan(client).status_code == 201 for _ in range(settings.rate_limit))
    refused = scan(client)
    assert refused.status_code == 429
    assert refused.json() == {"error": {"code": "rate_limited"}}


def test_another_person_is_not_affected(make_client, settings):
    first, second = make_client(host="203.0.113.1"), make_client(host="203.0.113.2")
    for _ in range(settings.rate_limit):
        scan(first)
    assert scan(first).status_code == 429
    assert scan(second).status_code == 201


def test_the_limit_opens_again_after_the_window(make_client, settings, clock):
    client = make_client()
    for _ in range(settings.rate_limit):
        scan(client)
    assert scan(client).status_code == 429
    clock.advance(seconds=settings.rate_window_seconds)
    assert scan(client).status_code == 201


def test_each_action_has_its_own_allowance(make_client, settings):
    client = make_client()
    for _ in range(settings.rate_limit):
        scan(client)
    feedback = {"scanId": "abc", "type": "other"}
    assert client.post("/v1/feedback", json=feedback).status_code == 204
    assert client.get("/v1/scans/nope").status_code == 404  # reading is never limited


@pytest.mark.parametrize("path", ["/v1/feedback", "/v1/consent"])
def test_feedback_and_consent_are_limited_too(make_client, settings, path):
    client = make_client()
    body = {"scanId": "a", "type": "other"} if "feedback" in path else {
        "version": settings.consent_version, "granted": True,
    }  # fmt: skip
    assert all(client.post(path, json=body).status_code == 204 for _ in range(settings.rate_limit))
    assert client.post(path, json=body).status_code == 429
