"""Two guards around every request: a cap on the size of what is sent, and safe response headers."""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import error_response


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
    """Nothing the API returns may be cached, sniffed, framed or sent on to other sites."""

    def __init__(self, app: ASGIApp, content_security_policy: bool) -> None:
        self.app = app
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
            await send(message)

        await self.app(scope, receive, with_headers)
