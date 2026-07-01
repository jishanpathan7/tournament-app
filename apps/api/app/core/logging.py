"""Structured JSON logging configuration.

Every record carries the request correlation id (``requestId``) pulled from the
request context, so logs across a request — and Sentry — can be tied together.
"""

import logging

from pythonjsonlogger import jsonlogger

from app.core.context import get_org_id, get_request_id, get_user_id


class RequestContextFilter(logging.Filter):
    """Inject request/principal correlation ids onto every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        record.user_id = get_user_id()
        record.org_id = get_org_id()
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(
        jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(request_id)s %(user_id)s %(org_id)s %(message)s",
            rename_fields={
                "asctime": "time",
                "levelname": "level",
                "request_id": "requestId",
                "user_id": "userId",
                "org_id": "orgId",
            },
        )
    )
    handler.addFilter(RequestContextFilter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    # Quiet noisy access logs in favor of our structured logs.
    logging.getLogger("uvicorn.access").handlers = [handler]
