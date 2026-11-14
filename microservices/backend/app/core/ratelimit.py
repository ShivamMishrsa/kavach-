"""Limits how often one person can start something (a scan, a PDF, feedback, a consent record)."""

import threading
from collections import deque
from collections.abc import Callable
from datetime import datetime


class RateLimiter:
    """At most `limit` tries per `window` seconds for each (action, person) pair."""

    def __init__(self, limit: int, window: float, clock: Callable[[], datetime]) -> None:
        self._limit = limit
        self._window = window
        self._clock = clock
        self._lock = threading.Lock()
        self._tries: dict[tuple[str, str], deque[float]] = {}

    def allow(self, action: str, person: str) -> bool:
        now = self._clock().timestamp()
        with self._lock:
            self._forget_old(now)
            tries = self._tries.setdefault((action, person), deque())
            if len(tries) >= self._limit:
                return False
            tries.append(now)
            return True

    def _forget_old(self, now: float) -> None:
        for key, tries in list(self._tries.items()):
            while tries and now - tries[0] >= self._window:
                tries.popleft()
            if not tries:
                del self._tries[key]
