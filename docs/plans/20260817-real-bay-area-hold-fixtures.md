# Real Bay Area hold fixtures for entry training

## Overview

**Extend** the fixture pools that drive the entry drill and clearance-copy screens with
**real Bay Area and Central Valley fixes and navaids**, so entry practice also happens at
places the student actually flies (KTCY, KLVK, KSQL, KOAK, KHWD, KSCK, KMOD). The existing
invented fixtures (`ZORVU`, `QUIBO`, `VAXNU`, `BRIXO`) **stay** — this adds variety, it
does not swap one pool for another.

**What this is not.** The app renders no plates and names no procedures. It teaches
**hold entry geometry**. Real names buy familiarity and immersion, not chart authority.
Nothing here claims to be current chart data, and no AIRAC/cycle/amendment machinery is
introduced — a stale hold still trains the correct entry, which is the whole point.
Real geometry is a **nice-to-have, not a hard requirement**: where research is
inconclusive, plausible geometry on a real name is acceptable, with one exception carved
out below.

**The problem it solves.** Two things at once:

1. Entry practice currently happens only at invented fixes, so nothing about the scenario
   feels like the airspace the student flies. Adding real names makes the drill rehearse
   the actual radio-and-chart picture, while keeping the invented fixtures preserves pool
   size and seed variety.
2. The current rule — *fixture names must never be real waypoints* — is the wrong
   invariant, and it has been patched three times without fixing the underlying
   confusion (`docs/content-audit.md` entries 9, ~298, ~392: `HAIRE`, `CEDES`,
   `WINDY`/`DRIFT`/`TIMBR`). The defect in every one of those was **inventing facts
   about a real place**, not naming one. Banning real names is a proxy for the real
   invariant and it forbids exactly the feature we want.

**The invariant that replaces it** (the heart of this plan): a clearance fixture may
carry a real name, but if that name also appears in `CHART_HOLDS`, its geometry
**must be identical**. That closes the `HAIRE` defect directly — invented data
contradicting the real charted hold at the student's home field reds the suite — while
permitting real names everywhere else. It is a stronger guard than the ban, because
the ban never checked geometry at all.

This stays a **hard** requirement even though geometry is otherwise best-effort, and the
reason is **internal consistency, not chart fidelity**: `CHART_HOLDS` already teaches
specific geometry for those fixes on the written-test screen. Two screens teaching
different holds under one fix name is the app contradicting itself — worse than merely
approximate data, and invisible to any amount of chart caveating.

## Context (from discovery)

**Files/components involved:**

- `src/engine/clearance.ts:203-216` — `VOR_NAMES` (already real NorCal VORs: Manteca,
  Linden, Sacramento, Modesto, Panoche), `NDB_NAMES`, and `PUBLISHED_HOLDS` (four
  invented fixes with invented course/turns/leg). `generateClearance` at :246 branches:
  "hold as published" draws `PUBLISHED_HOLDS`, ad-hoc ATC draws `VOR_NAMES`/`NDB_NAMES`
  with a randomly generated radial, turn direction and leg.
- `src/modules/entry-drill.ts:293` — `chartNote`, which renders
  `"Practice plate (fictitious fix) — …"`. Named and worded for plates that do not exist.
- `src/content/questions.ts:77` — `CHART_HOLDS`, already carrying real cited Bay Area
  holds including **`OYOSO`** (KTCY, 116° inbound, left turns, 4 NM) and `HAIRE`, `UHHUT`.
  Written test only; the entry drill never sees them.
- `src/engine/clearance.test.ts:414` — guard: fixture names disjoint from `CHART_HOLDS`.
- `src/modules/entry-drill.test.ts:1128-1136` — guard: every `chartNote` matches
  `/fictitious/i`.
- `src/modules/wind-lab.test.ts:101-122, 327-333` — wind-lab's own guards
  (no real waypoint names, cross-list disjointness, "fictitious" label).

