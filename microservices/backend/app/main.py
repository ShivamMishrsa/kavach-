"""Kavach backend entry point."""

from collections.abc import AsyncIterator, Callable
from concurrent.futures import Executor, ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import feedback, scans
from app.core.config import Settings
from app.core.config import settings as default_settings
from app.core.errors import install_error_handlers
from app.scans.ocr import Ocr, TesseractOcr
from app.scans.store import ScanStore, utc_now
from app.services import Services


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
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        if owns_executor:
            services.executor.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(
        title="Kavach API",
        version="0.2.0",
        description="Risk-assessment API for scam triage. Not a legal verdict.",
        lifespan=lifespan,
    )
    app.state.services = services
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    app.include_router(scans.router)
    app.include_router(feedback.router)

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
