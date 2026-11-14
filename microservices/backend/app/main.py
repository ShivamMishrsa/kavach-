"""Kavach backend entry point."""

import asyncio
import hmac
import logging
import time
from collections.abc import AsyncIterator, Callable
from concurrent.futures import Executor, ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from app.accounts.mail import FileMailer, Mailer, NoMailer, SmtpMailer
from app.accounts.store import AccountStore
from app.api import account, auth, consent, dossier, feedback, scans
from app.core.config import Settings
from app.core.config import settings as default_settings
from app.core.errors import install_error_handlers, not_found, unauthorized
from app.core.jsonl import purge_older_than
from app.core.metrics import Metrics
from app.core.middleware import BodyLimit, SecurityHeaders
from app.core.ratelimit import DailyCap, RateLimiter
from app.scans.ocr import Ocr, TesseractOcr
from app.scans.store import ScanStore, utc_now
from app.services import Services


def default_mailer(settings: Settings) -> Mailer:
    if settings.smtp_host:
        return SmtpMailer(
            settings.smtp_host,
            settings.smtp_port,
            settings.smtp_user,
            settings.smtp_password,
            settings.mail_from,
        )
    return FileMailer(settings.outbox_path) if settings.env == "dev" else NoMailer()


def create_app(
    settings: Settings = default_settings,
    *,
    ocr: Ocr | None = None,
    executor: Executor | None = None,
    clock: Callable[[], datetime] = utc_now,
    mailer: Mailer | None = None,
) -> FastAPI:
    """The parts can be replaced, which is how the tests run without Tesseract or threads."""
    owns_executor = executor is None
    metrics = Metrics()
    services = Services(
        settings=settings,
        store=ScanStore(timedelta(seconds=settings.scan_ttl_seconds), clock, metrics),
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
        email_limiter=RateLimiter(settings.email_limit, settings.email_window_seconds, clock),
        accounts=AccountStore(
            settings.database_path,
            clock,
            link_ttl=timedelta(minutes=settings.login_link_minutes),
            session_ttl=timedelta(days=settings.session_days),
            inactive_ttl=timedelta(days=settings.inactive_account_days),
        ),
        mailer=mailer or default_mailer(settings),
        daily_scans=DailyCap(settings.max_scans_per_day, clock),
        metrics=metrics,
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
            services.accounts.purge()
            if time.monotonic() >= next_records:
                next_records = time.monotonic() + settings.records_purge_seconds
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
        version="0.4.0",
        description="Risk-assessment API for scam triage. Not a legal verdict.",
        lifespan=lifespan,
        docs_url="/docs" if in_development else None,  # the docs page needs scripts the CSP blocks
        redoc_url=None,
    )
    app.state.services = services
    # The last one added is the outermost, so every response (also the refusals) gets CORS headers.
    app.add_middleware(BodyLimit, max_bytes=settings.max_body_bytes)
    app.add_middleware(SecurityHeaders, content_security_policy=not in_development, metrics=metrics)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,  # the session cookie; origins are listed, never "*"
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    routers = (scans.router, dossier.router, consent.router, feedback.router)
    for router in (*routers, auth.router, account.router):
        app.include_router(router)

    @app.get("/metrics", include_in_schema=False)
    def show_metrics(request: Request) -> PlainTextResponse:
        """Counters for the operator. Does not exist unless KAVACH_METRICS_TOKEN is set."""
        if not settings.metrics_token:
            raise not_found()
        expected = f"Bearer {settings.metrics_token}".encode()
        if not hmac.compare_digest(request.headers.get("authorization", "").encode(), expected):
            raise unauthorized()
        return PlainTextResponse(metrics.render())

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
