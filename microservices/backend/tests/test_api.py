import hashlib
import json
import logging

import pytest

from tests.conftest import DeferredExecutor, FakeOcr

PNG = b"\x89PNG\r\n\x1a\n" + b"fake image bytes"
JPEG = b"\xff\xd8\xff\xe0" + b"fake jpeg bytes"
PDF = b"%PDF-1.4 fake pdf"
NOTICE_TEXT = "Digital arrest! Transfer Rs 50,000 to the safe account. UTR 400000000001"


def upload(client, data: bytes = PNG, name: str = "notice.png", **form):
    return client.post(
        "/v1/scans", data={"kind": "notice", **form}, files={"file": (name, data, "image/png")}
    )


def test_health_reports_the_ocr_state(make_client):
    body = make_client(FakeOcr(ready=False)).get("/health").json()
    assert body["status"] == "ok" and body["ocr"] == "unavailable"
    assert make_client().get("/health").json()["ocr"] == "ready"


def test_text_scan_end_to_end(make_client):
    client = make_client()
    created = client.post("/v1/scans", data={"kind": "notice", "text": NOTICE_TEXT})
    assert created.status_code == 201
    scan = client.get(f"/v1/scans/{created.json()['id']}").json()

    assert scan["status"] == "done"
    assert scan["simulated"] is False
    assert scan["kind"] == "notice"
    assert [s["status"] for s in scan["stages"]] == ["done"] * 4
    assert scan["result"]["riskLevel"] == "very_high"
    assert scan["result"]["reasonCodes"][:2] == ["digital_arrest", "safe_account"]
    assert {"type": "utr", "value": "400000000001"} in scan["result"]["entities"]
    assert scan["confirmedEntities"] is None
    assert scan["expiresAt"] > scan["createdAt"]


def test_the_response_uses_the_websites_field_names(make_client):
    client = make_client()
    created = client.post("/v1/scans", data={"kind": "notice", "text": NOTICE_TEXT}).json()
    scan = client.get(f"/v1/scans/{created['id']}").json()
    assert set(scan) == {
        "id", "kind", "status", "stages", "result", "confirmedEntities", "evidence",
        "createdAt", "expiresAt", "simulated",
    }  # fmt: skip
    assert set(scan["result"]) == {"riskLevel", "reasonCodes", "entities", "statutes"}
    assert set(scan["evidence"][0]) == {"name", "sha256", "capturedAt"}


def test_a_photo_is_read_by_the_ocr_and_fingerprinted(make_client):
    client = make_client(FakeOcr(text=NOTICE_TEXT))
    scan = upload(client, JPEG, "my notice.jpg").json()
    done = client.get(f"/v1/scans/{scan['id']}").json()
    assert done["result"]["riskLevel"] == "very_high"
    assert done["evidence"][0]["name"] == "my notice.jpg"
    assert done["evidence"][0]["sha256"] == hashlib.sha256(JPEG).hexdigest()


def test_a_pdf_is_accepted(make_client):
    client = make_client(FakeOcr(text=NOTICE_TEXT))
    assert upload(client, PDF, "notice.pdf").status_code == 201


def test_text_and_link_are_fingerprinted(make_client):
    client = make_client()
    text = client.post("/v1/scans", data={"kind": "notice", "text": NOTICE_TEXT}).json()
    assert text["evidence"][0]["name"] == "pasted-text.txt"
    assert text["evidence"][0]["sha256"] == hashlib.sha256(NOTICE_TEXT.encode()).hexdigest()
    link = client.post("/v1/scans", data={"kind": "link", "url": "sbi.co.in"}).json()
    assert link["evidence"][0]["sha256"] == hashlib.sha256(b"https://sbi.co.in").hexdigest()


def test_the_filename_is_reduced_to_a_plain_name(make_client):
    scan = upload(make_client(), PNG, "..\\..\\folder/Ramesh Kumar notice.png").json()
    assert scan["evidence"][0]["name"] == "Ramesh Kumar notice.png"


def test_link_scan(make_client):
    client = make_client()
    scan = client.post(
        "/v1/scans", data={"kind": "link", "url": "http://sbi-kyc-update.example"}
    ).json()
    result = client.get(f"/v1/scans/{scan['id']}").json()["result"]
    assert result["riskLevel"] == "high"
    assert result["reasonCodes"] == ["lookalike_domain", "insecure_link"]
    assert result["entities"] == [{"type": "link", "value": "http://sbi-kyc-update.example"}]


def test_no_result_while_the_scan_is_still_running(make_client):
    executor = DeferredExecutor()
    client = make_client(FakeOcr(text=NOTICE_TEXT), executor)
    scan = upload(client).json()
    assert scan["status"] == "processing" and scan["result"] is None
    assert [s["status"] for s in scan["stages"]] == ["done", "current", "waiting", "waiting"]

    executor.run_all()
    assert client.get(f"/v1/scans/{scan['id']}").json()["status"] == "done"


@pytest.mark.parametrize(
    "form",
    [
        {"kind": "voice"},
        {"kind": "notice"},
        {"kind": "notice", "text": "   "},
        {"kind": "notice", "text": "x" * 20_001},
        {"kind": "notice", "url": "https://example.com"},
        {"kind": "notice", "text": "a", "url": "https://example.com"},
        {"kind": "link"},
        {"kind": "link", "url": "not a link"},
        {"kind": "link", "url": "ftp://example.com"},
        {"kind": "link", "url": "example.com", "text": "also text"},
        {"text": "no kind"},
    ],
)
def test_unusable_input_is_rejected_with_a_plain_code(make_client, form):
    response = make_client().post("/v1/scans", data=form)
    assert response.status_code == 400
    assert response.json() == {"error": {"code": "invalid_input"}}


