"""Tests with the real Tesseract. They are skipped where it is not installed."""

import io

import pypdfium2 as pdfium
from PIL import Image

from app.detection.assess import assess_text
from tests.conftest import FIXTURES

# A one-page PDF with a text layer, written by hand so the test needs no PDF library to make it.
TEXT_PDF = "\n".join(
    [
        "%PDF-1.4",
        "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R"
        "/Resources<</Font<</F1 5 0 R>>>>>>endobj",
        "4 0 obj<</Length 120>>stream",
        "BT /F1 12 Tf 50 700 Td (Digital arrest notice: transfer Rs 50000 to the safe account now.)"
        " Tj ET",
        "endstream",
        "endobj",
        "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
        "trailer<</Root 1 0 R/Size 6>>",
        "%%EOF",
    ]
).encode()


def read(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def test_english_notice_photo(real_ocr):
    reading = real_ocr.read_image(read("notice_en.png"))
    assert reading.confident
    result = assess_text(reading.text, confident=reading.confident)
    assert result.risk_level == "very_high"
    assert {e.value for e in result.entities} >= {
        "400000000001",
        "safe.verification@upi",
        "+91 90000 00000",
    }


def test_hindi_notice_photo(real_ocr):
    reading = real_ocr.read_image(read("notice_hi.png"))
    assert reading.confident
    result = assess_text(reading.text, confident=reading.confident)
    assert result.risk_level == "very_high"
    assert {"digital_arrest", "safe_account", "payment_demand"} <= set(result.reason_codes)
    assert "400000000001" in {e.value for e in result.entities}


def test_digits_survive_when_hindi_is_installed_too(real_ocr):
    # With Hindi listed first Tesseract drops every digit "1"; English must come first.
    reading = real_ocr.read_image(read("bank_alert_en.png"))
    assert "1,200" in reading.text and "12/11/2026" in reading.text


def test_a_blurred_photo_is_reported_as_unclear(real_ocr):
    reading = real_ocr.read_image(read("notice_hi_blur.png"))
    assert not reading.confident
    assert assess_text(reading.text, confident=reading.confident).risk_level == "cannot_verify"


def test_a_file_that_is_not_an_image_is_unreadable_not_an_error(real_ocr):
    reading = real_ocr.read_image(b"\x89PNG\r\n\x1a\nnot really a png")
    assert reading.text == "" and not reading.confident


def test_pdf_with_a_text_layer_is_read_without_ocr(real_ocr):
    reading = real_ocr.read_pdf(TEXT_PDF)
    assert reading.confident
    assert "transfer Rs 50000" in reading.text
    assert assess_text(reading.text).risk_level == "very_high"


def test_scanned_pdf_is_read_with_ocr(real_ocr):
    pdf = io.BytesIO()
    Image.open(FIXTURES / "notice_en.png").convert("RGB").save(pdf, format="PDF")
    reading = real_ocr.read_pdf(pdf.getvalue())
    assert reading.confident
    assert "digital arrest" in reading.text.lower()


def test_damaged_pdf_is_unreadable_not_an_error(real_ocr):
    reading = real_ocr.read_pdf(b"%PDF-1.4 this is not a pdf")
    assert reading.text == "" and not reading.confident


def test_only_the_first_pages_of_a_long_pdf_are_read(real_ocr):
    pages = Image.open(FIXTURES / "bank_alert_en.png").convert("RGB")
    pdf = io.BytesIO()
    pages.save(pdf, format="PDF", save_all=True, append_images=[pages] * 9)
    assert len(pdfium.PdfDocument(pdf.getvalue())) == 10
    reading = real_ocr.read_pdf(pdf.getvalue())
    assert reading.text.lower().count("bank alert") == real_ocr._max_pdf_pages


def test_a_huge_image_is_refused_before_it_is_loaded(real_ocr):
    huge = io.BytesIO()
    Image.new("L", (7000, 7000)).save(huge, format="PNG")  # 49 million pixels
    reading = real_ocr.read_image(huge.getvalue())
    assert reading.text == "" and not reading.confident
