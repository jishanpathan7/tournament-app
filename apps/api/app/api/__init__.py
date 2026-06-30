"""HTTP API layer.

`core/` is how the app talks to the outside world (infra: config, db, ports,
logging). `api/` is how the outside world talks to the app: the router
aggregator plus the cross-cutting contract every module reuses — base schemas,
RFC 9457 errors, cursor pagination, shared dependencies, middleware.
"""

from app.api.router import api_router

__all__ = ["api_router"]
