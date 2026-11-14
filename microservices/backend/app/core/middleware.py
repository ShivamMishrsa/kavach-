"""Two guards around every request: a cap on the size of what is sent, and safe response headers."""

import logging

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import error_response
from app.core.metrics import Metrics

logger = logging.getLogger(__name__)


class _TooLarge(BaseException):  # not an Exception: FastAPI turns those into a generic 400
    pass


class BodyLimit:
    """Stops a request whose body is bigger than `max_bytes`, before it is read into memory/disk."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope["headers"]).get(b"content-length", b"0")
        if not declared.isdigit() or int(declared) > self.max_bytes:
            await error_response("invalid_input", 413)(scope, receive, send)
            return

        received = 0

        async def counted() -> Message:
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.max_bytes:
                raise _TooLarge
            return message

        try:
            await self.app(scope, counted, send)
        except _TooLarge:
            await error_response("invalid_input", 413)(scope, receive, send)


class SecurityHeaders:
    """Nothing the API returns may be cached, sniffed, framed or sent on to other sites.

    This also covers a crash: a mistake inside the server ends as a plain "server_error" answer
    with the same headers, and nothing about it is sent out. Only the kind of error is logged.
    """

    def __init__(
        self, app: ASGIApp, content_security_policy: bool, metrics: Metrics | None = None
    ) -> None:
        self.app = app
        self.metrics = metrics
        self.headers = {
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
        }
        if content_security_policy:
            self.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message).update(self.headers)
                if self.metrics:
                    self.metrics.count("http_responses", status=f"{message['status'] // 100}xx")
            await send(message)

        started = False

        async def track(message: Message) -> None:
            nonlocal started
            started = started or message["type"] == "http.response.start"
            await with_headers(message)

        try:
            await self.app(scope, receive, track)
        except Exception as error:
            logger.error("request failed: %s", type(error).__name__)
            if started:
                raise
            await error_response("server_error", 500)(scope, receive, with_headers)
