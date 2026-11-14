"""What an attacker can try: hostile files, hostile text, hostile requests.

Each test names the attack. They run without Tesseract: a file that cannot be read is turned away
before any OCR starts.
"""

import io
import socket
import struct
import time
import zlib
from dataclasses import replace

import pytest
from PIL import Image

from app.detection.assess import assess_link, assess_text
from app.detection.entities import extract_entities
from app.detection.links import check_link, normalize_url
from app.detection.pii import redact_pii
from app.detection.signals import detect_signals
from app.detection.statutes import find_statutes
from app.scans.ingest import safe_name
from app.scans.ocr import TesseractOcr
from evaluation.run import load
from tests.conftest import FakeOcr

EMAIL = "ravi@example.com"
OUR_SITE = {"Origin": "http://localhost:5173"}


def reader(max_pixels: int = 1_000_000) -> TesseractOcr:
    return TesseractOcr(languages="eng", timeout=5, max_pdf_pages=2, max_pixels=max_pixels)


def png_claiming(width: int, height: int) -> bytes:
    """A tiny PNG whose header claims a huge picture (a decompression bomb)."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", width, height, 1, 0, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IEND", b"")


def scan_with(make_client, data: bytes, name: str = "n.png") -> dict:
    client = make_client(ocr=reader())
    response = client.post(
        "/v1/scans", data={"kind": "notice"}, files={"file": (name, data, "image/png")}
    )
    assert response.status_code == 201, response.text
    return client.get(f"/v1/scans/{response.json()['id']}").json()


# ----- hostile files -----


def test_a_picture_that_claims_to_be_enormous_is_not_decoded():
    assert reader().read_image(png_claiming(100_000, 100_000)).text == ""


def test_a_big_but_honest_picture_over_the_pixel_limit_is_not_read():
    out = io.BytesIO()
    Image.new("1", (2000, 2000)).save(out, format="PNG")  # 4 million pixels, a few KB
    assert reader(max_pixels=1_000_000).read_image(out.getvalue()).text == ""


@pytest.mark.parametrize(
    "data",
    [
        b"\x89PNG\r\n\x1a\n" + b"not really a picture" * 50,  # a PNG header and rubbish
        b"\x89PNG\r\n\x1a\n<html><script>alert(1)</script></html>",  # a polyglot
        b"\xff\xd8\xff" + b"\x00" * 100,  # a cut-off JPEG
        b"%PDF-1.4\nthis is not a pdf",
        b"%PDF-1.7\n1 0 obj<</Type/Catalog/OpenAction<</S/JavaScript/JS(app.alert(1))>>>>endobj\n",
    ],
)
def test_a_damaged_or_booby_trapped_file_ends_as_could_not_check(make_client, data):
    scan = scan_with(make_client, data)
    assert scan["status"] == "done" and scan["result"]["riskLevel"] == "cannot_verify"


@pytest.mark.parametrize(
    "data",
    [
        b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
        b"<!DOCTYPE html><html></html>",
        b"PK\x03\x04" + b"\x00" * 50,  # a zip
        b"MZ" + b"\x90\x00" * 50,  # a Windows program
        b"GIF89a" + b"\x00" * 50,
        b"RIFF\x00\x00\x00\x00WEBPVP8 ",
        b"#!/bin/sh\nrm -rf /\n",
        b"",
    ],
)
def test_only_pictures_and_pdfs_are_accepted_whatever_the_name_says(make_client, data):
    client = make_client()
    response = client.post(
        "/v1/scans", data={"kind": "notice"}, files={"file": ("harmless.png", data, "image/png")}
    )
    assert response.status_code == 400


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("../../etc/passwd", "passwd"),
        ("..\\..\\Windows\\system32\\evil.png", "evil.png"),
        ("a\x00b.png", "ab.png"),
        ("invoice‮gnp.exe", "invoicegnp.exe"),  # a right-to-left override cannot hide the end
        ("⁦x⁩.png", "x.png"),
        ("x" * 5000 + ".png", "x" * 100),
    ],
)
def test_a_file_name_cannot_carry_a_path_or_disguise_itself(given, expected):
    assert safe_name(given) == expected


def test_the_name_in_the_evidence_record_is_the_cleaned_one(make_client):
    client = make_client()
    scan = client.post(
        "/v1/scans",
        data={"kind": "notice"},
        files={"file": ("../../x‮.png", b"\x89PNG\r\n\x1a\nabc", "image/png")},
    ).json()
    assert scan["evidence"][0]["name"] == "x.png"


# ----- hostile text: it must neither hang the server nor slip past the rules -----

N = 20_000
HOSTILE_TEXT = [
    "a" * N,
    "1" * N,
    "a-" * (N // 2),
    "a." * (N // 2),
    "a@b" * (N // 3),
    "http://" + "a." * (N // 2),
    "Rs " * (N // 3),
    "transfer " * (N // 9),
    "video call " * (N // 11),
    "section " * (N // 8) + "420 IPC",
    "IPC, " * (N // 5),
    "क्" * (N // 2),
    "९" * N,
    "₹" * N,
    "(" * N,
    ("a" * 60 + " ") * (N // 61),
    "\n" * N,
    "0" * N + "x",
]


@pytest.mark.parametrize("text", HOSTILE_TEXT, ids=lambda text: f"{text[:12]!r}x{len(text)}")
def test_no_text_can_make_a_check_slow(text):
    started = time.perf_counter()
    assess_text(text)
    for step in (detect_signals, extract_entities, find_statutes, redact_pii):
        step(text)
    assert time.perf_counter() - started < 3.0


def test_text_from_a_photo_is_cut_before_it_is_judged():
    started = time.perf_counter()
    assess_text("transfer Rs 5,000 " * 200_000)  # 3.6 million characters
    assert time.perf_counter() - started < 3.0


@pytest.mark.parametrize(
    "url",
    [
        "http://" + "a" * 2000 + ".com",
        "https://" + "a." * 1000 + "com",
        "http://[::1",
        "http://",
        "x",
    ],
)
def test_odd_addresses_are_refused_or_checked_without_trouble(url):
    normalized = normalize_url(url)
    if normalized:
        check_link(normalized)


def test_checking_a_link_never_contacts_it(monkeypatch):
    """Looking at an address is done on the words alone: nothing is fetched, so a link cannot be
    used to make the server call somewhere (server-side request forgery)."""

    def refuse(*_args, **_kwargs):
        raise AssertionError("the network was used")

    monkeypatch.setattr(socket.socket, "connect", refuse)
    monkeypatch.setattr(socket, "getaddrinfo", refuse)
    for item in load("test_links") + load("dev_links"):
        url = normalize_url(item["url"])
        assert url is not None
        assess_link(url)
    for url in ("http://169.254.169.254/latest/meta-data", "http://localhost:8000/admin"):
        assess_text(f"open {url} now")


# ----- hiding the wording from the rules -----


@pytest.mark.parametrize(
    "text",
    [
        "Your account is under dig​ital arr​est.",  # zero-width spaces
        "Your account is under digіtal arrest.",  # a Cyrillic i
        "Your account is under ｄｉｇｉｔａｌ ａｒｒｅｓｔ.",  # full-width letters
        "Your account is under digital arrest.",  # a no-break space
        "Send the money to the safe ‮account",  # a direction override
    ],
)
def test_disguised_wording_is_still_recognised(text):
    assert detect_signals(text) & {"digital_arrest", "safe_account"}


def test_undisguising_does_not_harm_hindi():
    assert "digital_arrest" in detect_signals("आप डिजिटल अरेस्ट में हैं")
    assert "safe_account" in detect_signals("सुरक्षित खाते में पैसे डालें")


# ----- hostile requests -----


def test_a_deeply_nested_body_is_answered_with_an_error_not_a_crash(make_client):
    client = make_client(ocr=FakeOcr())
    nested = "[" * 50_000 + "]" * 50_000
    response = client.post(
        "/v1/auth/magic-link", content=nested, headers={"Content-Type": "application/json"}
    )
    assert response.status_code in (400, 413, 422)


def test_path_tricks_in_a_scan_address_find_nothing(make_client):
    client = make_client()
    for path in ("..%2f..%2fetc%2fpasswd", "%2e%2e/%2e%2e/secret", "a" * 5000, "%00"):
        assert client.get(f"/v1/scans/{path}").status_code in (404, 400)


def test_a_crash_inside_the_server_shows_nothing_about_it(make_client, monkeypatch):
    client = make_client()
    services = client.app.state.services

    def explode(_scan_id):
        raise RuntimeError("secret detail from inside")

    monkeypatch.setattr(services.store, "get", explode)
    from fastapi.testclient import TestClient

    quiet = TestClient(client.app, raise_server_exceptions=False)
    response = quiet.get("/v1/scans/abcdefghijklmnop")
    assert response.status_code == 500
    assert "secret" not in response.text and "Traceback" not in response.text
    assert response.headers["x-content-type-options"] == "nosniff"


def test_database_tricks_in_an_email_or_an_id_do_nothing(make_client, outbox, settings):
    client = make_client()
    nasty = "o'brien');drop--@example.com"
    client.post("/v1/auth/magic-link", json={"email": nasty})
    token = outbox.last_token()
    assert client.post("/v1/auth/verify", json={"token": token}).status_code == 200
    assert client.get("/v1/auth/me").json()["email"] == nasty.lower()
    assert client.delete("/v1/auth/sessions/' OR 1=1 --", headers=OUR_SITE).status_code == 204
    assert client.get("/v1/auth/me").status_code == 200  # nothing was deleted
    bad = {
        "id": "a' OR '1'='1",
        "kind": "notice",
        "riskLevel": None,
        "createdAt": "2026-11-13T10:00:00Z",
    }
    client.put("/v1/auth/profile", json={"syncHistory": True}, headers=OUR_SITE)
    assert client.put("/v1/history", json={"items": [bad]}, headers=OUR_SITE).status_code == 400


def test_extra_fields_cannot_change_what_they_should_not(make_client, outbox):
    client = make_client()
    client.post("/v1/auth/magic-link", json={"email": EMAIL})
    account = client.post("/v1/auth/verify", json={"token": outbox.last_token()}).json()
    changed = client.put(
        "/v1/auth/profile",
        json={
            "language": "hi",
            "email": "evil@example.com",
            "id": "usr_other",
            "syncHistory": False,
        },
        headers=OUR_SITE,
    ).json()
    assert changed["email"] == EMAIL and changed["id"] == account["id"]


# ----- who is asking: the address behind a proxy -----


def refused_after(client, headers: dict, tries: int = 25) -> int:
    for attempt in range(1, tries + 1):
        response = client.post(
            "/v1/feedback", json={"scanId": "scn", "type": "other"}, headers=headers
        )
        if response.status_code == 429:
            return attempt
    return 0


def test_without_a_proxy_a_caller_cannot_choose_their_own_address(make_client):
    client = make_client()
    tries = [
        client.post(
            "/v1/feedback",
            json={"scanId": "s", "type": "other"},
            headers={"X-Forwarded-For": f"10.0.0.{n}"},
        ).status_code
        for n in range(25)
    ]
    assert tries[:20] == [204] * 20 and 429 in tries[20:]  # the made-up addresses did not help


def test_behind_one_proxy_the_address_the_proxy_saw_is_used(make_client, settings):
    client = make_client(config=replace(settings, proxy_hops=1))
    # The caller writes the first entry; the proxy adds the real address as the last one.
    same_person = {"X-Forwarded-For": "1.1.1.1, 203.0.113.7"}
    assert refused_after(client, same_person) == 21
    other_person = {"X-Forwarded-For": "1.1.1.1, 203.0.113.8"}
    assert refused_after(client, other_person, tries=3) == 0  # a different person is unaffected


def test_behind_a_proxy_a_made_up_first_entry_does_not_help(make_client, settings):
    client = make_client(config=replace(settings, proxy_hops=1))
    statuses = []
    for number in range(25):
        header = {"X-Forwarded-For": f"9.9.9.{number}, 203.0.113.9"}
        response = client.post(
            "/v1/feedback", json={"scanId": "s", "type": "other"}, headers=header
        )
        statuses.append(response.status_code)
    assert 429 in statuses[20:]


def test_a_missing_header_falls_back_to_the_direct_address(make_client, settings):
    client = make_client(config=replace(settings, proxy_hops=1))
    assert refused_after(client, {}) == 21


def test_a_very_long_link_in_a_message_does_not_break_the_check(make_client):
    long_link = "https://www.example.com/track?" + "id=1234567890&" * 200  # about 2,800 characters
    client = make_client()
    response = client.post(
        "/v1/scans", data={"kind": "notice", "text": f"Track your parcel here {long_link}"}
    )
    scan = client.get(f"/v1/scans/{response.json()['id']}").json()
    assert scan["status"] == "done"
    assert all(len(entity["value"]) <= 500 for entity in scan["result"]["entities"])
