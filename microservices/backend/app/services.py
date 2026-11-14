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
from app.core.errors import busy, rate_limited
from app.core.metrics import Metrics
from app.core.ratelimit import DailyCap, RateLimiter
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
    daily_scans: DailyCap
    metrics: Metrics


def get_services(request: Request) -> Services:
    services: Services = request.app.state.services
    return services


ServicesDep = Annotated[Services, Depends(get_services)]


def client_address(request: Request, hops: int) -> str:
    """The address of the person, also behind `hops` reverse proxies that we run or trust.

    Each proxy adds the address it received the request from to the end of `X-Forwarded-For`, so
    the person's address is `hops` entries from the end. Anything earlier in the header was
    written by the person (or by someone passing the request on) and can be made up, so it is
    never used. With no proxy (`hops` = 0) the header is ignored completely.
    """
    if hops > 0:
        forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",")]
        forwarded = [part for part in forwarded if part]
        if len(forwarded) >= hops:
            return forwarded[-hops]
    return request.client.host if request.client else "unknown"


def person_key(request: Request, services: Services) -> str:
    """Who is asking, as a keyed hash of the IP address (the address itself is never kept)."""
    address = client_address(request, services.settings.proxy_hops)
    return keyed_hash(services.settings.secret, address)


def within_daily_cap(services: ServicesDep) -> None:
    """Refuses new checks once the day's total is used up (the cost cap)."""
    if not services.daily_scans.take():
        services.metrics.count("busy")
        raise busy()


def limited(action: str):
    """A route dependency that refuses a person who tries `action` too often."""

    def check(request: Request, services: ServicesDep) -> None:
        if not services.limiter.allow(action, person_key(request, services)):
            services.metrics.count("rate_limited", action=action)
            raise rate_limited()

    return Depends(check)
