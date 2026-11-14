"""Shared test helpers: a fake OCR, an executor that runs jobs on the spot, and a movable clock."""

from collections.abc import Callable
from concurrent.futures import Executor, Future
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.config import settings as default_settings
from app.main import create_app
from app.scans.ocr import Reading, TesseractOcr

FIXTURES = Path(__file__).parent / "fixtures"


class InlineExecutor(Executor):
    """Runs a job immediately, so a scan is finished when the request returns."""

    def submit(
        self, fn: Callable[..., object], /, *args: object, **kwargs: object
    ) -> Future[object]:
        future: Future[object] = Future()
        future.set_result(fn(*args, **kwargs))
        return future


class DeferredExecutor(Executor):
    """Holds jobs until `run_all()`, so a test can look at a scan while it is still processing."""

    def __init__(self) -> None:
        self.jobs: list[Callable[[], object]] = []

    def submit(
        self, fn: Callable[..., object], /, *args: object, **kwargs: object
    ) -> Future[object]:
        self.jobs.append(lambda: fn(*args, **kwargs))
        return Future()

    def run_all(self) -> None:
        jobs, self.jobs = self.jobs, []
        for job in jobs:
            job()


@dataclass
class FakeOcr:
    text: str = ""
    confident: bool = True
    error: Exception | None = None
    ready: bool = True

    def _read(self) -> Reading:
        if self.error:
            raise self.error
        return Reading(text=self.text, confident=self.confident)

    def read_image(self, data: bytes) -> Reading:
        return self._read()

    def read_pdf(self, data: bytes) -> Reading:
        return self._read()


class Outbox:
    """Collects the emails the app would send."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []

    def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append((to, subject, body))

    def last_token(self) -> str:
        """The secret in the last sign-in link."""
        return self.sent[-1][2].split("#token=")[1].split()[0]


@pytest.fixture
def outbox() -> Outbox:
    return Outbox()


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 11, 13, 10, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return replace(default_settings, data_dir=tmp_path)


@pytest.fixture
def make_client(settings: Settings, clock: Clock, outbox: Outbox) -> Callable[..., TestClient]:
    def build(
        ocr: FakeOcr | None = None,
        executor: Executor | None = None,
        config: Settings | None = None,
        host: str = "testclient",
    ) -> TestClient:
        app = create_app(
            config or settings,
            ocr=ocr or FakeOcr(),
            executor=executor or InlineExecutor(),
            clock=clock,
            mailer=outbox,
        )
        return TestClient(app, client=(host, 50000))

    return build


@pytest.fixture(scope="session")
def real_ocr() -> TesseractOcr:
    """The real Tesseract. Tests that use it are skipped where it is not installed."""
    ocr = TesseractOcr(
        languages=default_settings.ocr_languages,
        timeout=default_settings.ocr_timeout_seconds,
        max_pdf_pages=default_settings.max_pdf_pages,
        max_pixels=default_settings.max_image_pixels,
        command=default_settings.tesseract_cmd,
        tessdata_dir=default_settings.tessdata_dir,
    )
    if not ocr.ready:
        pytest.skip("Tesseract with English and Hindi is not installed")
    return ocr
