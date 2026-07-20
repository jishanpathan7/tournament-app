# The Organizer Journey

**Canonical user journey document for Playlane.**
A UX case study, not a specification. Written from the organizer's side of the screen.

---

## Who we are designing for

Meet **Priya**. She works in marketing. She plays badminton on Thursdays.

Someone in the leadership team said *"we should do a company tournament"*, and because Priya is the
one who books the courts, it became hers. Sixty colleagues have signed up. She has never used
tournament software. She has never run a tournament.

She knows badminton perfectly well. She does not know what a "round robin" is called, though she
knows what it *is* — "everyone plays everyone". She does not know the word "seeding". She has never
heard of a "division".

**Priya is not worried about features. Priya is worried about looking foolish in front of sixty
colleagues.**

That is the emotional centre of this entire document. On the day, if something goes wrong, sixty
people stand around holding rackets and looking at her. Every design decision below exists to reduce
that specific fear.

> **The question Priya is actually asking, at every single step, is not "what do I do next?"
> It is "am I doing this right?"**
>
> A product that only answers the first question makes her anxious. A product that continuously
> answers the second one makes her confident. That is the whole job.

---

# Phase 1 — "I've been asked to run this"

### Goal
Turn a vague instruction from her manager into something real that exists.

### User mindset
Priya has a date, a rough headcount, and four courts booked. She has no idea whether this software
is going to be simple or a nightmare, and she is quietly braced for a nightmare. Her first two
minutes decide whether she trusts the product.

She is not ready to make decisions yet. She just wants to start.

### Happy path
She names the event — *"SurveyMonkey Badminton 2026"* — picks badminton, sets the date, and she's in.
Nothing else is asked of her yet.

The product does not open with a wall of settings. It asks for the three things she definitely
knows, and defers everything she doesn't.

### Edge cases
- **She doesn't know the exact date.** Let her save it as a draft with no date. Nothing downstream
  needs it yet.
- **She abandons halfway.** Her half-made tournament is waiting where she left it, not lost.

### System guidance
The moment the tournament exists, the product tells her what happens next in one sentence, in her
language: *"Next, we'll decide how the tournament works."* Not "configure division parameters".

### Success criteria
Under sixty seconds from sign-in to a tournament that exists. She thinks: *"oh — that was easy."*
That single reaction buys the product enormous patience for the harder steps later.

---

# Phase 2 — "How is this actually going to work?" ⭐

### Goal
Decide the shape of the tournament: what competes, and how the day is structured.

### User mindset
**This is the hardest moment in the entire journey, and it arrives before she has any confidence.**

Priya knows what she wants in plain language: *"I want everyone in teams, teams play each other,
lots of doubles matches, everyone plays a lot, done in one evening."*

She does not know that this is called a "franchise round robin with seven-match ties". If the
product asks her to pick between *Round Robin*, *Single Elimination*, *Group + Knockout* and *Swiss*,
she will guess. And a guess here is unrecoverable later — she'll discover on the morning of the event
that half her colleagues play one match and go home.

**Every downstream screen depends on this answer, and it is the answer she is least equipped to
give.** That asymmetry is the single biggest design problem in the product.

### Happy path
Instead of asking her to name a format, the product asks about her event in words she already owns:

> *How many people are you expecting?* — about 60
> *How long do you have?* — one evening
> *How many courts?* — 4
> *Should everyone be in a team?* — yes, teams
> *How do teams get their players?* — **we'll pick them on the night** ← the draft

From that, the product proposes the format and — crucially — **tells her what it means in
consequences, not jargon**:

> **4 teams of 15. Every team plays every other team. 8 doubles matches per meeting.**
> **Everyone plays at least 3 matches. Runs about 3 hours 20 minutes on 4 courts — finishing around 9:15pm.**

That last line is the most valuable sentence in the entire product. It answers the question Priya
actually has — *"will we finish before people need to go home?"* — and no tournament software
reliably tells her.

She can change any of it, but she never has to name a format.

