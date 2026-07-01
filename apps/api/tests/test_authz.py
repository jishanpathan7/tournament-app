"""Pure unit tests for the authorization policy (no DB)."""

from app.core import authz
from app.db.enums import OrgRole


def test_owner_can_everything():
    assert all(authz.can(OrgRole.OWNER, action) for action in authz.ALL_ACTIONS)


def test_admin_cannot_delete_org():
    assert authz.can(OrgRole.ADMIN, authz.ORG_UPDATE)
    assert not authz.can(OrgRole.ADMIN, authz.ORG_DELETE)


def test_viewer_is_read_only():
    assert authz.can(OrgRole.VIEWER, authz.ORG_READ)
    assert authz.can(OrgRole.VIEWER, authz.MEMBER_READ)
    assert not authz.can(OrgRole.VIEWER, authz.MEMBER_INVITE)
    assert not authz.can(OrgRole.VIEWER, authz.SCORING_WRITE)


def test_scorekeeper_can_score_but_not_manage_members():
    assert authz.can(OrgRole.SCOREKEEPER, authz.SCORING_WRITE)
    assert not authz.can(OrgRole.SCOREKEEPER, authz.MEMBER_INVITE)


def test_organizer_cannot_manage_members():
    assert authz.can(OrgRole.ORGANIZER, authz.TOURNAMENT_CREATE)
    assert not authz.can(OrgRole.ORGANIZER, authz.MEMBER_REMOVE)


def test_default_deny_for_unknown_role_or_action():
    assert not authz.can("bogus-role", authz.ORG_READ)
    assert not authz.can(OrgRole.OWNER, "bogus:action")


def test_can_accepts_string_role():
    assert authz.can("owner", authz.ORG_DELETE)
