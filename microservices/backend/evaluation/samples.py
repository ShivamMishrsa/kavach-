"""Makes the demo sample files in samples/ and writes what Kavach says about each.

    python -m evaluation.samples            # needs Tesseract with English and Hindi

Every file is **made up**: invented agencies, invented numbers, addresses ending in `.example`. Each
one carries a red strip "DEMO SAMPLE: FAKE, NOT A REAL NOTICE" so that nobody can mistake it for the
real thing or forward it as one. They exist so that a demo (or a reviewer) can try the photo and PDF
path without anyone's real message. The table in samples/README.md is the output of the real
pipeline (Tesseract and the rules), written by this script, not typed by hand.
"""

import io
import sys
from datetime import UTC, datetime
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageFilter

from app.core.config import settings
from app.detection.assess import assess_text
from app.dossier.render import _Document
from app.scans.ocr import TesseractOcr

SAMPLES = Path(__file__).resolve().parents[3] / "samples"
STRIP = "DEMO SAMPLE: FAKE, NOT A REAL NOTICE"

NOTICES = {
    "fake-arrest-notice-en": (
        "NARCOTICS CONTROL BUREAU (made up)\nNOTICE OF ARREST\n\n"
        "Case no. NCB/2026/0000 (made up)\n\n"
        "Dear Sir or Madam,\n\n"
        "A parcel booked with your Aadhaar was found to contain banned items. A warrant is issued "
        "against you. You are now under digital arrest. Stay on the WhatsApp video call with "
        "Inspector Rathore and do not tell anyone, not even your family.\n\n"
        "To close the case without arrest, transfer Rs 85,000 to the verification account "
        "rathore.verify@okaxis within 2 hours. Call 9000000001 now."
    ),
    "fake-arrest-notice-hi": (
        "नारकोटिक्स नियंत्रण ब्यूरो (काल्पनिक)\nगिरफ्तारी नोटिस\n\n"
        "आपके आधार से बुक पार्सल में प्रतिबंधित सामान मिला है। आपके नाम पर वारंट निकला है। "
        "आप डिजिटल अरेस्ट में हैं। वीडियो कॉल पर बने रहिए और किसी को मत बताइए।\n\n"
        "मामला बंद करने के लिए ₹85,000 सुरक्षित खाते में तुरंत जमा करें। संपर्क: 9000000001"
    ),
    "courier-sms-link": (
        "SwiftCourier (made up)\n\n"
        "Your parcel could not be delivered. A redelivery fee of Rs 49 is due. Pay today or the "
        "parcel will be returned: http://swiftcourier-redelivery.example/pay"
    ),
    "bank-alert-ordinary": (
        "Example Bank (made up)\n\n"
        "Rs 2,450.00 debited from A/c XX4521 on 12-Nov-26 at an online shop. Available balance "
        "Rs 18,320.55. If this was not you, call the number on the back of your card. Never "
        "share your OTP with anyone."
    ),
    "unclear-photo-hi": (
        "नारकोटिक्स नियंत्रण ब्यूरो (काल्पनिक)\nगिरफ्तारी नोटिस\n\n"
        "आप डिजिटल अरेस्ट में हैं। वीडियो कॉल पर बने रहिए और किसी को मत बताइए। "
        "₹85,000 तुरंत जमा करें।"
    ),
}


class _Letter(_Document):
    def footer(self) -> None:  # a sample is not an evidence summary: no Kavach footer
        pass


def _page(text: str) -> _Letter:
    page = _Letter(datetime(2026, 1, 1, tzinfo=UTC), text + STRIP)
    page.add_page()
    page.set_fill_color(190, 24, 24)
    page.set_font("Noto", "B", 13)
    page.set_text_color(255, 255, 255)
    page.multi_cell(0, 10, STRIP, fill=True, align="C", padding=2, new_x="LMARGIN", new_y="NEXT")
    page.ln(6)
    page.set_font("Noto", "", 12)
    page.set_text_color(20, 24, 40)
    page.multi_cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
    return page


def _png(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def _image(text: str) -> Image.Image:
    pdf = pdfium.PdfDocument(bytes(_page(text).output()))
    picture = pdf[0].render(scale=1.6).to_pil().convert("RGB")
    return picture.crop((0, 0, picture.width, int(picture.height * 0.62)))


def build() -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for name, text in NOTICES.items():
        picture = _image(text)
        if name == "unclear-photo-hi":
            picture = picture.filter(ImageFilter.GaussianBlur(2.2))
            picture = picture.resize((picture.width * 45 // 100, picture.height * 45 // 100))
        files[f"{name}.png"] = _png(picture)
    files["fake-court-summons-en.pdf"] = bytes(
        _page(
            "DISTRICT COURT, EXAMPLE CITY (made up)\nSUMMONS\n\n"
            "A case under Section 420 IPC and Section 120B IPC is registered against you for "
            "online fraud. A non-bailable warrant will be issued. To settle the matter, pay "
            "Rs 40,000 to adv.example@oksbi today and keep this confidential. Call 9000000002."
        ).output()
    )
    return files


def _read(ocr: TesseractOcr, name: str, data: bytes) -> tuple[str, str]:
    """The risk level and reasons the real pipeline gives this file."""
    reading = ocr.read_pdf(data) if name.endswith(".pdf") else ocr.read_image(data)
    result = assess_text(reading.text, confident=reading.confident)
    return result.risk_level.replace("_", " "), ", ".join(result.reason_codes) or "no signs found"


def main() -> int:
    ocr = TesseractOcr(
        languages=settings.ocr_languages,
        timeout=settings.ocr_timeout_seconds,
        max_pdf_pages=settings.max_pdf_pages,
        max_pixels=settings.max_image_pixels,
        command=settings.tesseract_cmd,
        tessdata_dir=settings.tessdata_dir,
    )
    if not ocr.ready:
        print("Tesseract with English and Hindi is not installed", file=sys.stderr)
        return 1

    SAMPLES.mkdir(exist_ok=True)
    rows = []
    for name, data in build().items():
        (SAMPLES / name).write_bytes(data)
        level, reasons = _read(ocr, name, data)
        rows.append(f"| `{name}` | {level} | {reasons} |")
        print(f"{name}: {level} ({reasons})")

    (SAMPLES / "README.md").write_text(
        README.format(rows="\n".join(rows)), encoding="utf-8", newline="\n"
    )
    return 0


README = """# Demo samples

**Everything here is made up.** The agencies, cases, numbers and addresses do not exist (phone
numbers start 9000000, web addresses end in `.example`), and each picture carries a red strip
"DEMO SAMPLE: FAKE, NOT A REAL NOTICE". No real person's message is in this folder. Use them to
try Kavach's photo and PDF checks without using anything real.

| File | What Kavach says (risk level) | Because |
|---|---|---|
{rows}

How to use: in the app choose "Notice, message or screenshot", then "Photo or file", and pick one.
On the demo website (no backend) the same buttons work, but the result is simulated, not read from
the file.

The table above is **measured**: it is the output of the real reading step (Tesseract) and the
rules, written by `python -m evaluation.samples` (run it again after changing the rules). One
sample per kind says little about how well Kavach works: see
[`docs/benchmarks.md`](../docs/benchmarks.md).
The blurred photo is there to show the honest "could not read this well" case.
"""

if __name__ == "__main__":
    sys.exit(main())