### Edge cases
- **The numbers don't work.** 60 players and 2 courts finishing in two hours is not possible. Say so
  immediately and offer the trade: *"With 2 courts this runs about 6 hours. Add courts, shorten
  matches, or run fewer matches per meeting."* Show her the lever, not an error.
- **She doesn't know her headcount yet.** Let her proceed on an estimate and re-run the calculation
  when real numbers arrive.
- **She wants something unusual.** Keep a plain "choose the format myself" escape hatch for the one
  organizer in twenty who knows exactly what they want.

### System guidance
Every format choice is described by its *consequence for the players*, never by its name:
- "Everyone plays everyone" — not *Round Robin*
- "Lose twice and you're out" — not *Double Elimination*

### Success criteria
Priya can explain the format to a colleague in one sentence, without using a word she learned from
the software. If she can't, this phase failed.

---

# Phase 3 — "I need people to sign up"

### Goal
Get sixty colleagues onto a list.

### User mindset
Priya already has a WhatsApp group. She is going to paste a link into it. She may also already have
a spreadsheet from a previous event, or a form response export.

She is thinking about **chasing people**, not about data.

### Happy path
She gets a link and a QR code. She pastes the link into WhatsApp and moves on with her day.

If she already has a spreadsheet, she uploads it. The product shows her what it found — *"58 new,
2 already added, 1 missing an email"* — **before** anything is saved, and she fixes the one bad row
inline rather than re-exporting from Excel.

Registrations arrive over the next week. She checks the count occasionally. That's the whole phase.

### Edge cases
- **The spreadsheet is messy.** Merged cells, a header row halfway down, inconsistent column names.
  This is the norm, not the exception. The importer should read it anyway and ask only about what it
  genuinely can't resolve.
- **The same person signs up twice.** Flag it, don't silently merge and don't hard-fail the import.
- **Someone signs up with no skill level.** Accept it. Treat them as intermediate, and mark it so
  she can fix it later if she cares.
- **People keep signing up after she wanted to close.** Let her close registration but keep adding
  people manually — the deadline is hers, not the software's.

### System guidance
Never make her leave the product to chase people. Generate the message for her, ready to paste:

> *"🏸 SurveyMonkey Badminton — Friday 24th, 6pm, Courts 1–4. Sign up here: [link]"*

Small thing. Saves her writing it, and makes the link impossible to forget.

### Success criteria
She has a list of names she trusts, and she never opened a spreadsheet to fix formatting.

---

# Phase 4 — "Who is actually playing?"

### Goal
Turn a list of sign-ups into a confirmed field.

### User mindset
Priya is reviewing names. Mostly she's rubber-stamping — these are her colleagues, she isn't
adjudicating anything. She wants to click one button and be done.

The one thing on her mind: *"is this the final list?"* No — people will drop out. She knows that.
She's approving *eligibility*, not attendance, even though nobody has used those words with her.

### Happy path
She selects all, approves all, done. Sixty approved players.

### Edge cases
- **Someone from another office isn't eligible.** She rejects one person. It should be quiet and
  reversible — she may change her mind.
- **More sign-ups than capacity.** A waitlist that visibly holds people, so she can promote someone
  when a drop-out happens.
- **She approves everyone and then someone drops out a week early.** She should be able to remove
  them here without hunting for the right screen.

### System guidance
> ⚠️ **This is the first place Priya can be genuinely confused, and it has already caused a real
> contradiction in the product.**
>
> "Approved" and "checked in" feel like the same action to a non-technical organizer — *"I already
> said they're playing, why am I confirming again?"*
>
> The product must make the distinction obvious in its own words, and never require her to hold it
> in her head:
> - **Approved** = *"they're in the tournament"* (decided in advance)
> - **Checked in** = *"they're in the building"* (decided on the day)
>
> The failure mode to avoid at all costs: approving someone quietly removes them from a later step.
> That is a trap, and it is invisible until it has already broken something.

### Success criteria
One click for the common case. She never wonders whether approving was the right button.

---

# Phase 5 — "Who actually turned up?"

### Goal
Find out who is physically present, minutes before the teams are made.

### User mindset
**The temperature has changed.** It's 5:45pm. People are arriving. Someone is asking about parking.
Two people have messaged to say they're stuck in traffic. Priya is standing up, holding a phone, not
sitting at a laptop.

