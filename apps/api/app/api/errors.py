"""RFC 9457 Problem Details + the application exception hierarchy.

Services raise ``AppError`` subclasses; routers stay thin. Pydantic/FastAPI
validation errors, Starlette HTTP errors, and uncaught exceptions are all mapped
to ``application/problem+json`` with a stable shape and the request's correlation
id. Register once in ``create_app`` via ``register_exception_handlers``.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.schemas import ApiModel
from app.core.context import get_request_id

logger = logging.getLogger("app.error")

PROBLEM_CONTENT_TYPE = "application/problem+json"


class FieldError(ApiModel):
    field: str
    message: str
    type: str | None = None


class ProblemDetail(ApiModel):
    """RFC 9457 problem object (+ `code`, `requestId`, `errors[]` extensions)."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
    code: str | None = None
    request_id: str | None = None
    errors: list[FieldError] | None = None


class AppError(Exception):
    """Base domain exception. Subclasses set status/title/code; services raise these."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    title: str = "Internal Server Error"
    code: str = "internal_error"

    def __init__(
        self,
        detail: str | None = None,
        *,
        errors: list[FieldError] | None = None,
        code: str | None = None,
    ) -> None:
        self.detail = detail
        self.errors = errors
        if code is not None:
            self.code = code  # per-instance override of the class default
        super().__init__(detail or self.title)


class AuthenticationError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    title = "Unauthorized"
    code = "unauthorized"


class PermissionDeniedError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    title = "Forbidden"
    code = "permission_denied"


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    title = "Not Found"
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    title = "Conflict"
    code = "conflict"


class PreconditionFailedError(AppError):
    status_code = status.HTTP_412_PRECONDITION_FAILED
    title = "Precondition Failed"
    code = "precondition_failed"


class ValidationError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    title = "Unprocessable Entity"
    code = "validation_error"


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    title = "Too Many Requests"
    code = "rate_limited"


def _problem(
    request: Request,
    status_code: int,
    title: str,
    *,
    detail: str | None = None,
    code: str | None = None,
    errors: list[FieldError] | None = None,
) -> JSONResponse:
    problem = ProblemDetail(
        title=title,
        status=status_code,
        detail=detail,
        code=code,
        instance=request.url.path,
        request_id=get_request_id(),
        errors=errors,
    )
    return JSONResponse(
        status_code=status_code,
        content=problem.model_dump(by_alias=True, exclude_none=True),
        media_type=PROBLEM_CONTENT_TYPE,
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        return _problem(
            request, exc.status_code, exc.title, detail=exc.detail, code=exc.code, errors=exc.errors
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            FieldError(
                field=".".join(str(p) for p in err["loc"] if p != "body"),
                message=err["msg"],
                type=err.get("type"),
            )
            for err in exc.errors()
        ]
        return _problem(
            request,
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Unprocessable Entity",
            detail="Request validation failed",
            code="validation_error",
            errors=errors,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        title = exc.detail if isinstance(exc.detail, str) else "HTTP Error"
        return _problem(request, exc.status_code, title)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Log with traceback; never leak internals to the client.
        logger.exception("unhandled_error", extra={"path": request.url.path})
        return _problem(
            request,
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Internal Server Error",
            code="internal_error",
        )
