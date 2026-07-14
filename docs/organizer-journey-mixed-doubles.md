# Organizer Journey: SurveyMonkey Mixed Doubles Tournament (4 Teams)

**Scenario:** Organizer collected registrations via SurveyMonkey. Wants to run a mixed doubles badminton tournament with 4 balanced teams.

---

## Phase 1 — Enter the Platform

**Where:** `app.playlane.live` → login → org dashboard

- Organizer lands on their organization's console
- Sees existing tournaments (or empty state on first use)
- Clicks **New Tournament**

---

## Phase 2 — Create the Tournament

**Where:** Tournament creation form

| Field | Value |
|---|---|
| Name | e.g. "SIBL Mixed Doubles Open" |
| Sport profile | Badminton |
| Format | (set per division below) |
| Dates | Start / end date |
| Venue | Optional — name + location |
| Visibility | Private (internal event) or Public |

> Saves → lands on the Tournament detail page.

---

## Phase 3 — Create a Division

**Where:** Tournament → Divisions → Add Division

| Field | Value |
|---|---|
| Name | Mixed Doubles |
| Participant type | Team (pair) |
| Capacity | 8 players / 4 pairs (or leave open) |
| Stage format | Round Robin → Finals, or Single Elimination |

> One division covers all 4 teams. If skill tiers differ, create two divisions (e.g. Open + Intermediate) — each follows the same flow below.

---

## Phase 4 — Import Registrations from SurveyMonkey

**Where:** Division → Registrations → Import

SurveyMonkey data comes in as a CSV export. Steps:

1. **Export from SurveyMonkey** — Individual Responses → Export → CSV
2. **Import into Playlane** — source: CSV, paste or upload file
3. **Column mapping** — Playlane auto-suggests; organizer confirms:
   - `Name` → Full Name column
   - `Email` → Email column
   - `Skill Level` → Skill/Level column (auto-normalized: "Advanced", "Adv", "3" all resolve)
   - `Preferred Partner` → Partner name column (used by Smart Pairing)
4. **Preview** — system shows new / duplicate / invalid rows with counts
5. **Commit** — tick "Auto-approve on import" to skip the approval step, or leave off to review first

> 8 players imported for 4 teams in mixed doubles.

---

## Phase 5 — Review & Approve Registrations

**Where:** Division → Registrations

- If auto-approved: all 8 show as **Approved** — skip ahead
- If not: scan the list, click **Approve All** (or approve individually)
- Flag or reject anyone who doesn't belong

> Only Approved registrations flow into squad formation and pairing.

---

## Phase 6 — Form 4 Teams (Squads)

**Where:** Tournament → Teams

Two options:

### Option A — Auto-Distribute (recommended)
1. Click **Auto-Distribute**
2. Set **Team count = 4**
3. System snake-distributes players by skill weight → 4 balanced teams
4. Review assignments on the board; drag-and-drop to adjust if needed

### Option B — Manual
1. Create 4 squads (Team 1 – Team 4)
2. Assign each of the 8 players to a squad manually

> Captains can be designated per squad (optional).

---

## Phase 7 — Generate Pairs (Smart Pairing)

**Where:** Division → Pairs

Mixed doubles = each squad produces one pair (1 male + 1 female). Steps:

1. Click **Generate Pairs**
2. Smart Pairing reads:
   - Preferred partner hints from the import
   - Skill weights for balance
   - Squad assignments (pairs stay within their squad)
3. Review proposed pairs on the pairing board
4. Swap members across pairs by clicking two cards if needed
5. Click **Publish Pairs** → pairs locked as Participants

> 4 squads → 4 pairs → ready for draw.

---

## Phase 8 — Generate the Draw

**Where:** Division → Stage → Generate Draw

1. Select the stage (Round Robin or Single Elimination)
2. Click **Generate Draw**
3. System creates all matches:
   - Round Robin (4 teams): 6 matches across 3 rounds
   - Single Elimination (4 teams): 3 matches (2 semis + 1 final)
4. Review bracket / round-robin grid
5. Redraw if needed (allowed until first match is scored)

---

## Phase 9 — Schedule Matches

**Where:** Tournament → Schedule

1. Add courts (e.g. Court 1, Court 2)
2. Use **Bulk Schedule** — set start time, duration per match, courts available
3. System assigns matches to courts + time slots
4. Or drag matches onto the timeline manually
5. Share schedule link with players (public microsite or QR code)

---

## Phase 10 — Run the Event (Live Day)

**Where:** Tournament → Match Center (organizer) + Public microsite (players)

**Organizer flow:**
- Match Center shows the live queue: scheduled → in progress → completed
- Scorekeeper (or organizer) opens a match → enters scores set by set
- Submit → match marked complete → standings update in real time
- Auto-schedule next match triggers if enabled (next unscheduled match assigned to freed court)

**Player / spectator flow:**
- Public microsite at `playlane.live/[org]/[tournament]`
- Live bracket, standings, match results — no login needed

---

## Phase 11 — Wrap Up

**Where:** Tournament → Standings / Results

- Final standings auto-calculated (round robin: points + sets won; KO: bracket result)
- Export results if needed
- Tournament marked complete
- Public microsite freezes with final bracket / standings

---

## Summary Timeline

```
Day -7   Create tournament + division
Day -5   Import SurveyMonkey CSV → approve registrations
Day -4   Auto-distribute into 4 teams → generate pairs → publish
Day -3   Generate draw → schedule matches → share public link
Day  0   Run event: score matches live → auto-standings
Day  0+  Final standings published on microsite
```

---

## Key Platform Features Used

| Feature | Where in journey |
|---|---|
| CSV Import + column mapping | Phase 4 |
| Auto-approve on import | Phase 4–5 |
| Snake distribution (skill-balanced teams) | Phase 6 |
| Smart Pairing + preferred partner hints | Phase 7 |
| Draw generation (RR / KO) | Phase 8 |
| Bulk schedule + court assignment | Phase 9 |
| Live scoring + real-time standings | Phase 10 |
| Public microsite (no login) | Phase 10–11 |
