"""Runs one scan in the background: read -> look for signs -> report."""

import logging
from dataclasses import dataclass

from app.detection.assess import assess_link, assess_text
from app.scans.ingest import FileKind
from app.scans.ocr import Ocr, Reading
from app.scans.store import ScanStore

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FileSource:
    data: bytes
    kind: FileKind


@dataclass(frozen=True)
class TextSource:
    text: str


@dataclass(frozen=True)
class LinkSource:
    url: str  # already normalised


Source = FileSource | TextSource | LinkSource


def _read(ocr: Ocr, source: FileSource | TextSource) -> Reading:
    if isinstance(source, TextSource):
        return Reading(text=source.text, confident=True)
    return ocr.read_image(source.data) if source.kind == "image" else ocr.read_pdf(source.data)


def run_scan(store: ScanStore, ocr: Ocr, scan_id: str, source: Source) -> None:
    try:
        if isinstance(source, LinkSource):
            store.advance(scan_id)  # a link has nothing to read
            result = assess_link(source.url)
        else:
            reading = _read(ocr, source)
            store.advance(scan_id)  # read
            result = assess_text(reading.text, confident=reading.confident)
        store.advance(scan_id)  # signs checked
    except Exception as error:
        # Only the kind of error is logged: its message could contain what the person sent.
        logger.error("scan failed: %s", type(error).__name__)
        store.fail(scan_id)
        return
    store.finish(scan_id, result)
