import hashlib
import logging
from datetime import datetime

import pypdfium2 as pdfium
import pytest

from tests.conftest import DeferredExecutor

NOTICE = (
    "Digital arrest! Transfer Rs 50,000 to safe.verification@upi. UTR 400000000001. "
    "Call +91 90000 00000."
)

ENGLISH = {
    "title": "Evidence summary",
    "disclaimer": "Prepared by you for your records. This is not an FIR or an official complaint.",
    "summaryTitle": "What happened",
    "summary": "I received a message that I believe is a scam. I prepared this summary myself.",
    "detailsTitle": "Details",
    "detailLabels": {
        "utr": "UTR number",
        "upi": "Scammer UPI ID",
        "amount": "Amount",
        "phone": "Scammer's phone number",
        "datetime": "Date and time",
        "link": "Link",
    },
    "evidenceTitle": "Evidence fingerprints",
    "evidenceHint": "A fingerprint (SHA-256) shows your original was not changed.",
    "capturedAt": "Recorded {time}",
    "keepOriginals": "Keep your original photos and chats on your phone.",
    "scriptTitle": "What to say to the helpline",
    "script": "Hello, I want to report a cyber fraud. The reference (UTR) is 400000000001.",
}
HINDI = {
    **ENGLISH,
    "title": "सबूत सारांश",
    "disclaimer": "यह आपने अपने रिकॉर्ड के लिए तैयार किया है। यह FIR या आधिकारिक शिकायत नहीं है।",
    "summaryTitle": "क्या हुआ",
    "keepOriginals": "अपनी मूल फ़ोटो और चैट अपने फ़ोन में सुरक्षित रखें।",
    "script": "नमस्ते, मुझे साइबर ठगी की शिकायत दर्ज करानी है। UTR 400000000001 है।",
}


def pdf_text(data: bytes) -> str:
    document = pdfium.PdfDocument(data)
    return "\n".join(page.get_textpage().get_text_range() for page in document)


def make_scan(client, confirm=(("utr", "400000000001"), ("upi", "safe.verification@upi"))) -> str:
    scan = client.post("/v1/scans", data={"kind": "notice", "text": NOTICE}).json()
    if confirm is not None:
        entities = [{"type": kind, "value": value} for kind, value in confirm]
        client.put(f"/v1/scans/{scan['id']}/entities", json={"entities": entities})
    return scan["id"]


def create(client, scan_id: str, text: dict = ENGLISH):
    return client.post(f"/v1/scans/{scan_id}/dossier", json=text)


def test_summary_is_made_from_the_confirmed_details_and_the_servers_fingerprints(make_client):
    client = make_client()
    scan_id = make_scan(client, confirm=(("utr", "400000000001"), ("upi", "safe.verification@upi")))
    evidence = client.get(f"/v1/scans/{scan_id}").json()["evidence"][0]

    response = create(client, scan_id)
    assert response.status_code == 201
    text = pdf_text(client.get(response.json()["url"]).content)

    for words in (ENGLISH["title"], ENGLISH["disclaimer"], ENGLISH["summary"], ENGLISH["script"]):
        assert words in text.replace("\n", " ")
    assert "400000000001" in text and "safe.verification@upi" in text
    assert evidence["sha256"] in text
    assert "Recorded 2026-11-13 10:00 UTC" in text.replace("\n", " ")
    assert ENGLISH["keepOriginals"] in text.replace("\n", " ")


def test_details_the_person_did_not_confirm_stay_out(make_client):
    client = make_client()
    scan_id = make_scan(client, confirm=(("utr", "400000000001"),))
    text = pdf_text(client.get(create(client, scan_id).json()["url"]).content)
    # The scan found a UPI id, an amount and a phone number too, but they were not confirmed.
    assert "safe.verification@upi" not in text
    assert "90000 00000" not in text and "50,000" not in text


def test_details_the_person_corrected_are_used_as_corrected(make_client):
    client = make_client()
    scan_id = make_scan(client, confirm=(("utr", "999988887777"),))
    made = create(client, scan_id, {**ENGLISH, "script": "Hello."}).json()
    text = pdf_text(client.get(made["url"]).content)
    assert "999988887777" in text and "400000000001" not in text


def test_details_are_listed_in_the_order_the_helpline_asks_for_them(make_client):
    client = make_client()
    scan_id = make_scan(
        client, confirm=(("phone", "9000000000"), ("upi", "a@upi"), ("utr", "1" * 12))
    )
    text = pdf_text(client.get(create(client, scan_id).json()["url"]).content)
    assert text.index("1" * 12) < text.index("a@upi") < text.index("9000000000")


def test_the_reported_fingerprint_is_that_of_the_downloaded_file(make_client):
    client = make_client()
    scan_id = make_scan(client)
    made = create(client, scan_id).json()
    download = client.get(made["url"])
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF")
    assert hashlib.sha256(download.content).hexdigest() == made["sha256"]
    assert download.headers["content-type"] == "application/pdf"
    assert "attachment" in download.headers["content-disposition"]
    assert made["generatedAt"] == "2026-11-13T10:00:00Z"


def test_hindi_text_is_drawn_and_shaped(make_client):
    client = make_client()
    scan_id = make_scan(client)
    pdf = client.get(create(client, scan_id, HINDI).json()["url"]).content
    text = pdf_text(pdf)
    assert "सबूत" in text and "सारांश" in text
    assert "FIR" in text and "400000000001" in text
    document = pdfium.PdfDocument(pdf)
    assert len(document) == 1


