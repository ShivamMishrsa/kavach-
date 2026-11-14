"""The whole path for a photo of a message: draw it, spoil it, read it, judge it.

    python -m evaluation.ocr                  # a sample of the test messages, five qualities
    python -m evaluation.ocr --per-group 4    # a smaller, faster run

Each message is drawn as an image (with the same shaped fonts as the evidence summary, so Hindi is
drawn correctly), then spoiled the way phone photos are: blurred, shrunk and compressed, tilted,
noisy. The text Tesseract reads is compared with the original, and the risk level from the photo
with the risk level from the typed text. Needs Tesseract with English and Hindi.
"""

import argparse
import io
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageFilter

from app.core.config import settings
from app.detection.assess import assess_text
from app.dossier.render import _Document
from app.scans.ocr import TesseractOcr
from evaluation.metrics import WARNED, Rate, percentile
from evaluation.run import load


def render(text: str) -> Image.Image:
    """The message as a clean image, about 1250 px wide."""
    document = _Document(datetime(2026, 1, 1, tzinfo=UTC), text)
    document.add_page()
    document.set_font("Noto", "", 13)
    document.set_text_color(20, 24, 40)
    document.multi_cell(0, 7, text)
    page = pdfium.PdfDocument(bytes(document.output()))[0]
    return page.render(scale=1.5).to_pil().convert("RGB").crop((0, 0, 1240, 520))


def _png(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def _jpeg(image: Image.Image, quality: int) -> bytes:
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=quality)
    return out.getvalue()


def _noisy(image: Image.Image) -> Image.Image:
    noise = Image.effect_noise(image.size, 24).convert("RGB")
    return Image.blend(image, noise, 0.18)


VARIANTS = {
    "clean": _png,
    "blurred": lambda image: _png(image.filter(ImageFilter.GaussianBlur(0.9))),
    "small_and_compressed": lambda image: _jpeg(
        image.resize((image.width * 60 // 100, image.height * 60 // 100)), 35
    ),
    "tilted": lambda image: _png(
        image.rotate(3.0, resample=Image.Resampling.BICUBIC, fillcolor=(255, 255, 255))
    ),
    "noisy": lambda image: _jpeg(_noisy(image), 55),
}


def edit_distance(a: str, b: str) -> int:
    previous = list(range(len(b) + 1))
    for i, char_a in enumerate(a, 1):
        current = [i]
        for j, char_b in enumerate(b, 1):
            current.append(
                min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (char_a != char_b))
            )
        previous = current
    return previous[-1]


def _normal(text: str) -> str:
    return " ".join(text.split())


def sample(per_group: int) -> list[dict]:
    """A balanced sample of the test messages: scams written for / benign, English and Hindi."""
    texts = load("test_text")
    groups: dict[tuple[bool, bool], list[dict]] = {}
    for item in texts:
        if item["label"] == "scam" and item.get("scope") != "in":
            continue
        key = (item["label"] == "scam", item["lang"] == "en")
        groups.setdefault(key, []).append(item)
    return [item for group in groups.values() for item in group[:per_group]]


def evaluate(per_group: int, *, enhance: bool = True) -> dict:
    ocr = TesseractOcr(
        languages=settings.ocr_languages,
        timeout=settings.ocr_timeout_seconds,
        max_pdf_pages=settings.max_pdf_pages,
        max_pixels=settings.max_image_pixels,
        command=settings.tesseract_cmd,
        tessdata_dir=settings.tessdata_dir,
        enhance=enhance,
    )
    if not ocr.ready:
        raise SystemExit("Tesseract with English and Hindi is not installed")

    items = sample(per_group)
    images = {item["id"]: render(item["text"]) for item in items}
    results: dict[str, dict] = {}
    for name, make in VARIANTS.items():
        errors, characters, seconds = 0, 0, []
        same_level = warned_alike = confident = 0
        scams = scams_kept = 0
        for item in items:
            data = make(images[item["id"]])
            started = time.perf_counter()
            reading = ocr.read_image(data)
            seconds.append(time.perf_counter() - started)
            expected = _normal(item["text"])
            errors += edit_distance(_normal(reading.text), expected)
            characters += len(expected)
            typed = assess_text(item["text"])
            photo = assess_text(reading.text, confident=reading.confident)
            same_level += photo.risk_level == typed.risk_level
            warned_alike += (photo.risk_level in WARNED) == (typed.risk_level in WARNED)
            confident += reading.confident
            if item["label"] == "scam" and typed.risk_level in WARNED:
                scams += 1
                scams_kept += photo.risk_level in WARNED
        results[name] = {
            "character_error_rate": errors / characters,
            "same_risk_level_as_typed": _rate(same_level, len(items)),
            "same_warning_as_typed": _rate(warned_alike, len(items)),
            "scams_still_warned_about": _rate(scams_kept, scams),
            "read_with_confidence": _rate(confident, len(items)),
            "ocr_seconds_p50": percentile(seconds, 0.5),
            "ocr_seconds_p95": percentile(seconds, 0.95),
        }
    return {"messages": len(items), "variants": results}


def _rate(hits: int, total: int) -> dict:
    rate = Rate(hits, total)
    return {"hits": hits, "total": total, "value": rate.value, "interval": rate.interval}


def report(result: dict) -> str:
    lines = [f"OCR path on {result['messages']} messages"]
    for name, row in result["variants"].items():
        lines.append(f" {name}:")
        lines.append(f"   character error rate            {row['character_error_rate']:.1%}")
        for key, label in (
            ("same_risk_level_as_typed", "same risk level as typed text"),
            ("same_warning_as_typed", "same warned/not-warned as typed"),
            ("scams_still_warned_about", "scams still warned about"),
            ("read_with_confidence", "read with confidence"),
        ):
            rate = Rate(row[key]["hits"], row[key]["total"])
            lines.append(f"   {label:<32}{rate.show()}")
        lines.append(
            f"   OCR time p50 / p95              {row['ocr_seconds_p50']:.2f} s / "
            f"{row['ocr_seconds_p95']:.2f} s"
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-group", type=int, default=9)
    parser.add_argument("--no-enhance", action="store_true", help="read photos as they are")
    parser.add_argument("--json", type=Path)
    args = parser.parse_args(argv)
    result = evaluate(args.per_group, enhance=not args.no_enhance)
    print(report(result))
    if args.json:
        args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
