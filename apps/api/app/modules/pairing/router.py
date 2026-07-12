"""Smart Pairing HTTP endpoints — generate/read/edit/swap/publish a division's teams.

Mutations are guarded by ``tournament:update`` + CSRF (organizer setup action); reads
are org-scoped (RLS + repo). The draft run is addressable per division; edits target a
proposed team or a member swap within a run.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Principal,
    authed_csrf,
    get_principal,
    get_request_session,
    require_permission,
)
from app.core import authz
from app.modules.pairing import service
from app.modules.pairing.schemas import (
    AddDuplicatePairRequest,
    GeneratePairingRequest,
    PairingRunView,
    PartnerWarningsResponse,
    ProposedTeamView,
    PublishPairingResponse,
    RepairPairingResponse,
    SwapMembersRequest,
    UpdateProposedTeamRequest,
)

router = APIRouter(tags=["pairing"])

_manage = require_permission(authz.TOURNAMENT_UPDATE)


@router.post(
    "/divisions/{division_id}/pairing/generate",
    response_model=PairingRunView,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(authed_csrf)],
)
async def generate_pairing(
    division_id: uuid.UUID,
    body: GeneratePairingRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> PairingRunView:
    run = await service.generate(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        division_id=division_id,
        rng_seed=body.rng_seed,
        forced_groups=body.forced_groups,
        forbidden_pairs=body.forbidden_pairs,
        squad_id=body.squad_id,
    )
    return await service.build_run_view(session, principal.organization_id, run)


@router.get(
    "/divisions/{division_id}/pairing/partner-warnings",
    response_model=PartnerWarningsResponse,
)
async def get_partner_warnings(
    division_id: uuid.UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> PartnerWarningsResponse:
    return await service.get_partner_warnings(
        session, org_id=principal.organization_id, division_id=division_id
    )


@router.get("/divisions/{division_id}/pairing", response_model=PairingRunView | None)
async def get_pairing(
    division_id: uuid.UUID,
    squad_id: uuid.UUID | None = Query(default=None),
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_request_session),
) -> PairingRunView | None:
    run = await service.get_active_run(
        session, principal.organization_id, division_id, squad_id=squad_id
    )
    if run is None:
        return None
    return await service.build_run_view(session, principal.organization_id, run)


@router.patch(
    "/pairing/teams/{team_id}",
    response_model=ProposedTeamView,
    dependencies=[Depends(authed_csrf)],
)
async def update_team(
    team_id: uuid.UUID,
    body: UpdateProposedTeamRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> ProposedTeamView:
    team = await service.update_team(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        team_id=team_id,
        locked=body.locked,
        team_name=body.team_name,
        clear_team_name=body.clear_team_name,
    )
    return ProposedTeamView(
        id=team.id,
        member_ids=[uuid.UUID(m) for m in team.member_ids],
        strength=float(team.strength),
        confidence=float(team.confidence),
        reasons=list(team.reasons or []),
        locked=team.locked,
        team_name=team.team_name,
    )


@router.post(
    "/pairing/runs/{run_id}/swap",
    response_model=PairingRunView,
    dependencies=[Depends(authed_csrf)],
)
async def swap_members(
    run_id: uuid.UUID,
    body: SwapMembersRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> PairingRunView:
    run = await service.swap_members(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        run_id=run_id,
        member_a=body.member_a,
        member_b=body.member_b,
    )
    return await service.build_run_view(session, principal.organization_id, run)


@router.post(
    "/pairing/runs/{run_id}/publish",
    response_model=PublishPairingResponse,
    dependencies=[Depends(authed_csrf)],
)
async def publish_pairing(
    run_id: uuid.UUID,
    response: Response,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> PublishPairingResponse:
    published, unpaired = await service.publish(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        run_id=run_id,
    )
    return PublishPairingResponse(run_id=run_id, published_teams=published, unpaired_count=unpaired)


@router.post(
    "/pairing/runs/{run_id}/duplicate-pair",
    response_model=PairingRunView,
    dependencies=[Depends(authed_csrf)],
    summary="Add a duplicate pair to resolve an odd-one-out player",
    description=(
        "When a squad has an odd number of players the engine leaves one player unpaired. "
        "The captain resolves this by choosing an existing player to partner the odd-one-out, "
        "allowing that player to compete in two pairs.  The resulting pair is locked so a "
        "regenerate does not remove it."
    ),
)
async def add_duplicate_pair(
    run_id: uuid.UUID,
    body: AddDuplicatePairRequest,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> PairingRunView:
    run = await service.add_duplicate_pair(
        session,
        org_id=principal.organization_id,
        actor_id=principal.user_id,
        run_id=run_id,
        unpaired_id=body.unpaired_id,
        duplicate_id=body.duplicate_id,
    )
    return await service.build_run_view(session, principal.organization_id, run)


@router.post(
    "/divisions/{division_id}/pairing/repair-rosters",
    response_model=RepairPairingResponse,
    dependencies=[Depends(authed_csrf)],
)
async def repair_pairing_rosters(
    division_id: uuid.UUID,
    principal: Principal = Depends(_manage),
    session: AsyncSession = Depends(get_request_session),
) -> RepairPairingResponse:
    repaired = await service.repair_published_rosters(
        session,
        org_id=principal.organization_id,
        division_id=division_id,
    )
    return RepairPairingResponse(teams_repaired=repaired)