**Related patterns found:**

- `CHART_HOLDS` is the existing, working model for holding real geometry honestly.
- Both instrument/content guard families in this repo prefer *scans that fail on the
  defect* over hand-maintained lists.

**Dependencies identified:**

- `generateClearance` is shared by the entry drill **and** clearance copy — both move
  together. This was an accepted scope decision, not an accident.
- `src/modules/wind-lab.ts:56` — `FIXES` stays **invented** and out of scope. The wind
  lab renders its geometry as plain fact with no clearance framing, which is precisely
  the shape of the `WINDY`/`DRIFT` defect. Its guards stay untouched and must keep
  passing against the newly-real clearance lists.
- **No store migration needed.** `missesToCards` (`src/app/anki-export.ts:141-145`)
  re-derives the entry answer from the snapshot's own `heading`/`holdSpec`, never from
  the seed, so changing `PUBLISHED_HOLDS` cannot rewrite a recorded miss or an exported
  card. This is load-bearing and gets pinned by a test rather than trusted.

## Development Approach

- **testing approach**: **TDD (tests first)** — mandated by `CLAUDE.md` ("Tests first,
  always: reference-case tests for engine and content modules, then implement until
  green").
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: `npm test` AND `npm run typecheck` must both pass before starting the next
  task** — vitest strips types with esbuild and never type-checks, so green tests do not
  mean the code compiles
- **CRITICAL: update this plan file when scope changes during implementation**
- maintain backward compatibility of the localStorage schema (`{ v: 1, … }`)

## Testing Strategy

- **unit tests**: required for every task (see Development Approach).
- **content validation tests**: every new hold entry needs its geometry validated
  (course in `[0,360)`, leg unit/value sane, turn direction present).
- **mutation-test every new guard before trusting it.** `CLAUDE.md` records repeated
  cases in this repo where a guard passed against the very defect it named. For each new
  guard: introduce the defect deliberately, confirm the named test reds, revert.
- **no e2e framework** in this project — UI logic is covered by jsdom tests only.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update this plan if implementation deviates from the original scope

## Solution Overview

**Architecture:** no new modules, no new dependencies, no type changes. The change is
*additive* data plus a guard swap.

1. **Research a hold dossier** (`docs/bay-area-holds.md`) recording each real fix/navaid,
   its hold geometry, and where the geometry came from — a research artifact in the
   `docs/parallel-entry-evidence.md` tradition, not a runtime source.
2. **Invert the fixture invariant.** Drop "no real waypoint names" as a *blanket* rule on
   the clearance lists (it still applies to the invented members, and to wind-lab
   wholesale); add "a fixture sharing a name with `CHART_HOLDS` must share its geometry."
3. **Extend the data.** `PUBLISHED_HOLDS` gains real Bay Area holds alongside its four
   invented ones; `VOR_NAMES`/`NDB_NAMES` gain real Bay Area/Central Valley stations.
4. **Fix the rendered line.** `chartNote` → `holdNote`: no plate framing, no procedure
   name, no amendment, no cycle. Just the hold. Because the pool is now **mixed**, the
   wording must be true of an invented fix and a real one alike — see Technical Details.

**Key design decisions and rationale:**

- **Geometry is best-effort.** Use real geometry where research yields it — once we are
  researching anyway it is nearly free and strictly better training. Where research does
  not settle it, plausible geometry on a real name is explicitly acceptable and must not
  block the task. The sole exception is a `CHART_HOLDS` name collision, where the guard
  *requires* an exact match.
- **Keeping the invented fixtures costs nothing and buys pool size.** They are already
  verified free of real-waypoint collisions, and a larger pool means more seed variety in
  the drill.
- **The ad-hoc branch keeps randomized radials.** An ATC-assigned hold at a real VOR
  claims nothing published; this is exactly how ATC assigns holds, and it is why
  `VOR_NAMES` survived every prior audit while the 5-letter lists did not.
- **Wind lab stays invented.** Cheapest correct answer; its rendering claims fact without
  a clearance frame.

⚠️ **One decision deliberately left open for implementation** — whether `holdNote` keeps a
short hedge (e.g. `"Practice data — verify on the current chart."`). It names no procedure
and costs one clause, so the plan defaults to **including it**; the clearance text still
says "hold as published," which is itself a mild authority claim. Drop it if it reads as
clutter in the real UI — but decide deliberately and record the choice in the ledger.

## Technical Details

**`PUBLISHED_HOLDS` shape stays unchanged** — `{ fix, inboundCourse, turnDirection, leg }`.
Only the contents grow, so no type or consumer changes are needed. This is a deliberate
choice: see "Mixed-pool labelling" below for the alternative that *would* have changed it.

**New guard (Task 2), stated precisely:**

```
for each fixture F in PUBLISHED_HOLDS:
  if CHART_HOLDS contains a hold C with C.fix === F.fix:
    require F.inboundCourse === C.inboundCourse
    require F.turnDirection === C.turnDirection
    require F.leg.unit === C.leg.unit && F.leg.value === C.leg.value
```

Compare **every** geometry field, not a subset — `CLAUDE.md` records the exact failure
mode where guarding one field of a pair let the other drift.

**Disjointness rules after this change:**

| List | Real names? | Must be disjoint from |
|---|:-:|---|
| `PUBLISHED_HOLDS` (clearance) | **mixed** | wind-lab `FIXES` |
| `VOR_NAMES` / `NDB_NAMES` | **mixed** | wind-lab `FIXES` |
| wind-lab `FIXES` | no (invented only) | all others, `CHART_HOLDS`, real waypoints |

A `PUBLISHED_HOLDS` ∩ `CHART_HOLDS` overlap is now **permitted and geometry-checked**
rather than banned. The surviving invented members keep their existing property of not
colliding with real waypoints — that check is not deleted, it just no longer applies to
the whole list.

**Mixed-pool labelling.** With invented and real fixes in one pool, no per-hold claim can
be made by a blanket string: `"fictitious fix"` is true of `ZORVU` and false of `OYOSO`.
Two ways out:

- **(chosen) A neutral line true of every member** — e.g. `"Practice hold — not current
  chart data."` Honest for an invented fix (it is practice data) and for a real one (the
  geometry is best-effort and uncurated). Costs nothing, changes no types.
- **(rejected) A `real: boolean` per hold**, with the note branching on it. More precise,
  but it adds a field, a branch, and a second thing to keep true — for a distinction the
  student cannot act on, since neither kind may be flown. Reconsider only if a concrete
  need appears.

**Processing flow is unchanged.** `generateClearance(seed)` → `generateScenario(seed)` →
`determineEntry(heading, holdSpec)`. Only the pool that `pick()` draws from changes.

**Seed-stream note.** Growing `PUBLISHED_HOLDS` changes which hold a given seed draws.
That is acceptable *only because* recorded misses snapshot their own `holdSpec` — do not
"fix" this by reordering or padding the list, and do not insert new `rng()` calls into
`generateScenario`, which would shift the heading a seed produces (already pinned by
`keeps every existing seed on its original heading and answer`).

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): research artifact, data, guards, tests, docs.
- **Post-Completion** (no checkboxes): browser verification and judgment calls that need
  a human looking at the screen.

