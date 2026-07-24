# Session Handoff — SIBL pre-event work

**Context:** Playlane / SIBL badminton tournament, ~1 week to event. This session
shipped three PRs (all merged to `main`) and left two things for the user to verify.
Written for a fresh session to pick up cleanly.

---

## What we were doing

The user is running the real SIBL event on prod (`playlane.live`). Work spanned:
Draft Ceremony fixes (earlier, already merged), a captain pairing sheet + guide
(docs, not in repo), diagnosing/fixing a **production 500 on the public microsite**,
and confirming/verifying that **franchise match generation pairs legs tier-for-tier**
(adv+adv vs adv+adv, etc.).

The three PRs below are the code changes. Two open questions remain (see bottom).

---

## The 3 PRs (all merged)

### PR #77 — `fix(public): a stale cached blob must not 500 the public microsite`
**Files:** `apps/api/app/cache/__init__.py`, `apps/api/app/modules/public/router.py`,
`apps/api/tests/test_public_cache_resilience.py`

- Every public read did `Model(**cached_json)`; a stale/corrupt Redis blob raised
  `ValidationError` → hard 500 until TTL expired.
- `get_json` now swallows JSON decode errors (treats as miss).
- Added `_revive` / `_revive_list` helpers: rebuild a cached view, or return `None`
  (→ cache miss → rebuild from DB) when the blob no longer validates. Applied to all
  6 public cache reads (tournament, divisions, stages, participants, courts, standings).
- **Note:** valid hardening, but was NOT the cause of the actual 500 (see #79).

### PR #79 — `fix(public): keep public tournament slugs globally unique` **(the real root cause)**
**Files:** `apps/api/app/modules/public/repository.py`,
`apps/api/app/modules/tournaments/repository.py`,
`apps/api/app/modules/tournaments/service.py`, `apps/api/tests/test_public.py`

- **Root cause of the prod 500:** the public microsite resolves `/t/{slug}` by slug
  **alone across every org**, but slug uniqueness is only enforced **per-org**
  (`uq_tournaments_organization_id_slug`). A leftover test org and the real org both
  had a public `sibl-badminton-2026` → resolver's `.scalar_one_or_none()` raised
  `MultipleResultsFound` → unhandled 500.
- **Prevention (write-time):** `create_tournament` / `update_tournament` reject a
  public/unlisted slug another org already resolves, via new
  `repo.public_slug_conflict(...)` (cross-org visible through the additive
  `tournaments_public_read` RLS policy). Raises `409 code=public_slug_taken`.
  Private events may still reuse a slug.
- **Defense (read-time):** `get_tournament_by_slug` now `ORDER BY (public first,
  newest) LIMIT 1` → `.scalars().first()`, so any legacy collision resolves
  deterministically instead of 500ing.
- Prod was un-broken manually: set the duplicate tournament
  (`019f8dcf-4573-7c4b-b4d4-57a624fbe021`) to `visibility='private'`. Keeper is the
  live public one `019f939d-dbdb-7623-9615-74de563b339e`.

### PR #78 — `feat(franchise): pre-flight pairing tier-alignment check + Draws badge`
**Files:** `apps/api/app/modules/franchise_ties/tier_check.py` (new),
`.../franchise_ties/service.py`, `.../router.py`, `.../schemas.py`,
`apps/api/tests/test_tier_check.py` (new),
`apps/web/src/features/franchise-ties/*` (api, hook, badge component, board),
`apps/web/src/lib/query-keys.ts`

- **Does NOT change match generation.** It's a verification layer only.
- Backend: `analyze_tier_alignment` (pure) + `GET /stages/{stage_id}/pairing-tier-check`
  → `PairingTierCheckView { aligned, referenceProfile, squads[], deviatingSquads[] }`.
  Reuses the same pair strengths the draw uses.
- Frontend: a badge on the team-draw board (pre-generate state) — green "Pairings
  aligned" when all teams share one strength profile, amber naming any off-sheet team.
- For SIBL (all rosters 3 Advanced / 7 Intermediate / 4 Beginner) the profile is
  `[6,5,4,4,4,2,2]` and the badge is green.

---

## How tier-for-tier match generation actually works (already in `main` via PR #73)

The guarantee the user cares about — leg 1 = adv+adv vs adv+adv, leg 2 = (adv+int) vs
(adv+int), … — is produced by two functions in
`apps/api/app/modules/franchise_ties/service.py`:

1. **`squad_pair_map`** — sorts each squad's pairs **strongest-first** by combined
   strength (`sorted(..., key=lambda r: (-strength, created_at))`). `strength` = sum of
   the two members' skill weights (Advanced 3, Intermediate 2, Beginner 1), computed at
   pair-creation (incl. manual pairs, `pairing/service.py:276`).
2. **`_leg_pair_index`** — leg *N* draws index *N* from **both** teams' sorted lists,
   so pair N meets pair N.

This only yields clean tiers if **every team has the same sorted strength profile** —
which is exactly what PR #78's badge verifies. It came from PR #73
("rank pairs by strength so like meets like"), already merged before this session.

---

## OPEN — what the user still needs to do / verify

1. **Deploy prod from merged `main`** (Railway API + Vercel web) so #79's slug guard and
   #78's tier-check endpoint are actually live.

2. **The unresolved question: "matches on prod are not generating tier-for-tier."**
   User will test **locally first** with **manually-created tiered pairs**. Likely causes,
   to diagnose with the SQL below:
   - **Auto-pairing was used** (balanced fold): every pair ≈ strength 4, no adv+adv pairs
     exist → tier-for-tier is impossible by design → must redo pairs **manually** per sheet.
   - **Matches generated by old code** (before PR #73's strength-sort deployed): existing
     legs built in creation order → fix is **Clear draw → Generate Matches** again on
     current code (pairs untouched).
   - **Pair `strength` = 0** (created before strength was computed) → regenerate pairing.

   **Diagnostic SQL (Supabase), real tournament id `019f939d-dbdb-7623-9615-74de563b339e`:**
   ```sql
   SELECT
     pt.strength,
     (SELECT array_agg(r.skill_level)
        FROM registrations r
        WHERE r.id::text IN (SELECT jsonb_array_elements_text(pt.member_ids))
     ) AS pair_skills
   FROM proposed_teams pt
   JOIN pairing_runs pr ON pr.id = pt.pairing_run_id
   JOIN divisions d      ON d.id = pr.division_id
   WHERE d.tournament_id = '019f939d-dbdb-7623-9615-74de563b339e'
     AND pr.status = 'published'
   ORDER BY pt.strength DESC;
   ```
   - Profile `6,5,4,4,4,2,2` with `{advanced,advanced}` etc. → correct tiered pairs; if
     legs still wrong → Clear + regenerate.
   - Strengths all ≈`4.0`, mixed skills → auto-pairing → redo manually.
   - Strengths all `0` → regenerate pairing.

---

## Env / repo notes for the next session

- Prod DB is **Supabase** (not Neon as some docs say); cache prod Redis (Upstash) was
  empty — prod likely runs the in-process cache.
- This container can't reach `playlane.live` (network policy blocks it); diagnose via the
  user running SQL / hitting URLs, or reproduce locally.
- Local dev: Postgres 16 (user `app`/`app`, db `tournament`), API venv at
  `apps/api/.venv`, `DATABASE_URL=postgresql+asyncpg://app:app@127.0.0.1:5432/tournament`.
  Node 22 required for web.
- Quality gate before any push: API `black --check && isort --check-only && flake8 &&
  mypy && pytest`; Web `yarn --cwd apps/web typecheck && lint && test --run` +
  `yarn format:check`.
