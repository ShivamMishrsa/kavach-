"""The parts the endpoints share, created once when the app starts."""

from collections.abc import Callable
from concurrent.futures import Executor
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request

from app.core.config import Settings
from app.scans.ocr import Ocr
from app.scans.store import ScanStore


@dataclass(frozen=True)
class Services:
    settings: Settings
    store: ScanStore
    ocr: Ocr
    executor: Executor
    clock: Callable[[], datetime]


def get_services(request: Request) -> Services:
    services: Services = request.app.state.services
    return services


ServicesDep = Annotated[Services, Depends(get_services)]