She is no longer *planning*. She is *coping*. Everything from here must work one-handed, on a phone,
under mild social pressure.

She is thinking: *"how many are here? can we start?"*

### Happy path
A QR code on the door. People scan and tap their name as they walk in. Priya watches a number climb:
*"52 of 60 here."*

She does not check anyone in manually unless she has to.

### Edge cases
- **Someone forgot to scan and is standing right there.** She taps their name herself. Two seconds.
- **Someone didn't come and isn't answering.** She marks them absent. The tournament must proceed
  without them, and the product must not treat their absence as an error.
- **Someone arrives late, after teams are made.** ⚠️ This *will* happen. It is the single most common
  real-world disruption. She needs a way to add them to a team afterwards — see Phase 7.
- **Two people share a name.** Show something distinguishing so she isn't guessing.

### System guidance
The product should tell her when she has enough, not make her work it out:

> *"52 present. That's enough for 4 teams of 13. You can start the draft, or wait for the last 8."*

That sentence removes a decision she is not equipped to make while standing in a corridor.

### Success criteria
She knows exactly how many people are in the room, and she was told — not left to count.

---

# Phase 6 — "Let's make the teams" ⭐

### Goal
Turn sixty individuals into four teams, publicly and fairly.

### User mindset
**This is not an admin task. This is the event.**

People have gathered round. Someone is filming on their phone. There's a projector. Priya is not
using software right now — she is *hosting*. Her attention is on the room, not the screen.

She is thinking: *"is this fun? can everyone see? is it fair?"*

She is terrified of one thing: that the software does something confusing and she has to explain it
to sixty people while they watch.

### Happy path
The screen goes full-width on the projector. A wheel of names spins. It lands on someone. The room
reacts. The name flies into a team. Repeat.

Priya presses one button — space bar — and the ceremony runs itself. She narrates; the product
performs.

Teams come out balanced by ability, and the product guarantees that without her having to check.

### Edge cases
- **The wheel lands on someone who has left.** She needs an instant undo that everyone can see is
  fair — not a hidden admin correction after the fact.
- **She fat-fingers something.** Every action is reversible, and the reversal is as public as the
  action was.
- **The laptop refreshes, or the browser crashes, mid-draft.** ⚠️ Catastrophic in the room.
  The ceremony must resume exactly where it stopped, and she must not be the one to discover
  whether it can.
- **Someone arrives during the draft.** They join the pool if the draft is still running.
- **The teams look unbalanced to the room** — even when the maths says otherwise. She needs a
  visible fairness signal she can point at: *"the system balanced by skill; here's the split."*

### System guidance
Nothing on this screen should need explaining. If Priya has to say *"hang on, let me work out what
this means"* in front of sixty people, the design has failed.

Every moment should state its own consequence out loud — including the counter-intuitive ones. When
a bonus card appears, the screen should say **"no pick was lost"**, because otherwise sixty people
will assume someone was skipped.

### Success criteria
People clap. Nobody asks how it works. Priya never touched anything except the spin button.

---

# Phase 7 — "Is this actually right?" ⭐

### Goal
Correct reality before it becomes permanent.

### User mindset
The excitement has died down. Priya is looking at four team lists and thinking, for the first time
that evening: *"wait — is this right?"*

Two people arrived late. One person left. One team looks stronger than the others. Someone got put
with a partner they came with, and it feels odd.

**She needs a moment of calm control after a moment of theatre.** Without it, she carries a small
anxiety into the rest of the night.

This phase is easy to skip in design, and it's the one that prevents the worst kind of failure:
discovering a mistake after the schedule is printed.

### Happy path
All four teams side by side. Sizes, balance, and pairs visible at a glance. She drags one late
arrival onto the smallest team. She swaps two players between teams. She's satisfied.

Then she locks it — and the product tells her plainly what locking means:

> *"Locking teams creates the fixtures. You can still unlock later, but that clears the schedule
> and you'll need to generate it again."*

