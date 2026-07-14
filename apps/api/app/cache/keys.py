"""Cache key builders — the single source of truth for all Redis key shapes.

All keys follow the scheme:
    {namespace}:v{version}:{scope_type}:{scope_id}:{resource}[:{sub_id}]

Rules:
- Import key functions; never compose key strings inline at call sites.
- Bump the version segment (v1 → v2) to force a cold-start cache eviction without
  a manual flush (old keys simply expire via TTL).
- All IDs are lowercased strings. UUIDs keep their hyphenated form.
- ``public_tournament_keys`` returns all structural keys for a tournament so callers
  can pass the whole dict's values to ``cache.delete_many`` on bulk invalidation.
"""

from __future__ import annotations

import uuid as _uuid

# ── public microsite (unauthenticated) ───────────────────────────────────────


def public_tournament_keys(tournament_id: _uuid.UUID | str) -> dict[str, str]:
    """All structural keys for a public tournament — used for bulk invalidation."""
    tid = str(tournament_id)
    return {
        "overview": f"pub:v1:t:{tid}:overview",
        "divisions": f"pub:v1:t:{tid}:divisions",
        "stages": f"pub:v1:t:{tid}:stages",
        "participants": f"pub:v1:t:{tid}:participants",
        "schedule": f"pub:v1:t:{tid}:schedule",
    }


def public_standings_key(tournament_id: _uuid.UUID | str, stage_id: _uuid.UUID | str) -> str:
    return f"pub:v1:t:{tournament_id}:standings:{stage_id}"


# ── org-scoped (admin surfaces) ───────────────────────────────────────────────


def readiness_key(org_id: _uuid.UUID | str, tournament_id: _uuid.UUID | str) -> str:
    return f"org:v1:o:{org_id}:readiness:{tournament_id}"


def org_settings_key(org_id: _uuid.UUID | str) -> str:
    return f"org:v1:o:{org_id}:settings"


# ── org-scoped static data ───────────────────────────────────────────────────


def sport_profiles_key(org_id: _uuid.UUID | str) -> str:
    """Org-scoped sport profile id→key map. Static at MVP; TTL 3600s, no explicit invalidation."""
    return f"org:v1:o:{org_id}:sport_profiles"


# ── distributed locks ─────────────────────────────────────────────────────────


def draw_lock_key(tournament_id: _uuid.UUID | str) -> str:
    return f"lock:v1:draw:{tournament_id}"


def standings_lock_key(stage_id: _uuid.UUID | str) -> str:
    return f"lock:v1:standings:{stage_id}"


def roster_lock_key(tournament_id: _uuid.UUID | str) -> str:
    return f"lock:v1:roster:{tournament_id}"