## Implementation Steps

### Task 1: Research and record the Bay Area / Central Valley hold dossier

**Files:**
- Create: `docs/bay-area-holds.md`

Candidate fields: **KTCY, KLVK, KSQL, KOAK, KHWD, KSCK, KMOD**. Candidate navaids to
verify: Woodside (OSI), Sausalito (SAU), Point Reyes (PYE), Salinas (SNS), Oakland (OAK),
Stockton (SCK), Avenal (AVE), Scaggs Island (SGD) — alongside the five already shipped.
**Every one of these is a candidate, not a fact** — several NorCal VORs were
decommissioned under the VOR MON program, and that must be checked, not assumed.

**The name is the deliverable; the geometry is best-effort.** Do not stall this task on a
hold whose published geometry cannot be pinned down — record the real name with plausible
geometry, mark it as such, and move on. The one thing that must be right is a
`CHART_HOLDS` collision (see Task 2).

- [x] research published holds (HILPT and missed-approach) at the seven fields; record
      fix name, inbound course, turn direction, leg length for each
- [x] verify each candidate navaid still exists and record its status; note any that are
      decommissioned (keeping a decommissioned name is acceptable per scope — recording
      it *as* decommissioned is not optional)
- [x] mark every entry's geometry **confidence** (researched / approximate / invented), so
      a later reader can tell which is which without redoing the work