### Edge cases
- **A team ends up with an odd number of players.** ⚠️ This is guaranteed with 58 or 62 players.
  Someone has no partner. The product must resolve it visibly: one player pairs up twice and plays
  an extra match — and it must say *who*, and let her choose.
- **She locks, then someone else arrives.** She must be able to unlock, and she must have been told
  in advance what that costs.
- **A team is clearly weaker.** Show the imbalance honestly; let her fix it manually. Don't hide
  behind "the algorithm balanced it".

### System guidance
This is where the product should be most conservative. **Nothing irreversible should happen without
stating its consequence first.** The word "lock" is frightening precisely because organizers have
been burned by software before — earn the trust by explaining, not by warning.

### Success criteria
Priya has looked at every team and consciously said *"yes, that's right"*. She locks deliberately,
not accidentally.

---

# Phase 8 — "When does everyone play?"

### Goal
Turn locked teams into a timetable people can follow.

### User mindset
Priya doesn't want to build a schedule. She wants a schedule to *exist*.

She's thinking about the room, not the algorithm: four courts, people waiting, and the very real
possibility that a queue forms and the evening drags.

### Happy path
Fixtures appear automatically the moment teams are locked — she didn't ask for them, they're simply
there. She confirms her four courts and the match length, presses one button, and every match has a
court and a time.

She sees the finishing time, and it matches what she was promised in Phase 2.

### Edge cases
- **A court becomes unavailable.** Remove it and reschedule; everything shifts.
- **The estimate is too long.** Give her the levers she actually has: shorter matches, more courts,
  fewer matches per meeting.
