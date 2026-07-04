"""Registration notification templates + dispatch helpers."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import NotificationChannel
from app.db.models import Division, Registration, Tournament
from app.modules.notifications.email_queue import queue_email
from app.modules.notifications.service import notify
from app.modules.notifications.templates import NotificationTemplate, register_template
from app.modules.registrations import events
from app.modules.registrations.entrant import entrant_has_external_identity, form_entrant_name

NOTIFY_SUBMITTED = "registration.submitted"
NOTIFY_APPROVED = "registration.approved"
NOTIFY_REJECTED = "registration.rejected"
NOTIFY_WAITLISTED = "registration.waitlisted"
NOTIFY_DRAW_PUBLISHED = "tournament.draw_published"

register_template(
    NotificationTemplate(
        type=NOTIFY_SUBMITTED,
        channels=(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
        in_app_title="Registration received",
        in_app_body="Your registration for {division_name} in {tournament_name} was received.",
        email_template="registration_received",
    )
)
register_template(
    NotificationTemplate(
        type=NOTIFY_APPROVED,
        channels=(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
        in_app_title="Registration confirmed",
        in_app_body="You're in for {division_name} at {tournament_name}.",
        email_template="registration_approved",
    )
)
register_template(
    NotificationTemplate(
        type=NOTIFY_REJECTED,
        channels=(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
        in_app_title="Registration update",
        in_app_body="Your registration for {division_name} at {tournament_name} was not accepted.",
        email_template="registration_rejected",
    )
)
register_template(
    NotificationTemplate(
        type=NOTIFY_WAITLISTED,
        channels=(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
        in_app_title="Added to waitlist",
        in_app_body="You're on the waitlist for {division_name} at {tournament_name}.",
        email_template="registration_waitlisted",
    )
)
register_template(
    NotificationTemplate(
        type=NOTIFY_DRAW_PUBLISHED,
        channels=(NotificationChannel.IN_APP, NotificationChannel.EMAIL),
        in_app_title="Draw is live",
        in_app_body="{tournament_name} bracket is now published.",
        email_template="draw_published",
    )
)


def _entrant_email(registration: Registration) -> str | None:
    form = registration.form_response or {}
    email = form.get("email")
    if not email:
        return None
    text = str(email).strip()
    return text or None


def _payload(
    registration: Registration, *, tournament: Tournament, division: Division
) -> dict[str, str]:
    name = form_entrant_name(registration) or "Player"
    return {
        "name": name,
        "tournament_name": tournament.name,
        "division_name": division.name,
        "tournament_slug": tournament.slug,
    }


async def _notify_registration(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    registration: Registration,
    tournament: Tournament,
    division: Division,
    notif_type: str,
) -> None:
    data = _payload(registration, tournament=tournament, division=division)
    email = _entrant_email(registration)
    if email:
        template = {
            NOTIFY_SUBMITTED: "registration_received",
            NOTIFY_APPROVED: "registration_approved",
            NOTIFY_REJECTED: "registration_rejected",
            NOTIFY_WAITLISTED: "registration_waitlisted",
        }[notif_type]
        await queue_email(
            session,
            to=email,
            template=template,
            data=data,
            organization_id=org_id,
        )
    if not entrant_has_external_identity(registration):
        await notify(
            session,
            organization_id=org_id,
            recipient_user_id=registration.submitted_by,
            type=notif_type,
            data=data,
        )


async def notify_submitted(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    registration: Registration,
    tournament: Tournament,
    division: Division,
) -> None:
    await _notify_registration(
        session,
        org_id=org_id,
        registration=registration,
        tournament=tournament,
        division=division,
        notif_type=events.REGISTRATION_SUBMITTED,
    )


async def notify_approved(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    registration: Registration,
    tournament: Tournament,
    division: Division,
) -> None:
    await _notify_registration(
        session,
        org_id=org_id,
        registration=registration,
        tournament=tournament,
        division=division,
        notif_type=events.REGISTRATION_APPROVED,
    )


async def notify_rejected(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    registration: Registration,
    tournament: Tournament,
    division: Division,
) -> None:
    await _notify_registration(
        session,
        org_id=org_id,
        registration=registration,
        tournament=tournament,
        division=division,
        notif_type=events.REGISTRATION_REJECTED,
    )


async def notify_waitlisted(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    registration: Registration,
    tournament: Tournament,
    division: Division,
) -> None:
    await _notify_registration(
        session,
        org_id=org_id,
        registration=registration,
        tournament=tournament,
        division=division,
        notif_type=events.REGISTRATION_WAITLISTED,
    )


async def notify_draw_published(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    tournament: Tournament,
    recipient_emails: set[str],
    recipient_user_ids: set[uuid.UUID] | None = None,
) -> None:
    data = {
        "name": "Player",
        "tournament_name": tournament.name,
        "tournament_slug": tournament.slug,
    }
    for email in recipient_emails:
        await queue_email(
            session,
            to=email,
            template="draw_published",
            data={**data, "name": email.split("@", 1)[0]},
            organization_id=org_id,
        )
    for user_id in recipient_user_ids or set():
        await notify(
            session,
            organization_id=org_id,
            recipient_user_id=user_id,
            type=NOTIFY_DRAW_PUBLISHED,
            data=data,
        )
