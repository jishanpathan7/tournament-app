"""Reusable notification templates — one per notification ``type``.

A template declares the default channels a type fans out on, the in-app title/body
(``str.format`` over the event data), and the email renderer template it maps to
(``app/emails`` — Part 3). Modules register their own with ``register_template``;
``notify`` falls back to a plain in-app notification for unregistered types.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.db.enums import NotificationChannel


@dataclass(frozen=True)
class NotificationTemplate:
    type: str
    channels: tuple[NotificationChannel, ...]
    in_app_title: str  # str.format over the notification data
    in_app_body: str
    email_template: str | None = None  # app/emails renderer template name, if email is a channel


_TEMPLATES: dict[str, NotificationTemplate] = {}


def register_template(template: NotificationTemplate) -> None:
    """Register (or replace) the template for a notification type."""
    _TEMPLATES[template.type] = template


def get_template(notification_type: str) -> NotificationTemplate | None:
    return _TEMPLATES.get(notification_type)


def render_in_app(template: NotificationTemplate, data: dict) -> tuple[str, str]:
    return template.in_app_title.format(**data), template.in_app_body.format(**data)


# Built-in platform templates (sport-agnostic). Tournament modules register their own.
register_template(
    NotificationTemplate(
        type="system.announcement",
        channels=(NotificationChannel.IN_APP,),
        in_app_title="{title}",
        in_app_body="{body}",
    )
)
