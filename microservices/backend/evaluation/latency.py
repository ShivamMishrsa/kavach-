"""How long a check takes, measured on this machine with the real Tesseract.

    python -m evaluation.latency               # 20 runs per kind
    python -m evaluation.latency --runs 40 --json out.json

Two things are timed: the work itself (`run_scan`, the part Kavach controls) and a whole request
to the API (upload, then waiting until the result is ready). The website asks for the result every
0.7 seconds while it waits, so a person sees the result up to 0.7 s after it is ready.
Numbers depend on the machine; the report prints it. They are not a promise for another one.
"""

import argparse
import io
import json
import os
import platform
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from fpdf import FPDF
from PIL import Image, ImageDraw

from app.core.config import settings
from app.main import create_app
from app.scans.ingest import detect_file_kind
from app.scans.ocr import TesseractOcr
from app.scans.pipeline import FileSource, LinkSource, TextSource, run_scan
from app.scans.store import ScanStore
from evaluation.metrics import percentile
from evaluation.ocr import _jpeg, _png, render
from evaluation.run import load


def _text_pdf(text: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", size=12)
    pdf.multi_cell(0, 6, text.encode("latin-1", "replace").decode("latin-1"))
    return bytes(pdf.output())


def _scanned_pdf(image: Image.Image, pages: int) -> bytes:
    out = io.BytesIO()
    image.convert("RGB").save(out, format="PDF", save_all=True, append_images=[image] * (pages - 1))
    return out.getvalue()


def _phone_photo(text_image: Image.Image) -> bytes:
    """A 12-megapixel-style photo: the notice small in the middle of a large picture."""
    canvas = Image.new("RGB", (4000, 3000), (205, 200, 190))
    ImageDraw.Draw(canvas).rectangle((300, 400, 3700, 2600), fill=(250, 250, 248))
    scaled = text_image.resize((3000, round(text_image.height * 3000 / text_image.width)))
    canvas.paste(scaled, (500, 700))
    return _jpeg(canvas, 85)


def machine() -> dict:
    version = subprocess.run(
        [settings.tesseract_cmd or "tesseract", "--version"], capture_output=True, text=True
    ).stdout.splitlines()[0]
    return {
        "system": platform.platform(),
        "processor": platform.processor(),
        "logical_cpus": os.cpu_count(),
        "python": platform.python_version(),
        "tesseract": version,
    }


def timed(function, runs: int) -> dict:
    seconds = []
    for _ in range(runs):
        started = time.perf_counter()
        function()
        seconds.append(time.perf_counter() - started)
    return {
        "runs": runs,
        "p50": percentile(seconds, 0.5),
        "p95": percentile(seconds, 0.95),
        "max": max(seconds),
    }


def work_time(ocr: TesseractOcr, runs: int) -> dict:
    """The time `run_scan` takes for each kind of input."""
    notice = load("test_text")[0]["text"]
    page = render(notice)
    inputs = {
        "typed text": TextSource(notice),
        "link": LinkSource("https://sbi-kyc-update.example/login"),
        "photo (screenshot, 1240 px wide)": FileSource(_png(page), "image"),
        "photo (12 MP phone picture)": FileSource(_phone_photo(page), "image"),
        "PDF with text": FileSource(_text_pdf(notice), "pdf"),
        "scanned PDF (3 pages)": FileSource(_scanned_pdf(page, 3), "pdf"),
    }
    results = {}
    for name, source in inputs.items():
        store = ScanStore(timedelta(minutes=15))

        def once(source=source, store=store, name=name) -> None:
            scan = store.create("notice", [])
            run_scan(store, ocr, scan.id, source)
            assert store.get(scan.id).status == "done", name  # a failed scan would be fast

        results[name] = timed(once, runs if not name.startswith("scanned") else max(3, runs // 4))
    return results


def request_time(runs: int) -> dict:
    """Upload a photo to the API and wait for the result, one at a time and four at once."""
    app = create_app(settings)
    client = TestClient(app)
    page = _png(render(load("test_text")[0]["text"]))
    assert detect_file_kind(page) == "image"

    def one() -> float:
        started = time.perf_counter()
        scan = client.post(
            "/v1/scans", data={"kind": "notice"}, files={"file": ("n.png", page, "image/png")}
        ).json()
        while client.get(f"/v1/scans/{scan['id']}").json()["status"] == "processing":
            time.sleep(0.01)
        return time.perf_counter() - started

    one_by_one = [one() for _ in range(runs)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        four_at_once = list(pool.map(lambda _: one(), range(max(8, runs // 2))))
    return {
        "photo, one at a time": {
            "runs": runs,
            "p50": percentile(one_by_one, 0.5),
            "p95": percentile(one_by_one, 0.95),
        },
        "photo, four at once (2 workers)": {
            "runs": len(four_at_once),
            "p50": percentile(four_at_once, 0.5),
            "p95": percentile(four_at_once, 0.95),
        },
    }


def evaluate(runs: int, single_core: bool) -> dict:
    if single_core:
        os.environ["OMP_THREAD_LIMIT"] = "1"  # Tesseract then uses one core, like a small server
    ocr = TesseractOcr(
        languages=settings.ocr_languages,
        timeout=settings.ocr_timeout_seconds,
        max_pdf_pages=settings.max_pdf_pages,
        max_pixels=settings.max_image_pixels,
        command=settings.tesseract_cmd,
        tessdata_dir=settings.tessdata_dir,
    )
    if not ocr.ready:
        raise SystemExit("Tesseract with English and Hindi is not installed")
    return {
        "when": datetime.now(UTC).isoformat(timespec="seconds"),
        "machine": machine(),
        "tesseract_on_one_core": single_core,
        "work": work_time(ocr, runs),
        "request": request_time(max(8, runs // 2)),
    }


def report(result: dict) -> str:
    lines = [
        f"{result['machine']['system']}, {result['machine']['logical_cpus']} logical CPUs, "
        f"{result['machine']['tesseract']}, Tesseract on one core: "
        f"{result['tesseract_on_one_core']}"
    ]
    for part in ("work", "request"):
        lines.append(f" {part}:")
        for name, row in result[part].items():
            lines.append(
                f"   {name:<36} p50 {row['p50']:.2f} s   p95 {row['p95']:.2f} s"
                f"   ({row['runs']} runs)"
            )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=20)
    parser.add_argument("--json", type=Path)
    args = parser.parse_args(argv)
    results = [evaluate(args.runs, single_core=False), evaluate(args.runs, single_core=True)]
    for result in results:
        print(report(result), end="\n\n")
    if args.json:
        args.json.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
