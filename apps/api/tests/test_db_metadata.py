"""Metadata-only checks (no database required) — guard the model/RLS surface."""

import app.db.models  # noqa: F401  -- importing registers every table on Base.metadata
from app.db.base import Base
from app.db.enums import ALL_PG_ENUMS
from app.db.rls import GLOBAL_OR_TENANT_TABLES, NO_RLS_TABLES, TENANT_STRICT_TABLES

EXPECTED_TABLES = {
    # identity
    "users",
    "organizations",
    "memberships",
    "identities",
    "auth_sessions",
    "auth_tokens",
    "org_invites",
    # sport
    "sport_profiles",
    "points_rules",
    "tiebreak_rulesets",
    # tournament
    "tournaments",
    "divisions",
    "stages",
    "groups",
    "rounds",
    # participants
    "teams",
    "roster_entries",
    "squads",
    "squad_members",
    "participants",
    "registrations",
    "pairing_requests",
    "pairing_runs",
    "proposed_teams",
    "mapping_templates",
    "import_batches",
    # competition
    "matches",
    "match_participants",
    "match_result_events",
    "standings",
    # logistics
    "venues",
    "courts",
    "tournament_courts",
    "schedule_slots",
    "assignments",
    # crosscutting
    "share_links",
    "files",
    "notifications",
    "outbox",
    "audit_logs",
    "idempotency_keys",
    "feature_flags",
}


def test_all_tables_registered():
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_every_table_has_pk_and_timestamps():
    for name, table in Base.metadata.tables.items():
        assert "id" in table.c, name
        assert "created_at" in table.c, name
        assert "updated_at" in table.c, name


def test_tenant_strict_tables_have_org_id_not_null():
    for name in TENANT_STRICT_TABLES:
        col = Base.metadata.tables[name].c.get("organization_id")
        assert col is not None, name
        assert not col.nullable, name


def test_matches_have_no_versus_columns():
    # Sport-agnostic core: sides live in match_participants, not home/away columns.
    cols = Base.metadata.tables["matches"].c
    assert "home_participant_id" not in cols
    assert "away_participant_id" not in cols


def test_rls_classification_is_exhaustive_and_disjoint():
    strict, glob, none = set(TENANT_STRICT_TABLES), set(GLOBAL_OR_TENANT_TABLES), set(NO_RLS_TABLES)
    assert strict | glob | none == EXPECTED_TABLES
    assert strict.isdisjoint(glob) and strict.isdisjoint(none) and glob.isdisjoint(none)


def test_enum_type_names_unique():
    names = [e.name for e in ALL_PG_ENUMS]
    assert (
        len(names) == len(set(names)) == 19
    )  # baseline enums (non-baseline added by later migrations)


def test_drift_prone_fields_are_generated_columns():
    # Derived values must be GENERATED so they can't drift from their inputs.
    assert Base.metadata.tables["match_participants"].c["is_winner"].computed is not None
    assert Base.metadata.tables["standings"].c["diff"].computed is not None
