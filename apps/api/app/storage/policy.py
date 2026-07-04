"""Per-``FileKind`` upload policy — allowed MIME types, size ceiling, visibility.

Pure data + pure checks (no FastAPI/DB imports): the files service reads these and
raises the appropriate API error. Adding a new kind (certificate, attachment, …)
is a new enum value + one entry here — no engine or router change.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.db.enums import FileKind

_MB = 1024 * 1024

_IMAGE = frozenset({"image/png", "image/jpeg", "image/webp"})


@dataclass(frozen=True)
class KindPolicy:
    """Upload rules for one file kind."""

    content_types: frozenset[str]
    max_size: int
    public: bool  # public → durable public_url; private → short-lived presigned GET


POLICIES: dict[FileKind, KindPolicy] = {
    FileKind.AVATAR: KindPolicy(_IMAGE, 2 * _MB, public=True),
    FileKind.ORG_LOGO: KindPolicy(_IMAGE, 2 * _MB, public=True),
    FileKind.TOURNAMENT_LOGO: KindPolicy(_IMAGE, 5 * _MB, public=True),
    FileKind.RULES_DOC: KindPolicy(frozenset({"application/pdf"}), 20 * _MB, public=False),
    FileKind.EXPORT: KindPolicy(
        frozenset(
            {
                "text/csv",
                "application/json",
                "application/zip",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }
        ),
        50 * _MB,
        public=False,
    ),
}


def policy_for(kind: FileKind) -> KindPolicy | None:
    return POLICIES.get(kind)


def is_public(kind: FileKind) -> bool:
    policy = POLICIES.get(kind)
    return bool(policy and policy.public)


def is_image(content_type: str) -> bool:
    """Raster image we can probe for dimensions (SVG excluded — it's a vector)."""
    return content_type in _IMAGE
