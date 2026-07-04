"""Registration Operations integration tests — CSV import, attendance/check-in,
readiness dashboard, and draw-gate. DB-backed (skipped without DATABASE_URL)."""

from __future__ import annotations

import os
import secrets
import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.factory import get_email_channel

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not set")

PASSWORD = secrets.token_urlsafe(16)
AUTH = "/api/v1/auth"
ORGS = "/api/v1/orgs"
TOUR = "/api/v1/tournaments"
IMPORTS = "/api/v1/imports"

# ---- minimal valid SurveyMonkey-style CSV ----
_CSV_SIMPLE = (
    "Name,Email,Skill\n"
    "Alice Smith,alice@example.com,advanced\n"
    "Bob Jones,bob@example.com,intermediate\n"
)
_CSV_BOM = "﻿Name,Email,Skill\nCarol Li,carol@example.com,beginner\n"
_CSV_SM_SECOND_HEADER = (
    "Name,Email,Skill\n,Open-ended response,\nDave Kim,dave@example.com,advanced\n"
)
_CSV_DUPE_EMAIL = (
    "Name,Email,Skill\n"
    "Alice Smith,alice@example.com,advanced\n"
    "Alice Dupe,alice@example.com,intermediate\n"
)
_CSV_INVALID_SKILL = "Name,Email,Skill\nEve,eve@example.com,expert\n"
_CSV_MISSING_NAME = "Name,Email,Skill\n,empty@example.com,beginner\n"


def _client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _email() -> str:
    return f"u-{uuid.uuid4().hex[:12]}@example.com"


def _slug() -> str:
    return f"s-{uuid.uuid4().hex[:10]}"


def _csrf(client: AsyncClient) -> dict[str, str]:
    return {"X-CSRF-Token": client.cookies.get("csrf_token") or ""}


async def _new_org(client: AsyncClient) -> str:
    email = _email()
    await client.post(f"{AUTH}/register", json={"email": email, "name": "T", "password": PASSWORD})
    await client.post(f"{AUTH}/login", json={"email": email, "password": PASSWORD})
    resp = await client.post(ORGS, json={"name": "Org", "slug": _slug()}, headers=_csrf(client))
    assert resp.status_code == 201, resp.text
    return resp.json()["activeOrganizationId"]


