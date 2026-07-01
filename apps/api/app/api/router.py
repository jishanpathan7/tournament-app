"""Aggregates all module routers under the versioned /api/v1 prefix.

Only this module imports module routers; modules never import each other's routers.
New module: `from app.modules.<x>.router import router as <x>_router` + include it.
"""

from fastapi import APIRouter

from app.core.config import get_settings
from app.modules.auth.router import router as auth_router
from app.modules.files.router import router as files_router
from app.modules.health.router import router as health_router
from app.modules.notifications.router import router as notifications_router
from app.modules.orgs.router import router as orgs_router

api_router = APIRouter(prefix=get_settings().api_v1_prefix)
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(orgs_router)
api_router.include_router(files_router)
api_router.include_router(notifications_router)
