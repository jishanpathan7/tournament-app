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
        in_app_title="Tournament is now live",
        in_app_body="{tournament_name} has started.",
        priority=NotificationPriority.IMPORTANT,
        icon="radio",
        cta_label="Go to matches",
        cta_href="/console/tournaments/{tournament_id}/matches",
    )
)

register_template(
    NotificationTemplate(
        type="tournament.completed",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Tournament completed",
        in_app_body="{tournament_name} has finished. Results are ready to publish.",
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
        in_app_title="Draw generated",
        in_app_body="{stage_name} bracket is ready to review.",
        priority=NotificationPriority.IMPORTANT,
        icon="network",
        cta_label="View bracket",
        cta_href="/console/tournaments/{tournament_id}/draws",
    )
)

register_template(
    NotificationTemplate(
        type="stage.knockout_generated",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Knockout stage generated",
        in_app_body="The knockout bracket has been set from group stage results.",
        priority=NotificationPriority.IMPORTANT,
        icon="swords",
        cta_label="View bracket",
        cta_href="/console/tournaments/{tournament_id}/draws",
    )
)

register_template(
    NotificationTemplate(
        type="registration.closed",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Registration closed",
        in_app_body="{tournament_name} registration window has closed.",
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
        in_app_title="Final standings published",
        in_app_body="{tournament_name} results are now public.",
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
        in_app_title="Court idle: {court_name}",
        in_app_body="{court_name} has had no active match for {idle_minutes} minutes.",
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
        in_app_title="Match stalled: {court_name}",
        in_app_body=(
            "A live match on {court_name} has had no score update"
            " for {stalled_minutes} minutes."
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
        in_app_title="Check-in rate low",
        in_app_body=(
            "Only {checked_in}/{total} participants checked in."
            " Tournament starts in {minutes_to_start} min."
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
        in_app_title="Draw generation failed",
        in_app_body="{error_summary}",
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="x-circle",
        cta_label="Retry",
        cta_href="/console/tournaments/{tournament_id}/draws",
    )
)

register_template(
    NotificationTemplate(
        type="ops.scheduling_conflict",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Scheduling conflict",
        in_app_body="{conflict_count} match(es) are double-booked on the same court.",
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="calendar-x",
        cta_label="Resolve",
        cta_href="/console/tournaments/{tournament_id}/schedule",
    )
)

register_template(
    NotificationTemplate(
        type="ops.tournament_blocked",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="Tournament cannot progress",
        in_app_body="{block_reason}",
        priority=NotificationPriority.ACTION_REQUIRED,
        icon="shield-alert",
        cta_label="Fix issue",
        cta_href="/console/tournaments/{tournament_id}/readiness",
    )
)