- [x] record provenance per entry (where the geometry came from, date looked up), plus an
      explicit header stating this dossier is a research artifact and **not** current
      chart data
- [x] cross-check every researched fix against `CHART_HOLDS` and flag any name collisions,
      which Task 2's guard will constrain
- [x] confirm no researched name collides with wind-lab's `FIXES`
- [x] no code changes in this task — dossier only

### Task 2: Add the geometry-consistency guard (before any data changes)

**Files:**
- Modify: `src/engine/clearance.test.ts`

- [x] write the guard: any `PUBLISHED_HOLDS` fixture sharing a `fix` with a `CHART_HOLDS`
      entry must match it on `inboundCourse`, `turnDirection`, `leg.unit` **and**
      `leg.value` (all four, per Technical Details)
- [x] write a test asserting the guard is not vacuous — i.e. it fails on a synthetic
      overlapping pair with mismatched geometry, so it cannot silently pass when no
      overlap exists yet
- [x] **mutation-test**: temporarily add `OYOSO` to `PUBLISHED_HOLDS` with wrong geometry,
      confirm the named test reds, revert
- [x] run `npm test` and `npm run typecheck` — must pass before task 3

### Task 3: Rework `chartNote` into `holdNote` — remove plate framing

Done **before** the data change on purpose: dropping a true "fictitious" label while every
name is still invented understates safely, whereas adding real names first would ship the
actively false `"fictitious fix — OYOSO"`.

The pool ends up **mixed**, so the new wording must be true of an invented fix and a real
one simultaneously — this is the "neutral line" decision from Technical Details, and it is
what makes a single string sufficient.

**Files:**
- Modify: `src/modules/entry-drill.ts`
- Modify: `src/modules/entry-drill.test.ts`

- [x] rename `chartNote` → `holdNote` and update the `EntryScenario.chartNote` field and
      all call sites (`generateScenario`, the render path, tests)
- [x] rewrite the rendered string: fix, inbound course (via `courseText`), turn direction,
      leg — no "plate", no "fictitious", no procedure name, no amendment, no cycle
- [x] apply the hedge decision flagged in Solution Overview; record which way it went
      — **kept**, as `HOLD_NOTE_HEDGE` (`"Practice data, not current chart data."`), for
      the plan's own reason: the clearance still says "hold as published". Rendered line:
      `Hold: ZORVU — inbound course 300°, right turns, 1 minute legs. Practice data, not
      current chart data.` Ledger entry follows in Task 9.
- [x] replace the `/fictitious/i` assertion with a guard that the line **names no
      procedure, amendment or chart cycle** (prose scan for plate-identity patterns)
- [x] write tests that the line still states fix, course, turns and leg for a sweep of seeds
- [x] **mutation-test** the prose scan against a line containing a procedure name
- [x] run `npm test` and `npm run typecheck` — must pass before task 4

