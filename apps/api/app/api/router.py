"""Aggregates all module routers under the versioned /api/v1 prefix.

Only this module imports module routers; modules never import each other's routers.
New module: `from app.modules.<x>.router import router as <x>_router` + include it.
"""

from fastapi import APIRouter

from app.core.config import get_settings
from app.modules.health.router import router as health_router

api_router = APIRouter(prefix=get_settings().api_v1_prefix)
api_router.include_router(health_router)
