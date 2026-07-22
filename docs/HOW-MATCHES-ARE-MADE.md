# How Matches Are Made

**A plain-English explanation of how Playlane decides who plays whom.**

For organizers and volunteers. No technical knowledge needed.

---

## The short version

It happens in four steps, in this order:

| Step | What happens |
|---|---|
| **1. Teams** | Players are dealt into teams so every team is roughly equally strong |
| **2. Pairs** | Inside each team, players are paired up — strong with weak |
| **3. Fixtures** | Every team is scheduled to meet every other team |
| **4. Matches** | Inside each fixture, pairs are lined up against pairs |

Nobody draws names from a hat. Every step is deliberate, and the goal throughout is the same: **make it as even as possible.**

---

## Skill levels are just numbers

Everything below runs on three numbers:

| Skill level | Counts as |
|---|---|
| Beginner | **1** |
| Intermediate | **2** |
| Advanced | **3** |

A player with no skill level recorded is treated as **intermediate (2)**.

That's the whole scale. When we say "a team's strength", we mean the total of these numbers.

---

## Step 1 — Filling the teams

Players are sorted **strongest first**, then dealt out in a **snake** pattern.

With 4 teams, the order goes forward, then backward, then forward again:

```
Team A   Team B   Team C   Team D
  1   →    2   →    3   →    4
  8   ←    7   ←    6   ←    5
  9   →   10   →   11   →   12
```

Player 1 is the strongest in the tournament, player 12 the weakest.

**Why snake instead of straight down the list?** Because dealing 1-2-3-4 repeatedly would give Team A every strongest player. Snaking means the team that picks first in one round picks last in the next. Team A gets the best player, Team D gets the second-best *and* the third-best.

Add up the numbers and every team lands within a point or two of the others.

> **The draft ceremony is this same idea, done live.** The wheel adds surprise and theatre, but the underlying goal — even teams — is identical.

---

## Step 2 — Making the pairs

Once a team has its players, they're paired inside that team. **A pair never crosses teams.**

The rule is **strongest with weakest**, folding inward.

A team of six, strengths 3, 3, 2, 2, 1, 1:

| Pair | Players | Team strength |
|---|---|---|
| 1 | Advanced (3) + Beginner (1) | **4** |
| 2 | Advanced (3) + Beginner (1) | **4** |
| 3 | Intermediate (2) + Intermediate (2) | **4** |

Every pair adds up to **4** — the target. So within a team, no pair is dramatically stronger than another, and a beginner is never left carrying a match alone.

### Three things that override the fold

1. **Organizer overrides.** If you've forced two people together, that's honoured first, no questions asked.
2. **Requested partners.** If two players asked for each other, they're paired next.
3. **Everyone else** gets the strongest-with-weakest fold above.

### Odd number of players?

One player is **doubled** — they play in two pairs, so nobody sits out. Every team fields the same number of pairs.

### Repeat partners

Where possible, players aren't paired with someone they've already partnered. It only repeats when there's no alternative left.

---

## Step 3 — Who plays whom

Every team plays every other team once. With 4 teams that's **6 fixtures**:

```
A v B     A v C     A v D
B v C     B v D     C v D
```

The schedule is built by the **circle method** — one team stays put and the rest rotate around it. This produces neat rounds where **every team plays exactly once per round**, so no team sits idle for long while another plays back-to-back.

With an **odd number of teams**, one team rests each round. That rotates, so everyone rests equally.

| Teams | Fixtures |
|---|---|
| 3 | 3 |
| 4 | 6 |
| 5 | 10 |
| 6 | 15 |

**More teams means many more fixtures.** Six teams is more than double the work of four. Worth knowing before you decide the team count — it drives how long the day runs.

---

## Step 4 — Inside a fixture

A fixture is Team A vs Team B. Inside it, pairs are lined up against pairs, in order:

```
Match 1:   A's pair 1   vs   B's pair 1
Match 2:   A's pair 2   vs   B's pair 2
Match 3:   A's pair 3   vs   B's pair 3
   …
```

**How many matches per fixture?** By default, the pair count of the **largest team in the tournament**. If the biggest team has 8 pairs, every fixture gets 8 matches. You can set this number yourself when generating the draw.

Sizing to the largest team is what guarantees **nobody sits out**. A team with fewer pairs simply fields one of them twice — and *which* pair doubles up rotates from fixture to fixture, so no one pair carries the extra load all day.

| Team | Pairs | Matches each pair plays (6 fixtures × 8) |
|---|---|---|
| Team A | 8 | 6 each |
| Team B | 7 | 7, 7, 7, 7, 7, 7, 6 |

> **Note:** when the number of matches per fixture is even, a fixture can finish level — a **drawn fixture**, worth 1 point to each team.

Because pairs were built to roughly equal strength in step 2, pair 1 vs pair 1 is a fair match — not the strongest against the weakest.

---

## The "Generate Matches" button

Steps 3 and 4 both happen the moment you click **Generate Matches** on the Draws page. One click builds the entire schedule.

### Before you can click it

In this order:

1. Teams created
2. Players assigned to teams
3. **Pairs published** — generating pairs is not enough, they must be published
4. Then the button works

If pairing isn't published you'll get *"publish doubles pairings before generating franchise ties."*

### What it produces

Four teams, seven pairs each:

| | |
|---|---|
| Fixtures | **6** (every team meets every other) |
| Matches per fixture | **7** |
| Total matches | **42** |

If one team had **8** pairs instead, every fixture would be 8 matches — **48 total** — so that eighth pair gets on court.

Everything is created at once, ready to schedule onto courts.

### It only runs once

If the stage already has matches, the button refuses: *"this stage has already been drawn."*

To change anything — the number of matches per fixture, or the pairs themselves — you must **clear the draw** and generate again. There is no partial edit.

> **Practical consequence:** get your teams and pairs right *before* you click. Regenerating after courts are scheduled means redoing the schedule too.

---

## What this all adds up to

| Level | What's balanced |
|---|---|
| **Team** | Total strength, via the snake |
| **Pair** | Strength within a team, via the fold |
| **Fixture** | Everyone plays everyone, via the circle |
| **Match** | Like-for-like pairs face each other |

Each layer evens things out a little more. No single one does it alone.

---

## Questions you'll get

**"Why is my team weaker than theirs?"**
Add up the skill numbers — they'll be within a point or two. Teams are balanced on *recorded* skill level, so if someone's level is wrong in the system, the balance is wrong too. Fix skill levels **before** building teams.

**"Why am I paired with a beginner?"**
Because you're advanced. Every pair is built to total 4. Two advanced players together would make a 6 — far stronger than everyone else, and unfair on whoever they play.

**"Why does one person play twice?"**
Your team has an odd number of players. Doubling one player is what stops someone else sitting out entirely.

**"Can we swap players between teams?"**
Yes — with the **Jo Tera Hai Wo Mera** power card during the draft ceremony, and only **like for like**: advanced for advanced, intermediate for intermediate. That way the swap can't unbalance the teams.

**"Is pair 1 our strongest pair?"**
No. Pairs are numbered in the order they were created, not by strength. The fold builds every pair to roughly equal strength anyway, so pair 1 v pair 1 is fair — but don't tell captains their pair 1 is their best.

**"Is any of this random?"**
Only tie-breaks. When two players have identical skill, the order between them may be shuffled. Everything structural — the snake, the fold, the fixture list — is fixed and repeatable.

---

*Related: `docs/SIBL-OPERATIONS-GUIDE.md` for how matches are scored and ranked.*
