"""Errors the website understands. Messages shown to people come from its translation files."""

from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

ErrorCode = Literal[
    "not_found",
    "invalid_input",
    "rate_limited",
    "unauthorized",
    "forbidden",
    "server_error",
    "busy",
]


class ApiProblem(Exception):
    code: ErrorCode
    status_code: int

    def __init__(self, code: ErrorCode, status_code: int) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code


def not_found() -> ApiProblem:
    return ApiProblem("not_found", 404)


def invalid_input() -> ApiProblem:
    return ApiProblem("invalid_input", 400)


def rate_limited() -> ApiProblem:
    return ApiProblem("rate_limited", 429)


def unauthorized() -> ApiProblem:
    return ApiProblem("unauthorized", 401)


def busy() -> ApiProblem:
    return ApiProblem("busy", 503)


def forbidden() -> ApiProblem:
    return ApiProblem("forbidden", 403)


def error_response(code: ErrorCode, status_code: int) -> JSONResponse:
    return JSONResponse({"error": {"code": code}}, status_code=status_code)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiProblem)
    async def _problem(_: Request, problem: ApiProblem) -> JSONResponse:
        return error_response(problem.code, problem.status_code)

    @app.exception_handler(RequestValidationError)
    async def _invalid(_: Request, __: RequestValidationError) -> JSONResponse:
        # The details can echo what the person sent, so they are not returned or logged.
        return error_response("invalid_input", 400)