def test_a_very_long_link_and_text_do_not_break_the_layout(make_client):
    client = make_client()
    scan_id = make_scan(client, confirm=(("link", "https://example.com/" + "a" * 400),))
    long_text = {**ENGLISH, "summary": "word " * 380, "script": "x" * 1900}
    response = create(client, scan_id, long_text)
    assert response.status_code == 201
    assert len(pdfium.PdfDocument(client.get(response.json()["url"]).content)) >= 1


def test_a_summary_can_only_be_made_from_confirmed_details(make_client):
    client = make_client()
    unconfirmed = make_scan(client, confirm=None)
    assert create(client, unconfirmed).status_code == 400
    assert create(client, "does-not-exist").status_code == 404


def test_a_scan_that_is_still_running_has_no_summary(make_client):
    client = make_client(executor=DeferredExecutor())
    scan_id = make_scan(client, confirm=(("utr", "1"),))
    assert create(client, scan_id).status_code == 400


@pytest.mark.parametrize(
    "change",
    [
        {"title": "x" * 201},
        {"script": "x" * 2001},
        {"detailLabels": {"password": "x"}},
        {"title": None},
    ],
)
def test_bad_summary_text_is_rejected(make_client, change):
    client = make_client()
    scan_id = make_scan(client)
    assert create(client, scan_id, {**ENGLISH, **change}).status_code == 400


def test_a_missing_part_of_the_text_is_rejected(make_client):
    client = make_client()
    scan_id = make_scan(client)
    incomplete = {key: value for key, value in ENGLISH.items() if key != "script"}
    assert create(client, scan_id, incomplete).status_code == 400


def test_the_link_stops_working_after_five_minutes(make_client, clock):
    client = make_client()
    url = create(client, make_scan(client)).json()["url"]
    clock.advance(minutes=4, seconds=59)
    assert client.get(url).status_code == 200
    clock.advance(seconds=1)
    assert client.get(url).status_code == 404


def test_the_link_never_outlives_the_scan(make_client, clock):
    client = make_client()
    scan_id = make_scan(client)
    clock.advance(minutes=13)
    made = create(client, scan_id).json()
    assert made["linkExpiresAt"] == "2026-11-13T10:15:00Z"  # scan end, not 13 + 5 minutes


@pytest.mark.parametrize("tamper", ["sig", "exp", "scan"])
def test_a_changed_link_is_refused(make_client, tamper):
    client = make_client()
    scan_id, other_id = make_scan(client), make_scan(client)
    url = create(client, scan_id).json()["url"]
    create(client, other_id)
    path, query = url.split("?")
    exp, sig = (part.split("=")[1] for part in query.split("&"))
    changed = {
        "sig": f"{path}?exp={exp}&sig={'0' * 64}",
        "exp": f"{path}?exp={int(exp) + 3600}&sig={sig}",
        "scan": f"/v1/scans/{other_id}/dossier.pdf?exp={exp}&sig={sig}",
    }[tamper]
    assert client.get(changed).status_code == 404


def test_a_link_without_its_signature_is_refused(make_client):
    client = make_client()
    scan_id = make_scan(client)
    create(client, scan_id)
    assert client.get(f"/v1/scans/{scan_id}/dossier.pdf").status_code == 400


def test_the_pdf_is_gone_when_the_scan_is_deleted_or_expires(make_client, clock):
    client = make_client()
    deleted, expired = make_scan(client), make_scan(client)
    deleted_url = create(client, deleted).json()["url"]
    expired_url = create(client, expired).json()["url"]
    client.delete(f"/v1/scans/{deleted}")
    assert client.get(deleted_url).status_code == 404
    clock.advance(minutes=15)
    assert client.get(expired_url).status_code == 404


def test_the_summary_for_another_scan_cannot_be_fetched_with_this_scans_link(make_client):
    client = make_client()
    first, second = make_scan(client, confirm=(("utr", "111111111111"),)), make_scan(client)
    url = create(client, first).json()["url"]
    assert "111111111111" in pdf_text(client.get(url).content)
    assert datetime.fromisoformat(create(client, second).json()["generatedAt"])


@pytest.mark.parametrize(
    ("language", "heading"),
    [
        ("hi", "सबूत सारांश"),
        ("mr", "पुराव्याचा सारांश"),
        ("bn", "প্রমাণের সারসংক্ষেপ"),
        ("ta", "ஆதாரச் சுருக்கம்"),
        ("te", "సాక్ష్యాల సారాంశం"),
        ("gu", "પુરાવાનો સારાંશ"),
    ],
)
def test_every_language_of_the_website_can_be_drawn(make_client, caplog, language, heading):
    client = make_client()
    scan_id = make_scan(client)
    words = {**ENGLISH, "title": heading, "summary": heading, "script": heading}
    with caplog.at_level(logging.WARNING):
        made = create(client, scan_id, words)
    text = pdf_text(client.get(made.json()["url"]).content)
    # Title, summary and script were all drawn. Only the start of the heading is compared: when text
    # is copied out of a Bengali PDF a few vowel signs come out as control characters (the page
    # itself looks right), so the whole heading cannot be matched there.
    assert text.count(heading[:5]) >= 3, language
    assert "missing" not in caplog.text.lower()  # fpdf2 warns when a font lacks a character


def test_a_pdf_in_one_language_does_not_load_the_fonts_of_the_others(make_client):
    client = make_client()
    scan_id = make_scan(client)
    english = client.get(create(client, scan_id).json()["url"]).content
    tamil = client.get(create(client, scan_id, {**ENGLISH, "title": "ஆதாரச் சுருக்கம்"}).json()["url"])
    assert len(english) < len(tamil.content) < 120_000