➕ **`holdNote` is a STORE key, not just a field** — `recordMiss` writes it verbatim to
localStorage and `missesToCards` reads it back by string (the runtime-only coupling class
`CLAUDE.md` flags for the drill ids). Renaming it alone would have left every miss already
recorded on a user's machine exporting an "as published" clearance with no course and no
turn direction — unanswerable, which is the one thing snapshotting the line exists to
prevent. `anki-export.ts` therefore reads `holdNote ?? chartNote`, aliased rather than
migrated (a read-side alias cannot half-fail the way a rewrite of a user's store can), and
two tests pin it: the legacy key still renders, and the current key wins when both are
present. Mutation-confirmed both ways.

➕ Renamed the DOM/CSS carrier too (`.entry-chart` → `.entry-hold`, `chartEl` → `holdEl`),
so the plate vocabulary is gone from the render path as well as the prose. Not touched by
any stylesheet guard — `styles.test.ts`'s `context` is about `.entry-answers-label`.

➕ Corrected three comments that pointed at `chartNote` and would have argued a later
session wrong: `wind-lab.ts` and `wind-lab.test.ts` justified wind lab's *own* "fictitious"
label by saying entry-drill labels the same shape that way (no longer true — wind lab keeps
it because `FIXES` is invented wholesale, which is a different and still-valid reason), and
`clearance.ts` claimed the rendered line is labelled fictitious regardless. Also fixed the
two now-stale `chartNote` symbol references in `CLAUDE.md`; the fixture-name **invariant**
in that bullet is Task 9's to reword.

### Task 4: Extend `PUBLISHED_HOLDS` with the real researched holds

The 14 researched holds and their geometry are in `docs/bay-area-holds.md`
("Recommendations for Tasks 4 and 5"). Four of them (`OYOSO`, `HAIRE`, `UHHUT`, `ALTAM`)
collide with `CHART_HOLDS` by name and already match it exactly on all four geometry
fields, so Task 2's guard becomes load-bearing the moment any of them is added.

**Files:**
- Modify: `src/engine/clearance.ts`
- Modify: `src/engine/clearance.test.ts`

- [x] **append** the researched real holds from Task 1; keep `ZORVU`, `QUIBO`, `VAXNU` and
      `BRIXO` exactly as they are — this is an extension, not a swap. All 14 `researched`
      holds added (pool 4 → 18); `WHYEE`/`IPDEW`/`ORANG`/`ALTAM` held back per the dossier
- [x] delete the now-wrong "fixture names are disjoint from `CHART_HOLDS`" guard
      (`clearance.test.ts:414`), replaced in substance by Task 2's geometry check
- [x] add/keep a guard that clearance fixtures stay disjoint from wind-lab's `FIXES` —
      **kept where it is**: `no fixture collides with a practice hold used elsewhere in
      the app` (`wind-lab.test.ts`) imports `PUBLISHED_HOLDS`, so it widened by itself and
      still passes. A second copy here would drift; Task 7 re-verifies
- [x] keep the surviving invented fixtures covered by a real-waypoint-collision check —
      the property still holds for them and losing it would let a future invented name
      drift onto a real fix unnoticed
- [x] write validation tests for every new hold: `inboundCourse` in `[0,360)`, valid
      `turnDirection`, valid `leg` unit and positive value — plus a 5-letter name shape
      and a `names no fix twice` check (two geometries under one name is the same
      self-contradiction the `CHART_HOLDS` rule exists for, pointed inward)
- [x] verify Task 2's guard is now genuinely load-bearing (at least one real overlap with
      `CHART_HOLDS`, e.g. `OYOSO`, exercises it) — three overlaps (`OYOSO`, `HAIRE`,
      `UHHUT`), and mutating `OYOSO` to right turns reds `never contradicts a charted hold
      it shares a name with`. The overlap itself is now asserted, not assumed: see ➕ below
- [x] run `npm test` and `npm run typecheck` — must pass before task 5 (787 tests, clean)

