"""Transactional email rendering — Jinja2 templates + a shared HTML layout.

One place turns a ``(template, data)`` pair into a ``RenderedEmail`` (subject +
HTML + plaintext). Both the Resend and Log channels render through here, so
callers only ever pass a template name and data — never raw HTML/subjects
(tournament modules must not hand-roll emails). ``StrictUndefined`` makes a
template/data mismatch a loud error instead of a silent blank.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.core.config import Settings

_TEMPLATES_DIR = Path(__file__).parent / "templates"

# Subject line (a Jinja string) for each transactional template.
_SUBJECTS: dict[str, str] = {
    "verify_email": "Verify your {{ app_name }} email",
    "password_reset": "Reset your {{ app_name }} password",
    "org_invite": "You've been invited to {{ app_name }}",
    "scorekeeper_invite": "Scorekeeper invite — {{ tournament_name }}",
    "registration_received": "Registration received — {{ tournament_name }}",
    "registration_approved": "You're in — {{ tournament_name }}",
    "registration_rejected": "Registration update — {{ tournament_name }}",
    "registration_waitlisted": "Waitlist — {{ tournament_name }}",
    "draw_published": "Draw is live — {{ tournament_name }}",
    "tournament_member_added": "You're on the team — {{ tournament_name }}",
    "tournament_invite": "You've been invited to help run {{ tournament_name }}",
}

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
    undefined=StrictUndefined,
)


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


_ANCHOR = re.compile(r'(?is)<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>')
_TAG = re.compile(r"<[^>]+>")
_BLANKS = re.compile(r"\n\s*\n\s*")


def _html_to_text(html: str) -> str:
    """Serviceable plaintext fallback — keeps link URLs so token links survive."""
    text = re.sub(r"(?is)<(script|style).*?</\1>", "", html)
    text = _ANCHOR.sub(lambda m: f"{m.group(2)} ( {m.group(1)} )", text)
    text = text.replace("</p>", "\n\n").replace("<br>", "\n").replace("<br/>", "\n")
    text = _TAG.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    return _BLANKS.sub("\n\n", text).strip()


def known_templates() -> frozenset[str]:
    return frozenset(_SUBJECTS)


def render(template: str, data: dict[str, Any], *, settings: Settings) -> RenderedEmail:
    if template not in _SUBJECTS:
        raise ValueError(f"Unknown email template: {template}")
    ctx: dict[str, Any] = {
        "app_name": settings.app_name,
        "frontend_url": settings.frontend_url.rstrip("/"),
        **data,
    }
    subject = _env.from_string(_SUBJECTS[template]).render(ctx)
    html = _env.get_template(f"{template}.html").render(ctx)
    return RenderedEmail(subject=subject, html=html, text=_html_to_text(html))
