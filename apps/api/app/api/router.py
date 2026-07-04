"""Aggregates all module routers under the versioned /api/v1 prefix.

Only this module imports module routers; modules never import each other's routers.
New module: `from app.modules.<x>.router import router as <x>_router` + include it.
"""

from fastapi import APIRouter

from app.core.config import get_settings
from app.modules.auth.router import router as auth_router
from app.modules.courts.router import router as courts_router
from app.modules.files.router import router as files_router
from app.modules.flags.router import router as flags_router
from app.modules.health.router import router as health_router
from app.modules.me.router import router as me_router
from app.modules.notifications.router import router as notifications_router
from app.modules.orgs.router import router as orgs_router
from app.modules.pairing.router import router as pairing_router
from app.modules.public.router import router as public_router
from app.modules.registration_ops.router import router as registration_ops_router
from app.modules.registrations.router import router as registrations_router
from app.modules.scheduling.router import router as scheduling_router
from app.modules.scoring.router import router as scoring_router
from app.modules.share_links.public_router import router as scorekeeper_public_router
from app.modules.share_links.checkin_public_router import router as checkin_public_router
from app.modules.share_links.router import router as share_links_router
from app.modules.franchise_ties.router import router as franchise_ties_router
from app.modules.squads.router import router as squads_router
from app.modules.tournaments.router import router as tournaments_router
from app.realtime.router import router as realtime_router

api_router = APIRouter(prefix=get_settings().api_v1_prefix)
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(me_router)
api_router.include_router(orgs_router)
api_router.include_router(files_router)
api_router.include_router(notifications_router)
api_router.include_router(realtime_router)
api_router.include_router(flags_router)
api_router.include_router(tournaments_router)
api_router.include_router(registrations_router)
api_router.include_router(registration_ops_router)
api_router.include_router(pairing_router)
api_router.include_router(squads_router)
api_router.include_router(franchise_ties_router)
api_router.include_router(scoring_router)
api_router.include_router(share_links_router)
api_router.include_router(scorekeeper_public_router)
api_router.include_router(checkin_public_router)
api_router.include_router(public_router)
api_router.include_router(courts_router)
api_router.include_router(scheduling_router)