➕ **`PUBLISHED_HOLDS` is now the concatenation of two exported source lists**,
`INVENTED_HOLDS` and `RESEARCHED_HOLDS`. Not cosmetic: "keep the invented fixtures covered
by a real-waypoint check" needs a way to *say which ones are invented*, and a hand-listed
set of four names in the test file measures only what existed when it was typed — the
exhaustiveness hole `CLAUDE.md` records for `TIERS`, `OVERLAY_ALPHA` and the rest. The
split is machine-readable provenance instead, and `every fixture is declared invented or
researched` closes the one way out (a hold appended straight to the exported array, which
is the edit the file's previous shape invited) — such a fixture would reach the drill while
escaping *both* provenance guards. This is the cheap version of the `real: boolean` the
plan rejected: no new field, no branch, nothing the student can see.

➕ **A real name is a claim about a real place, and `CHART_HOLDS` only constrains four of
the fourteen.** For the other ten the dossier is the only witness, so
`RESEARCHED_HOLDS agrees with docs/bay-area-holds.md` parses the dossier's hold tables
(`?raw`, the README↔`PHASE_PREP` idiom) and pins course, turns and leg per fixture — the
same shape as the `CHART_HOLDS` check, one witness out. It keys rows off the confidence
column rather than a table caption (the dossier has four tables whose first column is a fix
name), **throws** on a hold-shaped row it cannot parse rather than skipping it (a skip is
fail-open), requires *exactly one* row per shipped fixture (`OAK` has two, and shipping an
ambiguous provenance is the confusion the dossier exists to prevent), and rejects a row
marked `invented` — a real name with made-up numbers wearing the guard's own paperwork is
the original defect.

➕ **Deleted the duplicate real-waypoint guard in `entry-drill.test.ts`** (`no fixture
reuses a real NorCal fix name the student might fly`). It swept all of `PUBLISHED_HOLDS`,
which is now a mixed pool where a real name is the *feature*; the surviving check lives in
`clearance.test.ts` scoped to `INVENTED_HOLDS`, beside the data it constrains. One copy on
purpose — two hand-written statements of one rule drift, and the half nobody edits waves
the defect through. Also corrected two comments that would have argued a later session
wrong: `entry-drill.test.ts`'s "`PUBLISHED_HOLDS` is *about to become* a mixed pool", and
`hsi.test.ts`'s "`ZORVU` is already a `PUBLISHED_HOLDS` fixture, i.e. already checked to be
a fictitious waypoint" — true of `ZORVU`, false of the implication, and the next reader
picking a fixture for that constant now sees which half to pick from.

➕ **Mutation-tested, nine mutations, each reds exactly the named guard and nothing else:**
researched hold contradicting the dossier (`HAXEK` 113→114); charted overlap contradicting
`CHART_HOLDS` (`OYOSO` left→right, which reds the dossier check *and* the `CHART_HOLDS`
check); a hold appended to the exported array in neither provenance list; one fix name
carrying two geometries; the `CHART_HOLDS` overlap emptied; an invented fixture renamed
onto a real waypoint (`BRIXO`→`TRACY`); a real-looking name in the researched list with no
dossier row; an out-of-range course; and the dossier scan parsing nothing at all, which
reds rather than passing vacuously.

⚠️ Every seed's heading and answer survived unchanged (787/787 green, including
`keeps every existing seed on its original heading and answer`): growing the pool changes
which *index* `pick` lands on but consumes the same number of `rng()` calls, and the drill
heading comes from a separately-seeded stream.

### Task 5: Widen `VOR_NAMES` and `NDB_NAMES` with real Bay Area stations

⚠️ **Task 1 finding — `Manteca` is decommissioned and already shipped.** `VOR_NAMES` carries
`Manteca` today; ECA has no record in CIFP 2608 and was decommissioned 2018-03-29 under
VOR MON (`docs/bay-area-holds.md`). Pre-existing, not introduced here, and harmless for
entry training — but keep or drop it *deliberately* and say so in the comment.