- **A player is in two pairs** (from Phase 7's odd roster). ⚠️ They cannot be on two courts at once.
  The scheduler must never do this, and it must not be Priya's job to notice.

### System guidance
Schedule matches, but keep each team-vs-team meeting together in time. A meeting that trickles
across four hours is impossible to follow — for players, for spectators, and for her.

### Success criteria
She has something she can share, and she believes the finishing time.

---

# Phase 9 — "Are we ready?"

### Goal
Convert anxiety into certainty before the first serve.

### User mindset
It's 6:20pm. Everyone's here. Priya is about to say "let's start" to sixty people and she is running
a mental checklist she doesn't fully trust: *did I miss anything? is everyone in a team? does
everyone know where to go?*

**This is the moment of maximum anxiety in the entire journey.**

### Happy path
One screen answers the question completely:

> ✅ Every player who checked in is on a team
> ✅ Every team has its pairs
> ✅ Every match has a court and a time
> ✅ No player is scheduled on two courts at once
> ⚠️ 6 approved players never checked in — that's fine, they've been left out
>
> **Ready to start.**

She presses **Go Live** once, with confidence.

### Edge cases
- **Something is genuinely wrong.** Say exactly what, and take her straight to the fix.
- **Something is odd but not wrong** — an idle court, a no-show. Show it as information, never as a
  blocker. ⚠️ A checklist that can't be satisfied gets ignored, and then it protects nothing.

### System guidance
Distinguish clearly between *"this will break the tournament"* and *"you might want to know this"*.
Only the first should stop her.

### Success criteria
Priya presses one button and feels certain. She does not press it hoping.

---

# Phase 10 — "Keep it running"

### Goal
Survive three hours of live sport without anything stalling.

### User mindset
Priya is standing, walking, being interrupted constantly. People ask her when they play. Someone
wants to know the score. A court finished five minutes ago and nobody told her.

**She is not navigating the product. She is glancing at it.**

Her question is never *"where is the fixtures page?"* It is always **"what's broken right now?"**

### Happy path
One screen stays open on her laptop all evening and answers that question without being asked:

> **21 of 42 matches complete**
> Court 1 — Titans vs Smashers, Match 3 — *in progress*
> Court 4 — **idle for 8 minutes** ← the thing she needs to see
> Match 12 — **finished, no score entered** ← the other thing she needs to see

Umpires enter scores on their phones through a link that opens exactly one match and nothing else.
Standings update themselves. She mostly watches.

### Edge cases
- **A court finishes and nobody says anything.** The most common cause of a slow evening. The
  product should surface the idle court before she notices it.
- **A wrong score is entered.** She corrects it. This must be possible without ceremony — and she
  must not have to find out from an angry player.
- **A player doesn't show for their match.** Walkover, chosen deliberately — never faked with a
  score.
- **Someone gets injured.** Real, and currently unaddressed. She needs to substitute or void a
  match without the tournament seizing up.
- **The wifi drops.** ⚠️ In a sports hall this is likely. Scores entered offline should not vanish.

### System guidance
Rank by urgency, not by structure. Problems first, progress second, everything else on request.
The product's job on the night is to notice things before Priya does.

### Success criteria
The evening runs without a queue. Priya spent the night talking to colleagues, not operating
software.

---

# Phase 11 — "Who won?"

### Goal
Finish cleanly, and give people something to remember it by.

### User mindset
It's 9:20pm. People are tired and happy. Priya wants to announce a winner **now**, while everyone is
still in the room — not tomorrow after reconciling a spreadsheet.

Then she wants to share something in the WhatsApp group and be finished.

### Happy path
The final match completes and the standings are already correct. She reads out the winning team.
She publishes the results, pastes a link into WhatsApp, and closes her laptop.

### Edge cases
- **Two teams are level.** The tiebreak must already be decided and visible — never improvised in
  front of a room.
- **A match never got scored.** Show it clearly rather than silently producing wrong standings.
  ⚠️ Wrong standings announced publicly is the worst possible failure of this product.
- **Someone disputes a result afterwards.** She needs the history of what was entered and when.

### System guidance
The winner should be determined by the system and merely *confirmed* by Priya. She should never be
doing arithmetic at 9pm.

### Success criteria
The winner is announced in the room, within a minute of the last point.

---

# The journey as one continuous story

Priya is asked to run the company badminton tournament. She signs in, names it, and picks the date —
a minute's work, and her first impression is that this might be fine.

The product asks her about her event in plain language: how many people, how long, how many courts,
should there be teams. She answers what she knows. It tells her what will happen — four teams,
everyone plays at least three matches, finished by quarter past nine — and she never has to learn
what that format is called.

She pastes a link into WhatsApp. Over a week, sixty colleagues sign up. She uploads an old
spreadsheet for the stragglers and the product sorts out the mess. She approves everyone in one
click.

On the evening, people arrive and scan a code at the door. Priya watches the number climb and is
told when she has enough to start.

Then the room gathers. The screen goes up on the projector and the draft begins. A wheel spins,
names fly into teams, people cheer at their captain, and Priya barely touches the laptop. Ten
minutes later there are four teams and the room is loud.

She takes a quiet moment to check the teams, moves two late arrivals, and locks them in — knowing
exactly what locking means because the product told her before she did it.

Fixtures appear on their own. She confirms four courts, presses schedule, and every match has a time.
Before starting, one screen confirms that everything is ready and nothing is missing. She presses
Go Live once.

For three hours she watches a single screen that tells her what's broken — an idle court, a missing
score — and otherwise she talks to colleagues. Umpires score on their phones. Standings look after
themselves.

At 9:20 the last point is played. The winner is already on the screen. She announces it to the room,
shares the link, and goes home.

**She never learned what a round robin is called.**

---

# Condensed flow

```
   ┌─────────────────────────────────────────────────────────────────┐
   │  BEFORE THE DAY                                                 │
   └─────────────────────────────────────────────────────────────────┘

   Name it  ──►  Describe the event  ──►  Share the link  ──►  Approve
    (1 min)      (plain language →         (WhatsApp)         (1 click)
                  format + finish time)

   ┌─────────────────────────────────────────────────────────────────┐
   │  ON THE DAY — BEFORE PLAY                                       │
   └─────────────────────────────────────────────────────────────────┘

   Check in  ──►  ★ DRAFT  ──►  Review & lock  ──►  Schedule  ──►  Ready?
   (QR at door)   (the event)   (fix reality)      (one press)    (one gate)
        │              │              │                              │
   "enough to     "people        "yes, that's                   ✅ GO LIVE
    start?"        clap"          right"

   ┌─────────────────────────────────────────────────────────────────┐
   │  DURING PLAY                                                    │
   └─────────────────────────────────────────────────────────────────┘

   ★ ONE SCREEN, ALL EVENING  ◄──── umpires score on phones
     "what's broken?"                standings update themselves
     idle courts · missing scores
                    │
                    ▼
              Announce winner  ──►  Share  ──►  Done
              (already decided)
```

---

# Where Priya gets confused

Ranked by how much damage each one does.

### 🔴 1. Choosing the format
The hardest decision, asked at the moment of least confidence, with consequences she cannot foresee.
Format names are meaningless to her; consequences are not. **Fix: ask about her event, propose the
format, describe it in outcomes and a finishing time.**

### 🔴 2. "Approved" vs "checked in"
These feel like the same action performed twice. She will assume the first one covers the second.
**Fix: name them for *when* they happen — "in the tournament" versus "in the building" — and never
let one silently undo the other.**

### 🔴 3. "Team" vs "pair"
Two words for groups of people, with a third concept (the roster) hiding behind them. If the product
is ever loose with these words, she will be too — and then she can't reason about her own tournament.
**Fix: one word per concept, everywhere, forever. Team competes. Pair represents.**

### 🟡 4. What "lock" costs
A frightening word attached to an unclear consequence. She will either avoid it or trigger it
accidentally. **Fix: state the cost before the click, never after.**

### 🟡 5. Where the match format lives
She knows badminton scoring intimately. She has no idea which screen owns it, and she'll discover
it's wrong when an umpire can't submit a legitimate score mid-event. **Fix: surface it during setup
where she's already deciding how the tournament works, and confirm it in pre-flight.**

### 🟡 6. Nothing tells her a court is free
The single biggest cause of a slow evening, and entirely invisible unless the product says so.
**Fix: surface idle courts and missing scores as the top items on the live screen.**

### 🟡 7. Late arrivals
Guaranteed, and it happens right after the least reversible step. **Fix: make adding someone after
the draft an expected, supported path — not a workaround.**

### ⚪ 8. What "publish" means
Does the public link exist? Can people see it already? Ambiguity here makes her cautious about a
harmless action. **Fix: show the link and its state plainly — *"visible to anyone with the link"*.**

---

# What would make it feel magical

Six ideas, roughly in order of impact per unit of effort.

### 1. Tell her when it will finish
> *"About 3 hours 20 minutes on 4 courts — finishing around 9:15pm."*

The single most valuable sentence the product can produce, because it's the question she actually
has and the one no tournament software answers. Show it during setup, and again whenever anything
changes it. If it drifts on the night, tell her: *"running about 20 minutes behind."*

### 2. Describe the event, don't name the format
Replace the format picker with four plain questions and let the product propose. Removes the hardest
decision in the journey by removing the vocabulary.

### 3. A rehearsal
Let her press *"show me what the evening looks like"* and watch the schedule play out with invented
scores — courts filling, standings moving, the winner appearing. Two minutes of simulation converts
a week of low-level dread into confidence, and it costs nothing to be wrong in a rehearsal.

This is the one idea worth building even though it's larger than the others.

### 4. Messages she can paste
Registration link, day-before reminder, court call, final results — generated, formatted, ready for
WhatsApp. Organizers run events in group chats. Meeting them there removes real work.

### 5. Say "you can undo this" out loud
Anxiety comes from not knowing whether an action is permanent. Stating reversibility *before* the
action — and meaning it — is worth more than any confirmation dialog. Confirmation dialogs ask *"are
you sure?"*; what she needs to hear is *"this is fine, you can change it later."*

### 6. Notice problems before she does
Idle court. Missing score. Running late. Player scheduled twice. She should never be the detection
mechanism — on the night she is walking around, talking to people, and not looking at the screen.
A product that quietly watches is worth more to her than any feature she has to operate.

---

## The one sentence to design against

> **Priya should be able to run a sixty-person tournament without learning a single word she didn't
> already know from playing badminton.**

Every term she has to learn, every screen she has to hunt for, and every consequence she discovers
late is a failure of this document.
