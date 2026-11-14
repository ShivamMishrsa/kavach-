"""The parts the endpoints share, created once when the app starts."""

from collections.abc import Callable
from concurrent.futures import Executor
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request

from app.accounts.mail import Mailer
from app.accounts.store import AccountStore
from app.core.config import Settings
from app.core.errors import rate_limited
from app.core.ratelimit import RateLimiter
from app.core.signing import keyed_hash
from app.scans.ocr import Ocr
from app.scans.store import ScanStore


@dataclass(frozen=True)
class Services:
    settings: Settings
    store: ScanStore
    ocr: Ocr
    executor: Executor
    clock: Callable[[], datetime]
    limiter: RateLimiter
    email_limiter: RateLimiter
    accounts: AccountStore
    mailer: Mailer


def get_services(request: Request) -> Services:
    services: Services = request.app.state.services
    return services


ServicesDep = Annotated[Services, Depends(get_services)]


def person_key(request: Request, services: Services) -> str:
    """Who is asking, as a keyed hash of the IP address (the address itself is never kept)."""
    host = request.client.host if request.client else "unknown"
    return keyed_hash(services.settings.secret, host)


def limited(action: str):
    """A route dependency that refuses a person who tries `action` too often."""

    def check(request: Request, services: ServicesDep) -> None:
        if not services.limiter.allow(action, person_key(request, services)):
            raise rate_limited()

    return Depends(check)