async def _individual_division(client: AsyncClient) -> tuple[str, str]:
    resp = await client.post(
        TOUR,
        json={"name": "SIBL", "slug": _slug(), "sportKey": "badminton"},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    tid = resp.json()["id"]
    div = await client.post(
        f"{TOUR}/{tid}/divisions",
        json={"name": "Singles", "participantType": "individual"},
        headers=_csrf(client),
    )
    assert div.status_code == 201, div.text
    await client.post(
        f"{TOUR}/{tid}/status", json={"status": "registration"}, headers=_csrf(client)
    )
    return tid, div.json()["id"]


async def _approved_participant(client: AsyncClient, did: str) -> str:
    """Register + approve → return the participant id."""
    reg = await client.post(
        f"/api/v1/divisions/{did}/registrations",
        json={"formResponse": {"name": f"Player {uuid.uuid4().hex[:4]}"}},
        headers=_csrf(client),
    )
    assert reg.status_code == 201, reg.text
    approve = await client.post(
        f"/api/v1/registrations/{reg.json()['id']}/approve", headers=_csrf(client)
    )
    assert approve.status_code == 200, approve.text
    return approve.json()["participantId"]


async def _stage(client: AsyncClient, did: str, fmt: str = "round_robin") -> str:
    resp = await client.post(
        f"/api/v1/divisions/{did}/stages",
        json={"type": fmt, "seq": 1},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


_MAPPING = {"name": "Name", "email": "Email", "skillLevel": "Skill"}


# ============================================================
# Import sources
# ============================================================


async def test_list_import_sources_returns_surveymonkey(app, client):
    await _new_org(client)
    resp = await client.get(f"{IMPORTS}/sources")
    assert resp.status_code == 200
    keys = [s["key"] for s in resp.json()]
    assert "surveymonkey_csv" in keys


# ============================================================
# Detect columns
# ============================================================


async def test_detect_columns_returns_headers_and_sample(app, client):
    await _new_org(client)
    resp = await client.post(
        f"{IMPORTS}/detect",
        json={"source": "surveymonkey_csv", "raw": _CSV_SIMPLE},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["columns"] == ["Name", "Email", "Skill"]
    assert len(body["sampleRows"]) == 2


async def test_detect_strips_utf8_bom(app, client):
    await _new_org(client)
    resp = await client.post(
        f"{IMPORTS}/detect",
        json={"source": "surveymonkey_csv", "raw": _CSV_BOM},
    )
    assert resp.status_code == 200
    assert resp.json()["columns"][0] == "Name"  # BOM stripped — not "﻿Name"


async def test_detect_skips_surveymonkey_second_header_row(app, client):
    await _new_org(client)
    resp = await client.post(
        f"{IMPORTS}/detect",
        json={"source": "surveymonkey_csv", "raw": _CSV_SM_SECOND_HEADER},
    )
    assert resp.status_code == 200
    # sample_rows should have the real data row, not the blank sub-header
    sample = resp.json()["sampleRows"]
    assert len(sample) == 1
    assert sample[0]["Name"] == "Dave Kim"


async def test_detect_unknown_source_is_rejected(app, client):
    await _new_org(client)
    resp = await client.post(
        f"{IMPORTS}/detect",
        json={"source": "google_sheets", "raw": "Name\nAlice\n"},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "unknown_source"


# ============================================================
# Import preview
# ============================================================


async def test_preview_classifies_new_rows(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    resp = await client.post(
        f"/api/v1/divisions/{did}/imports/preview",
        json={
            "source": "surveymonkey_csv",
            "raw": _CSV_SIMPLE,
            "mapping": _MAPPING,
            "updateExisting": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]["total"] == 2
    assert body["summary"]["new"] == 2
    assert body["summary"]["duplicate"] == 0
    assert body["summary"]["invalid"] == 0
    assert all(r["status"] == "new" for r in body["rows"])


async def test_preview_invalid_skill_level(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    resp = await client.post(
        f"/api/v1/divisions/{did}/imports/preview",
        json={
            "source": "surveymonkey_csv",
            "raw": _CSV_INVALID_SKILL,
            "mapping": _MAPPING,
            "updateExisting": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]["invalid"] == 1
    assert body["rows"][0]["status"] == "invalid"
    assert any("unrecognized skill level" in m for m in body["rows"][0]["messages"])


async def test_preview_missing_name_is_invalid(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    resp = await client.post(
        f"/api/v1/divisions/{did}/imports/preview",
        json={
            "source": "surveymonkey_csv",
            "raw": _CSV_MISSING_NAME,
            "mapping": _MAPPING,
            "updateExisting": False,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["rows"][0]["status"] == "invalid"


async def test_preview_within_file_duplicate_detected(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    resp = await client.post(
        f"/api/v1/divisions/{did}/imports/preview",
        json={
            "source": "surveymonkey_csv",
            "raw": _CSV_DUPE_EMAIL,
            "mapping": _MAPPING,
            "updateExisting": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    statuses = [r["status"] for r in body["rows"]]
    assert "new" in statuses and "duplicate" in statuses


async def test_preview_does_not_mutate_db(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    await client.post(
        f"/api/v1/divisions/{did}/imports/preview",
        json={
            "source": "surveymonkey_csv",
            "raw": _CSV_SIMPLE,
            "mapping": _MAPPING,
            "updateExisting": False,
        },
    )
    regs = await client.get(f"/api/v1/divisions/{did}/registrations")
    assert len(regs.json()) == 0  # preview is a dry-run


# ============================================================
# Import commit
# ============================================================


async def test_commit_creates_registrations(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    resp = await client.post(
        f"/api/v1/divisions/{did}/imports/commit",
        json={
            "source": "surveymonkey_csv",
            "raw": _CSV_SIMPLE,
            "mapping": _MAPPING,
            "updateExisting": False,
        },
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["imported"] == 2
    assert body["updated"] == 0
    assert body["skipped"] == 0

    regs = await client.get(f"/api/v1/divisions/{did}/registrations")
    names = [r["formResponse"]["name"] for r in regs.json()]
    assert "Alice Smith" in names and "Bob Jones" in names


async def test_commit_update_existing_patches_skill_level(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    # First import
    await client.post(
        f"/api/v1/divisions/{did}/imports/commit",
        json={
            "source": "surveymonkey_csv",
            "raw": "Name,Email,Skill\nAlice Smith,alice@example.com,beginner\n",
            "mapping": _MAPPING,
            "updateExisting": False,
        },
        headers=_csrf(client),
    )
    regs_before = await client.get(f"/api/v1/divisions/{did}/registrations")
    assert regs_before.json()[0]["skillLevel"] == "beginner"

    # Re-import with update_existing=True and changed skill
    resp = await client.post(
        f"/api/v1/divisions/{did}/imports/commit",
        json={
            "source": "surveymonkey_csv",
            "raw": "Name,Email,Skill\nAlice Smith,alice@example.com,advanced\n",
            "mapping": _MAPPING,
            "updateExisting": True,
        },
        headers=_csrf(client),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["imported"] == 0
    assert body["updated"] == 1

    regs_after = await client.get(f"/api/v1/divisions/{did}/registrations")
    assert regs_after.json()[0]["skillLevel"] == "advanced"


async def test_commit_without_update_existing_skips_duplicates(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    csv = "Name,Email,Skill\nAlice Smith,alice@example.com,advanced\n"
    for _ in range(2):
        await client.post(
            f"/api/v1/divisions/{did}/imports/commit",
            json={
                "source": "surveymonkey_csv",
                "raw": csv,
                "mapping": _MAPPING,
                "updateExisting": False,
            },
            headers=_csrf(client),
        )
    regs = await client.get(f"/api/v1/divisions/{did}/registrations")
    assert len(regs.json()) == 1  # second import skipped the duplicate


# ============================================================
# Mapping templates
# ============================================================


async def test_save_list_delete_mapping_template(app, client):
    await _new_org(client)
    # Save
    saved = await client.post(
        f"{IMPORTS}/mapping-templates",
        json={"name": "My Template", "source": "surveymonkey_csv", "mapping": _MAPPING},
        headers=_csrf(client),
    )
    assert saved.status_code == 201, saved.text
    tid = saved.json()["id"]

    # List
    lst = await client.get(f"{IMPORTS}/mapping-templates")
    assert lst.status_code == 200
    assert any(t["id"] == tid for t in lst.json())

    # Delete
    delete = await client.delete(f"{IMPORTS}/mapping-templates/{tid}", headers=_csrf(client))
    assert delete.status_code == 204

    after = await client.get(f"{IMPORTS}/mapping-templates")
    assert not any(t["id"] == tid for t in after.json())


async def test_save_template_upserts_by_name(app, client):
    await _new_org(client)
    await client.post(
        f"{IMPORTS}/mapping-templates",
        json={"name": "Reusable", "source": "surveymonkey_csv", "mapping": {"name": "Name"}},
        headers=_csrf(client),
    )
    await client.post(
        f"{IMPORTS}/mapping-templates",
        json={
            "name": "Reusable",
            "source": "surveymonkey_csv",
            "mapping": {"name": "Full Name"},
        },
        headers=_csrf(client),
    )
    lst = await client.get(f"{IMPORTS}/mapping-templates")
    named = [t for t in lst.json() if t["name"] == "Reusable"]
    assert len(named) == 1
    assert named[0]["mapping"]["name"] == "Full Name"


async def test_templates_are_org_scoped(app, client):
    await _new_org(client)
    await client.post(
        f"{IMPORTS}/mapping-templates",
        json={"name": "Mine", "source": "surveymonkey_csv", "mapping": _MAPPING},
        headers=_csrf(client),
    )

    async with _client(app) as other:
        await _new_org(other)
        lst = await other.get(f"{IMPORTS}/mapping-templates")
        assert lst.status_code == 200
        assert lst.json() == []


# ============================================================
# Attendance / check-in
# ============================================================


async def test_list_attendance_empty_before_any_participants(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    resp = await client.get(f"/api/v1/divisions/{did}/attendance")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_set_attendance_checked_in(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    pid = await _approved_participant(client, did)

    resp = await client.post(
        f"/api/v1/participants/{pid}/attendance",
        json={"status": "checked_in"},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["attendance"] == "checked_in"
    assert body["checkedInAt"] is not None


async def test_set_attendance_absent_clears_checked_in_at(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    pid = await _approved_participant(client, did)

    await client.post(
        f"/api/v1/participants/{pid}/attendance",
        json={"status": "checked_in"},
        headers=_csrf(client),
    )
    resp = await client.post(
        f"/api/v1/participants/{pid}/attendance",
        json={"status": "absent"},
        headers=_csrf(client),
    )
    assert resp.status_code == 200
    assert resp.json()["attendance"] == "absent"
    assert resp.json()["checkedInAt"] is None


async def test_set_attendance_invalid_status_rejected(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    pid = await _approved_participant(client, did)

    resp = await client.post(
        f"/api/v1/participants/{pid}/attendance",
        json={"status": "walked_in"},
        headers=_csrf(client),
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "invalid_attendance"


async def test_bulk_set_attendance(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    p1 = await _approved_participant(client, did)
    p2 = await _approved_participant(client, did)

    resp = await client.post(
        f"/api/v1/divisions/{did}/attendance/bulk",
        json={"participantIds": [p1, p2], "status": "checked_in"},
        headers=_csrf(client),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert set(body["updated"]) == {p1, p2}
    assert body["attendance"] == "checked_in"

    attendance = await client.get(f"/api/v1/divisions/{did}/attendance")
    statuses = {p["id"]: p["attendance"] for p in attendance.json()}
    assert statuses[p1] == "checked_in" and statuses[p2] == "checked_in"


# ============================================================
# QR self check-in (share links)
# ============================================================


def _token_from_checkin_url(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


async def test_checkin_link_public_self_checkin(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    pid = await _approved_participant(client, did)

    link_resp = await client.post(
        f"/api/v1/divisions/{did}/checkin-link",
        json={"expiresInHours": 24},
        headers=_csrf(client),
    )
    assert link_resp.status_code == 201, link_resp.text
    url = link_resp.json()["url"]
    assert url is not None
    token = _token_from_checkin_url(url)

    session = await client.get(f"/api/v1/public/checkin/session?token={token}")
    assert session.status_code == 200, session.text
    body = session.json()
    assert body["divisionName"] == "Singles"
    assert any(p["id"] == pid for p in body["participants"])

    confirm = await client.post(
        f"/api/v1/public/checkin/confirm?token={token}",
        json={"participantId": pid},
    )
    assert confirm.status_code == 204, confirm.text

    attendance = await client.get(f"/api/v1/divisions/{did}/attendance")
    row = next(p for p in attendance.json() if p["id"] == pid)
    assert row["attendance"] == "checked_in"


async def test_checkin_link_invalid_token_rejected(app, client):
    resp = await client.get("/api/v1/public/checkin/session?token=not-a-real-token")
    assert resp.status_code == 403


# ============================================================
# Readiness dashboard
# ============================================================


async def test_readiness_no_participants_not_ready(app, client):
    await _new_org(client)
    tid, did = await _individual_division(client)

    resp = await client.get(f"/api/v1/tournaments/{tid}/readiness")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["divisions"]) == 1
    assert body["squadCount"] == 0
    assert body["unassignedSquadMembers"] == 0
    assert body["squadsReady"] is True
    div = body["divisions"][0]
    assert div["readyForDraw"] is False
    assert div["readyForStart"] is False
    assert div["approved"] == 0
    assert any("needs at least" in b for b in div["blockers"])


async def test_readiness_pending_checkins_block_draw(app, client):
    await _new_org(client)
    tid, did = await _individual_division(client)
    await _approved_participant(client, did)
    await _approved_participant(client, did)

    resp = await client.get(f"/api/v1/tournaments/{tid}/readiness")
    div = resp.json()["divisions"][0]
    assert div["readyForDraw"] is False
    assert div["pending"] == 2
    assert any("awaiting check-in" in b for b in div["blockers"])


async def test_readiness_all_checked_in_ready_for_draw(app, client):
    await _new_org(client)
    tid, did = await _individual_division(client)
    p1 = await _approved_participant(client, did)
    p2 = await _approved_participant(client, did)

    await client.post(
        f"/api/v1/divisions/{did}/attendance/bulk",
        json={"participantIds": [p1, p2], "status": "checked_in"},
        headers=_csrf(client),
    )

    resp = await client.get(f"/api/v1/tournaments/{tid}/readiness")
    div = resp.json()["divisions"][0]
    assert div["readyForDraw"] is True
    assert div["pending"] == 0
    assert div["blockers"] == []


# ============================================================
# Draw gate
# ============================================================


async def test_draw_blocked_when_participants_not_checked_in(app, client):
    await _new_org(client)
    tid, did = await _individual_division(client)
    await _approved_participant(client, did)
    await _approved_participant(client, did)
    sid = await _stage(client, did)

    resp = await client.post(
        f"/api/v1/stages/{sid}/draw",
        json={"overrideReadiness": False},
        headers=_csrf(client),
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["code"] == "checkin_incomplete"


async def test_draw_override_bypasses_checkin_gate(app, client):
    await _new_org(client)
    tid, did = await _individual_division(client)
    await _approved_participant(client, did)
    await _approved_participant(client, did)
    sid = await _stage(client, did)

    resp = await client.post(
        f"/api/v1/stages/{sid}/draw",
        json={"overrideReadiness": True},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["matches"] > 0


async def test_draw_succeeds_when_all_checked_in(app, client):
    await _new_org(client)
    tid, did = await _individual_division(client)
    p1 = await _approved_participant(client, did)
    p2 = await _approved_participant(client, did)
    await client.post(
        f"/api/v1/divisions/{did}/attendance/bulk",
        json={"participantIds": [p1, p2], "status": "checked_in"},
        headers=_csrf(client),
    )
    sid = await _stage(client, did)

    resp = await client.post(
        f"/api/v1/stages/{sid}/draw",
        json={"overrideReadiness": False},
        headers=_csrf(client),
    )
    assert resp.status_code == 201, resp.text


# ============================================================
# Permissions
# ============================================================


async def test_viewer_cannot_commit_import(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)

    recorder: list[dict] = []

    class Recorder:
        async def send(self, to: str, template: str, data: dict) -> str:
            recorder.append(data)
            return "ok"

    app.dependency_overrides[get_email_channel] = lambda: Recorder()
    invitee = _email()
    inv = await client.post(
        f"{ORGS}/active/invites", json={"email": invitee, "role": "viewer"}, headers=_csrf(client)
    )
    assert inv.status_code == 201
    token = recorder[-1]["token"]

    async with _client(app) as viewer:
        await viewer.post(
            f"{AUTH}/register", json={"email": invitee, "name": "V", "password": PASSWORD}
        )
        await viewer.post(f"{AUTH}/login", json={"email": invitee, "password": PASSWORD})
        await viewer.post(f"{ORGS}/invites/accept", json={"token": token}, headers=_csrf(viewer))
        resp = await viewer.post(
            f"/api/v1/divisions/{did}/imports/commit",
            json={
                "source": "surveymonkey_csv",
                "raw": _CSV_SIMPLE,
                "mapping": _MAPPING,
                "updateExisting": False,
            },
            headers=_csrf(viewer),
        )
        assert resp.status_code == 403


async def test_viewer_cannot_set_attendance(app, client):
    await _new_org(client)
    _tid, did = await _individual_division(client)
    pid = await _approved_participant(client, did)

    recorder: list[dict] = []

    class Recorder:
        async def send(self, to: str, template: str, data: dict) -> str:
            recorder.append(data)
            return "ok"

    app.dependency_overrides[get_email_channel] = lambda: Recorder()
    invitee = _email()
    inv = await client.post(
        f"{ORGS}/active/invites", json={"email": invitee, "role": "viewer"}, headers=_csrf(client)
    )
    assert inv.status_code == 201
    token = recorder[-1]["token"]

    async with _client(app) as viewer:
        await viewer.post(
            f"{AUTH}/register", json={"email": invitee, "name": "V", "password": PASSWORD}
        )
        await viewer.post(f"{AUTH}/login", json={"email": invitee, "password": PASSWORD})
        await viewer.post(f"{ORGS}/invites/accept", json={"token": token}, headers=_csrf(viewer))
        resp = await viewer.post(
            f"/api/v1/participants/{pid}/attendance",
            json={"status": "checked_in"},
            headers=_csrf(viewer),
        )
        assert resp.status_code == 403


# ============================================================
# Org isolation
# ============================================================


async def test_import_org_isolation(app, client):
    """An organizer cannot import into another org's division."""
    await _new_org(client)
    _tid, did = await _individual_division(client)

    async with _client(app) as other:
        await _new_org(other)
        resp = await other.post(
            f"/api/v1/divisions/{did}/imports/commit",
            json={
                "source": "surveymonkey_csv",
                "raw": _CSV_SIMPLE,
                "mapping": _MAPPING,
                "updateExisting": False,
            },
            headers=_csrf(other),
        )
        assert resp.status_code == 404


async def test_attendance_org_isolation(app, client):
    """An organizer cannot set attendance on another org's participant."""
    await _new_org(client)
    _tid, did = await _individual_division(client)
    pid = await _approved_participant(client, did)

    async with _client(app) as other:
        await _new_org(other)
        resp = await other.post(
            f"/api/v1/participants/{pid}/attendance",
            json={"status": "checked_in"},
            headers=_csrf(other),
        )
        assert resp.status_code == 404


async def test_readiness_org_isolation(app, client):
    """An organizer cannot view another org's readiness."""
    await _new_org(client)
    tid, _did = await _individual_division(client)

    async with _client(app) as other:
        await _new_org(other)
        resp = await other.get(f"/api/v1/tournaments/{tid}/readiness")
        assert resp.status_code == 404