⚠️ **Task 1 finding — there is no `Stockton` VOR.** The plan's candidate list names
"Stockton (SCK)"; no such VHF navaid exists in CIFP 2608 (only `ISCK`, the KSCK localizer).
The station that served Stockton *was* Manteca. Do not add it.

⚠️ **Task 1 finding — no NDBs remain in the region**, so the Task 5 `NDB_NAMES` decision has
only two real options: keep the invented names (recommended) or use historical ones.


**Files:**
- Modify: `src/engine/clearance.ts`
- Modify: `src/engine/clearance.test.ts`

- [x] add the verified navaids from Task 1 to `VOR_NAMES` — all **eleven** current
      stations in the dossier's navaid table, not just the seven it recommends: the
      remaining four (`San Francisco`, `San Jose`, `Concord`, `El Nido`) are equally
      verified and equally local, and none of them carries geometry, so a bigger pool is
      pure seed variety at no cost. Pool 5 → 16
- [x] decide and document what to do about `NDB_NAMES` — **kept invented**, stated in the
      `clearance.ts` comment with the reason the two decommissioned-station decisions go
      opposite ways: *adopting* a defunct station is a new claim where an obviously
      invented name already works, which is not the same act as *keeping* one that
      predates the rule (Manteca, below)
- [x] write a test that every name renders sanely in generated clearance text across a
      seed sweep (no empty, no undefined, no doubled whitespace) — `speaks every station
      name cleanly`, over a 1000-seed sweep, plus `draws every station in the pool`
- [x] confirm the ad-hoc branch still generates randomized radials/turns — `assigns its
      own course, turns and legs rather than a published pattern`: no ad-hoc text says
      "as published", and **no station may appear with only one inbound course**, which is
      the assertion with teeth (a real name that accumulated a fixed geometry would be the
      app teaching a hold it never researched)
- [x] run `npm test` and `npm run typecheck` — must pass before task 6 (793 tests, clean)

⚠️ **Manteca is KEPT, knowingly.** The dossier left this to the implementer; the reasons
are in the `clearance.ts` comment — a hold at a station that closed in 2018 still teaches
the correct entry, and dropping it would be the only deletion in an otherwise additive
change. It stays available to the pilot as a one-line removal. `Stockton` was **not**
added (there is no such VOR).

➕ **`VOR_NAMES` and `NDB_NAMES` are now exported, and `VOR_NAMES` has a provenance guard**
of the same shape as Task 4's `RESEARCHED_HOLDS` ↔ dossier check, one list over. A station
name asserts less than a hold fixture does — it carries no geometry — but it does assert
*there is something to tune*, so every name must have exactly one row in the dossier's
navaid table saying the station is in CIFP 2608. Two rows fail that on purpose: `Manteca`,
which must say `DECOMMISSIONED` and is exempted by name, and `"Stockton"`, which the plan
proposed and which is not a VOR at all. The exemption is checked **both ways** — a name it
excuses that the pool no longer draws reds too, so it cannot outlive the station. The NDB
list is checked against the same table from the other side: none of its names may be a real
station. The export is not cosmetic either: the seed sweep asserts the drawn set **equals**
the pool, and a sweep that cannot see the pool certifies nothing about the names it happened
to miss (the `TIERS`/`OVERLAY_ALPHA` exhaustiveness hole).

➕ **Mutation-tested, eight mutations, each reds exactly the named guard:** `Stockton` added
(dossier row says no such VOR); a real station typo'd (`Woodside`→`Woodsyde`, no row);
`Manteca` dropped while the exemption still names it; the dossier's `Manteca` row rewritten
as current; a real station adopted into `NDB_NAMES`; the ad-hoc radial frozen to a constant,
which is a station gaining fixed geometry; a doubled space injected into the spoken name;
and the sweep shrunk to 20 seeds, which reds `draws every station in the pool` — i.e. the
coverage claim is real and not an artifact of the pool being small.

### Task 6: Pin the miss/Anki history-safety property

