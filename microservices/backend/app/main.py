"""Kavach backend entry point."""

import asyncio
import logging
import time
from collections.abc import AsyncIterator, Callable
from concurrent.futures import Executor, ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import consent, dossier, feedback, scans
from app.core.config import Settings
from app.core.config import settings as default_settings
from app.core.errors import install_error_handlers
from app.core.jsonl import purge_older_than
from app.core.middleware import BodyLimit, SecurityHeaders
from app.core.ratelimit import RateLimiter
from app.scans.ocr import Ocr, TesseractOcr
from app.scans.store import ScanStore, utc_now
from app.services import Services

RECORDS_PURGE_SECONDS = 60 * 60


def create_app(
    settings: Settings = default_settings,
    *,
    ocr: Ocr | None = None,
    executor: Executor | None = None,
    clock: Callable[[], datetime] = utc_now,
) -> FastAPI:
    """The parts can be replaced, which is how the tests run without Tesseract or threads."""
    owns_executor = executor is None
    services = Services(
        settings=settings,
        store=ScanStore(timedelta(seconds=settings.scan_ttl_seconds), clock),
        ocr=ocr
        or TesseractOcr(
            languages=settings.ocr_languages,
            timeout=settings.ocr_timeout_seconds,
            max_pdf_pages=settings.max_pdf_pages,
            max_pixels=settings.max_image_pixels,
            command=settings.tesseract_cmd,
            tessdata_dir=settings.tessdata_dir,
        ),
        executor=executor or ThreadPoolExecutor(max_workers=settings.workers),
        clock=clock,
        limiter=RateLimiter(settings.rate_limit, settings.rate_window_seconds, clock),
    )

    def purge_old_records() -> None:
        cutoff = services.clock() - timedelta(days=settings.retention_days)
        for path in (settings.consent_path, settings.feedback_path):
            purge_older_than(path, cutoff)

    async def sweep() -> None:
        """Deletes expired scans on a timer, so they go even when nobody is using the service.
        Old consent and feedback records are deleted once an hour."""
        next_records = 0.0
        while True:
            await asyncio.sleep(settings.purge_interval_seconds)
            services.store.purge()
            if time.monotonic() >= next_records:
                next_records = time.monotonic() + RECORDS_PURGE_SECONDS
                await asyncio.to_thread(purge_old_records)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        sweeper = asyncio.create_task(sweep())
        yield
        sweeper.cancel()
        if owns_executor:
            services.executor.shutdown(wait=False, cancel_futures=True)

    # The server's own access log prints every visitor's IP address. The privacy policy says we do
    # not keep it, so it is switched off whichever way the server is started.
    logging.getLogger("uvicorn.access").disabled = True

    in_development = settings.env == "dev"
    app = FastAPI(
        title="Kavach API",
        version="0.3.0",
        description="Risk-assessment API for scam triage. Not a legal verdict.",
        lifespan=lifespan,
        docs_url="/docs" if in_development else None,  # the docs page needs scripts the CSP blocks
        redoc_url=None,
    )
    app.state.services = services
    # The last one added is the outermost, so every response (also the refusals) gets CORS headers.
    app.add_middleware(BodyLimit, max_bytes=settings.max_body_bytes)
    app.add_middleware(SecurityHeaders, content_security_policy=not in_development)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    for router in (scans.router, dossier.router, consent.router, feedback.router):
        app.include_router(router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "kavach-backend",
            "version": app.version,
            "ocr": "ready" if services.ocr.ready else "unavailable",
        }

    return app


app = create_app()