@pytest.mark.parametrize(
    "data",
    [b"", b"GIF89a....", b"MZ\x90\x00 an executable", b"<html>hi</html>", b"PK\x03\x04 a zip"],
)
def test_files_are_judged_by_their_content_not_their_name_or_stated_type(make_client, data):
    response = upload(make_client(), data, "notice.png")  # called .png, sent as image/png
    assert response.status_code == 400


def test_a_file_over_the_size_limit_is_rejected(make_client, settings):
    too_big = PNG + b"0" * settings.max_upload_bytes
    assert upload(make_client(), too_big).status_code == 400
    just_fits = PNG + b"0" * (settings.max_upload_bytes - len(PNG))
    assert upload(make_client(), just_fits).status_code == 201


def test_text_and_file_together_are_rejected(make_client):
    assert upload(make_client(), text="also text").status_code == 400


def test_unknown_scan_is_not_found(make_client):
    response = make_client().get("/v1/scans/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found"}}


def test_a_scan_is_deleted_after_fifteen_minutes(make_client, clock):
    client = make_client()
    scan = client.post("/v1/scans", data={"kind": "notice", "text": NOTICE_TEXT}).json()
    clock.advance(minutes=14)
    assert client.get(f"/v1/scans/{scan['id']}").status_code == 200
    clock.advance(minutes=1)
    assert client.get(f"/v1/scans/{scan['id']}").status_code == 404
    assert client.put(f"/v1/scans/{scan['id']}/entities", json={"entities": []}).status_code == 404


def test_confirmed_details_are_trimmed_and_empty_ones_dropped(make_client):
    client = make_client()
    scan = client.post("/v1/scans", data={"kind": "notice", "text": NOTICE_TEXT}).json()
    response = client.put(
        f"/v1/scans/{scan['id']}/entities",
        json={"entities": [
            {"type": "utr", "value": "  400000000001 "},
            {"type": "upi", "value": "   "},
            {"type": "amount", "value": "Rs 500"},
        ]},
    )  # fmt: skip
    assert response.json()["confirmedEntities"] == [
        {"type": "utr", "value": "400000000001"},
        {"type": "amount", "value": "Rs 500"},
    ]
    assert client.get(f"/v1/scans/{scan['id']}").json()["confirmedEntities"] is not None


@pytest.mark.parametrize(
    "body",
    [
        {"entities": [{"type": "password", "value": "x"}]},
        {"entities": [{"type": "utr", "value": "x" * 501}]},
        {"entities": [{"type": "utr", "value": "1"}] * 31},
        {"entities": "nope"},
        {},
    ],
)
def test_bad_confirmed_details_are_rejected(make_client, body):
    client = make_client()
    scan = client.post("/v1/scans", data={"kind": "notice", "text": NOTICE_TEXT}).json()
    assert client.put(f"/v1/scans/{scan['id']}/entities", json=body).status_code == 400


def test_delete_removes_the_scan_and_can_be_repeated(make_client):
    client = make_client()
    scan = client.post("/v1/scans", data={"kind": "notice", "text": NOTICE_TEXT}).json()
    assert client.delete(f"/v1/scans/{scan['id']}").status_code == 204
    assert client.delete(f"/v1/scans/{scan['id']}").status_code == 204
    assert client.get(f"/v1/scans/{scan['id']}").status_code == 404


def test_a_failing_ocr_marks_the_scan_failed_and_logs_no_content(make_client, caplog):
    secret = "UTR 400000000001 was sent to ramesh@upi"
    client = make_client(FakeOcr(error=RuntimeError(secret)))
    scan = upload(client).json()
    with caplog.at_level(logging.DEBUG):
        failed = client.get(f"/v1/scans/{scan['id']}").json()
    assert failed["status"] == "failed" and failed["result"] is None
    assert secret not in caplog.text
    assert "400000000001" not in caplog.text


def test_the_failure_is_logged_by_kind_only(make_client, caplog):
    with caplog.at_level(logging.ERROR, logger="app.scans.pipeline"):
        upload(make_client(FakeOcr(error=RuntimeError("secret words"))))
    assert "RuntimeError" in caplog.text
    assert "secret words" not in caplog.text


def test_feedback_is_stored_without_any_file(make_client, settings):
    client = make_client()
    response = client.post(
        "/v1/feedback", json={"scanId": "abc", "type": "false_alarm", "note": "  looks fine  "}
    )
    assert response.status_code == 204
    client.post("/v1/feedback", json={"scanId": "abc", "type": "other"})
    first, second = [
        json.loads(line) for line in settings.feedback_path.read_text("utf-8").splitlines()
    ]
    assert (
        first["type"] == "false_alarm"
        and first["note"] == "looks fine"
        and first["scanId"] == "abc"
    )
    assert "note" not in second
    assert set(first) == {"at", "scanId", "type", "note"}


@pytest.mark.parametrize(
    "body",
    [
        {"scanId": "abc", "type": "insult"},
        {"scanId": "abc", "type": "other", "note": "x" * 501},
        {"type": "other"},
    ],
)
def test_bad_feedback_is_rejected(make_client, body, settings):
    assert make_client().post("/v1/feedback", json=body).status_code == 400
    assert not settings.feedback_path.exists()


def test_the_website_may_call_the_api_from_its_own_origin_only(make_client):
    client = make_client()
    allowed = client.options(
        "/v1/scans",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    other = client.options(
        "/v1/scans",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in other.headers