**Files:**
- Modify: `src/app/anki-export.test.ts`

- [ ] write a test that a recorded entry miss whose snapshot `holdSpec` names a hold **not
      present in the current `PUBLISHED_HOLDS`** still exports the correct card, rebuilt
      from the snapshot's own `heading`/`holdSpec`
- [ ] make the stale snapshot differ from any live fixture in geometry, not just in name —
      `CLAUDE.md` records the case where copying live values into all but one field let
      five of six rebuilds revert with the suite green
- [ ] **mutation-test**: break the rebuild to read from the seed instead, confirm the
      named test reds, revert
- [ ] run `npm test` and `npm run typecheck` — must pass before task 7

### Task 7: Re-verify wind-lab isolation against the newly-real lists

**Files:**
- Modify: `src/modules/wind-lab.test.ts` (only if its guards need widening)

- [ ] confirm wind-lab's existing guards still pass: `FIXES` names remain invented,
      disjoint from `CHART_HOLDS` and from the now-real clearance lists
- [ ] confirm the wind-lab scenario line still carries its "fictitious" labelling — it
      keeps invented data, so unlike the entry drill it *should* keep saying so
- [ ] widen the cross-list disjointness guard if it hand-lists the clearance lists rather
      than importing them
- [ ] run `npm test` and `npm run typecheck` — must pass before task 8

### Task 8: Verify acceptance criteria

- [ ] verify the entry drill renders real Bay Area fixes across a wide seed sweep
- [ ] verify no screen names a procedure, amendment or chart cycle for a drill hold
- [ ] verify no fixture contradicts `CHART_HOLDS` geometry
- [ ] verify wind-lab data and labelling are untouched
- [ ] run the full suite: `npm test`
- [ ] run `npm run typecheck`
- [ ] confirm every new guard was mutation-tested (Tasks 2, 3, 6)

### Task 9: [Final] Update documentation

- [ ] update `CLAUDE.md` — the Conventions bullet on practice fixtures states the now-
      superseded "must be disjoint from real waypoints" rule for the clearance lists;
      replace it with the geometry-consistency invariant, say that those pools are now
      **mixed** invented + real, and keep the old rule intact for wind-lab
- [ ] update `README.md` Source policy — "Entry-drill, clearance-copy and wind-lab
      scenarios are seeded practice fixtures: the fix names are invented" is now only
      partly true: entry-drill and clearance-copy draw from a mixed pool, wind-lab is
      unchanged. Reword rather than delete, and check the entry-drill bullet's plate
      wording while there
- [ ] add a `docs/content-audit.md` entry recording this as a **deliberate reversal** with
      its rationale, per the ledger's amend-in-place convention — including why banning
      real names was the wrong invariant and what replaced it
- [ ] verify `README.md`'s module → exam-phase table still matches `PHASE_PREP`
      (asserted by `dashboard.test.ts`)
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion

*Items requiring manual intervention or judgment — no checkboxes, informational only*

**Manual verification:**

- Run `npm run dev` and read the entry drill's hold line on a phone-width viewport. Real
  fix names are longer than `ZORVU`; check nothing wraps badly or overflows at 320 px.
- Sanity-check a handful of generated clearances aloud. Real VOR names change the rhythm
  of the radio phrasing ("hold northeast of Woodside") and some combinations may read
  awkwardly in a way no test can see.
- Confirm the hedge decision from Task 3 reads correctly in context rather than as clutter.

**Judgment calls left to the pilot:**

- Whether any researched hold is *too* stale to be useful. Scope explicitly accepts stale
  geometry, but a hold at a decommissioned navaid may be worth dropping on training value
  alone.
- Whether to eventually extend this to the wind lab. Deliberately out of scope here; it
  would need its scenario line reworked the same way `chartNote` was.

**Not applicable:** no deployment config, external systems or consuming projects are
affected. The deploy path (`mise run deploy`) is unchanged.
