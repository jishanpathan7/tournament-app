"""Reusable notification templates — one per notification ``type``.

A template declares the default channels a type fans out on, the in-app title/body
(``str.format`` over the event data), and the email renderer template it maps to
(``app/emails`` — Part 3). Modules register their own with ``register_template``;
``notify`` falls back to a plain in-app notification for unregistered types.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.db.enums import NotificationChannel, NotificationPriority


@dataclass(frozen=True)
class NotificationTemplate:
    type: str
    channels: tuple[NotificationChannel, ...]
    in_app_title: str  # str.format over the notification data
    in_app_body: str
    email_template: str | None = None  # app/emails renderer template name, if email is a channel
    priority: NotificationPriority = field(default=NotificationPriority.INFO)
    icon: str = "bell"
    cta_label: str | None = None
    # cta_href supports {tournament_id} / {match_id} placeholders formatted at notify() time
    cta_href: str | None = None


_TEMPLATES: dict[str, NotificationTemplate] = {}


def register_template(template: NotificationTemplate) -> None:
    """Register (or replace) the template for a notification type."""
    _TEMPLATES[template.type] = template


def get_template(notification_type: str) -> NotificationTemplate | None:
    return _TEMPLATES.get(notification_type)


def render_in_app(template: NotificationTemplate, data: dict) -> tuple[str, str]:
    return template.in_app_title.format(**data), template.in_app_body.format(**data)


def render_cta_href(template: NotificationTemplate, data: dict) -> str | None:
    if template.cta_href is None:
        return None
    try:
        return template.cta_href.format(**data)
    except KeyError:
        return template.cta_href


# --- Built-in platform templates (sport-agnostic) ---

register_template(
    NotificationTemplate(
        type="system.announcement",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="{title}",
        in_app_body="{body}",
        priority=NotificationPriority.IMPORTANT,
        icon="megaphone",
    )
)

# --- Organizer Important Updates ---

register_template(
    NotificationTemplate(
        type="tournament.went_live",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="{tournament_name} is live",
        in_app_body="Matches are open. Head to the Live view to start calling courts.",
        priority=NotificationPriority.IMPORTANT,
        icon="radio",
        cta_label="Go to Live",
        cta_href="/console/tournaments/{tournament_id}/live",
    )
)

register_template(
    NotificationTemplate(
        type="tournament.completed",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="{tournament_name} is wrapped up",
        in_app_body="All matches are done. Publish the final standings when you're ready.",
        priority=NotificationPriority.IMPORTANT,
        icon="trophy",
        cta_label="Publish results",
        cta_href="/console/tournaments/{tournament_id}/results",
    )
)

register_template(
    NotificationTemplate(
        type="stage.draw_generated",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="{stage_name} draw is ready",
        in_app_body="Review the bracket before going live — make any manual adjustments now.",
        priority=NotificationPriority.IMPORTANT,
        icon="network",
        cta_label="Review bracket",
        cta_href="/console/tournaments/{tournament_id}/draws",
    )
)

register_template(
    NotificationTemplate(
        type="stage.knockout_generated",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Knockout bracket is set",
        in_app_body=(
            "Group stage results are in. The knockout draw has been seeded automatically."
        ),
        priority=NotificationPriority.IMPORTANT,
        icon="swords",
        cta_label="Review bracket",
        cta_href="/console/tournaments/{tournament_id}/draws",
    )
)

register_template(
    NotificationTemplate(
        type="registration.closed",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Registration closed for {tournament_name}",
        in_app_body=(
            "No new sign-ups will be accepted. Review the list and approve pending entries."
        ),
        priority=NotificationPriority.IMPORTANT,
        icon="lock",
        cta_label="Review registrations",
        cta_href="/console/tournaments/{tournament_id}/registrations",
    )
)

register_template(
    NotificationTemplate(
        type="standings.final_published",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Results are public for {tournament_name}",
        in_app_body="Final standings are live on the public page.",
        priority=NotificationPriority.IMPORTANT,
        icon="bar-chart-2",
        cta_label="View public page",
        cta_href="/t/{tournament_slug}/results",
    )
)

# --- Organizer Action Required ---

register_template(
    NotificationTemplate(
        type="ops.court_idle",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="{court_name} has been idle for {idle_minutes} min",
        in_app_body=(
            "No match is running on this court." " Assign the next pair to keep things moving."
        ),
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="alert-triangle",
        cta_label="Assign next match",
        cta_href="/console/tournaments/{tournament_id}/live",
    )
)

register_template(
    NotificationTemplate(
        type="ops.match_stalled",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Score missing on {court_name} ({stalled_minutes} min)",
        in_app_body=(
            "A live match has had no score update in a while."
            " Check with the scorekeeper or enter the score manually."
        ),
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="alert-triangle",
        cta_label="Enter score",
        cta_href="/console/tournaments/{tournament_id}/matches",
    )
)

register_template(
    NotificationTemplate(
        type="ops.checkin_low",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Only {checked_in} of {total} players checked in",
        in_app_body=(
            "Tournament starts in {minutes_to_start} min."
            " Reach out to missing players or adjust the draw."
        ),
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="user-x",
        cta_label="Open check-in",
        cta_href="/console/tournaments/{tournament_id}/attendance",
    )
)

register_template(
    NotificationTemplate(
        type="ops.draw_failed",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Draw couldn't be generated",
        in_app_body="{error_summary}",
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="x-circle",
        cta_label="Try again",
        cta_href="/console/tournaments/{tournament_id}/draws",
    )
)

register_template(
    NotificationTemplate(
        type="ops.scheduling_conflict",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="{conflict_count} scheduling conflict(s) need fixing",
        in_app_body="Two or more matches are double-booked on the same court at the same time.",
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="calendar-x",
        cta_label="Fix schedule",
        cta_href="/console/tournaments/{tournament_id}/schedule",
    )
)

register_template(
    NotificationTemplate(
        type="ops.tournament_blocked",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Tournament can't go live yet",
        in_app_body="{block_reason}",
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="shield-alert",
        cta_label="Fix issue",
        cta_href="/console/tournaments/{tournament_id}/readiness",
    )
)
