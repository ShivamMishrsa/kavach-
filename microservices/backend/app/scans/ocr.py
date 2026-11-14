"""Reads text from photos and PDFs. Tesseract does the reading, in Hindi and English."""

import io
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Protocol

import pypdfium2 as pdfium
import pytesseract
from PIL import Image, ImageOps, UnidentifiedImageError
from pytesseract import Output

# Below this average word confidence (0-100) a photo counts as unclear.
MIN_CONFIDENCE = 50.0
# A PDF page with at least this much real text needs no OCR.
MIN_TEXT_LAYER_CHARS = 40
RENDER_SCALE = 2.0

# PDFium (inside pypdfium2) is not thread-safe, and the scans run in several threads.
_PDFIUM_LOCK = threading.Lock()


class OcrUnavailable(RuntimeError):
    """Tesseract or its language data is missing on this machine."""


@dataclass(frozen=True)
class Reading:
    text: str
    confident: bool


UNREADABLE = Reading(text="", confident=False)


class Ocr(Protocol):
    @property
    def ready(self) -> bool: ...

    def read_image(self, data: bytes) -> Reading: ...

    def read_pdf(self, data: bytes) -> Reading: ...


class TesseractOcr:
    def __init__(
        self,
        *,
        languages: str,
        timeout: int,
        max_pdf_pages: int,
        max_pixels: int,
        command: str | None = None,
        tessdata_dir: str | None = None,
    ) -> None:
        self._languages = languages
        self._timeout = timeout
        self._max_pdf_pages = max_pdf_pages
        self._max_pixels = max_pixels
        self._ready: bool | None = None
        if command:
            pytesseract.pytesseract.tesseract_cmd = command
        if tessdata_dir:
            # Tesseract reads its language files from here (safer than a command-line option,
            # which pytesseract does not quote on Windows).
            os.environ["TESSDATA_PREFIX"] = str(Path(tessdata_dir).resolve())

    @property
    def ready(self) -> bool:
        """True when Tesseract runs and has every language needed. Checked once."""
        if self._ready is None:
            self._ready = self._probe()
        return self._ready

    def _probe(self) -> bool:
        try:
            installed = set(pytesseract.get_languages())
        except (pytesseract.TesseractNotFoundError, pytesseract.TesseractError):
            return False
        return set(self._languages.split("+")) <= installed

    def read_image(self, data: bytes) -> Reading:
        image = self._open(data)
        return self._recognize(image) if image else UNREADABLE

    def read_pdf(self, data: bytes) -> Reading:
        readings: list[Reading] = []
        with _PDFIUM_LOCK:
            try:
                pdf = pdfium.PdfDocument(data)
            except pdfium.PdfiumError:  # damaged, or protected by a password
                return UNREADABLE
            try:
                for index in range(min(len(pdf), self._max_pdf_pages)):
                    page = pdf[index]
                    text = page.get_textpage().get_text_range().strip()
                    if len(text) >= MIN_TEXT_LAYER_CHARS:
                        readings.append(Reading(text=text, confident=True))
                    else:
                        readings.append(self._recognize(self._render(page)))
            finally:
                pdf.close()
        text = "\n".join(reading.text for reading in readings if reading.text)
        return Reading(text=text, confident=any(reading.confident for reading in readings))

    def _render(self, page: pdfium.PdfPage) -> Image.Image:
        width, height = page.get_size()
        scale = min(RENDER_SCALE, (self._max_pixels / max(width * height, 1)) ** 0.5)
        return page.render(scale=scale).to_pil().convert("L")

    def _open(self, data: bytes) -> Image.Image | None:
        try:
            image = Image.open(io.BytesIO(data))
            if image.width * image.height > self._max_pixels:
                return None
            return ImageOps.exif_transpose(image).convert("L")  # phone photos carry a rotation
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
            return None

    def _recognize(self, image: Image.Image) -> Reading:
        try:
            data = pytesseract.image_to_data(
                image,
                lang=self._languages,
                output_type=Output.DICT,
                timeout=self._timeout,
            )
        except pytesseract.TesseractNotFoundError as error:
            raise OcrUnavailable("Tesseract is not installed") from error
        except RuntimeError:  # pytesseract reports a timeout this way
            return UNREADABLE

        lines: dict[tuple[int, int, int], list[str]] = {}
        confidences: list[float] = []
        for index, word in enumerate(data["text"]):
            confidence = float(data["conf"][index])
            if word.strip() and confidence >= 0:
                key = (data["block_num"][index], data["par_num"][index], data["line_num"][index])
                lines.setdefault(key, []).append(word)
                confidences.append(confidence)
        text = "\n".join(" ".join(words) for words in lines.values())
        return Reading(
            text=text, confident=bool(confidences) and mean(confidences) >= MIN_CONFIDENCE
        )
