# Fix the parallel entry rejoin turn direction

## Overview

The app draws and describes the parallel holding entry's rejoin turn as a rotation **in the same
direction as the pattern's turns**. It must be the **opposite** rotational direction — the turn goes
**toward the holding side, crossing back over the holding course**.

As shipped, the entry track is displaced roughly **two turn diameters onto the nonholding side**
instead of ending on the holding side: the drawn path is mirrored about the holding course. For the
golden case below the drawn rollout is misplaced by **1.72 NM** (−1.05 → +0.67); the sim's
whole-track error at 90 kt is ~1.9 NM, scaling to ~3.2 NM at 150 kt. The nonholding side *is*
protected airspace, but it is the narrower of the two, and that allowance is sized for the parallel
entry's one-minute outbound leg plus wind drift — not for an extra ~2 turn-radii excursion beyond it.

> Exact FAA template widths are **unverified** by this project and are deliberately not quoted here;
> `docs/plans/20260802-protected-airspace-terminology.md` verifies them. The safety argument does not
> depend on the numbers, only on the nonholding allowance being the narrower one.

This is a **safety-of-flight training defect**. It is a drill tool: a pilot who rehearses this here
will fly it that way. ACS elements IR.III.B.K1 / R4 / S1 cover exactly this.

**Exactly one thing is wrong: the rotational direction of the rejoin turn.** Sector classification,
the outbound leg's side, the racetrack geometry and every AIM citation are correct and must be
preserved — see "Do not 'fix' these" below.

## ⚠️ EVIDENCE DOSSIER — READ BEFORE TOUCHING ANY TURN DIRECTION

**This section exists because a fresh session reading AIM 5-3-8 j3(a) will re-derive the WRONG
answer. That is exactly how this defect was introduced** (see `docs/content-audit.md`, entry "the
parallel entry's reintercept turn was inverted app-wide", which flipped this field the wrong way on
2026-07-22). Do not re-derive this from the AIM sentence. Do not "correct" it back.

### The AIM sentence is genuinely ambiguous — the FIGURE settles it

AIM 5-3-8 j3(a), verbatim:

> "When approaching the holding fix from anywhere in sector (a), the parallel entry procedure would
> be to turn to a heading to parallel the holding course outbound on the nonholding side for one
> minute, **turn in the direction of the holding pattern through more than 180 degrees**, and return
> to the holding fix or intercept the holding course inbound."

"In the direction of the holding pattern" is **spatial** (toward the racetrack), **not rotational**.

### Why the counter-argument fails

The strongest objection: the *identical phrase* appears in j3(b), the teardrop procedure, where it
unambiguously means the pattern's **rotational** direction (a standard teardrop rejoins with a right
turn). One phrase, one meaning ⇒ Reading A.

That inference is void, and **FIG 5-3-4 disproves it directly**: in the *same* standard-pattern
figure, the teardrop rejoin is drawn **clockwise** (with the pattern) and the parallel rejoin
**counter-clockwise** (against it). One figure, two rejoins, opposite senses, same words. The phrase
is not doing the same work in the two sub-paragraphs — in the teardrop geometry "toward the
racetrack" and "the pattern's rotational sense" happen to be the *same turn*, so j3(b) is evidence
for nothing.

**ICAO Doc 8168 says in words what the AIM says only in a picture** (Vol I, Part II, Section 6,
Chapter 2, Sixth Edition 2018):

- 2.2.4 Sector 1 (parallel): "the aircraft is **turned toward the holding side** to intercept the
  inbound track or to return directly to the fix"
- 2.2.5 Sector 2 (offset/teardrop): "the aircraft is **turned right** to intercept the inbound
  holding track"

Spatially explicit for parallel, rotationally explicit for teardrop, deliberately different wording
in the same document for the two maneuvers.

### The ">180°" argument is invalid and must never be used again

`docs/research-claude.md:93` argues that only the pattern-direction turn exceeds 180°. **That
arithmetic is wrong**: it measures the bearing to the fix at the *start* of the turn and never
updates it for the aircraft's motion *during* the turn. Computed correctly across the whole parallel
sector: right turn 212.6°–222.1°, left turn 189.3°–215.3° — **both exceed 180°**, and they are
exactly equal (215.3°) at zero offset by symmetry. The clause does not discriminate between the two
readings. Reasoning from it is the root cause of this defect.

### How the evidence was obtained (three FAA figures, rendered and visually inspected)

| Source | Result |
|---|---|
| AIM FIG 5-3-4, 900 dpi from `faraim.org/faa/aim/chapter-5/section-5-3-8.pdf` (p.5, dated 1/22/26) + the official `faa.gov` PNG | Rejoin counter-clockwise, crosses the course, rolls out on inbound − 45° aimed at the fix, sweep ~215–225° |
| FAA AIP `FIG ENR 1.5-3`, `faa.gov/.../aip_html/images/AIP_ENR_1.5_fig107.png` (3162×2238) | Same. Crossing visible at 700% with dashes on both sides of the course line. "Nothing whatsoever is drawn below the course line except the straight parallel leg itself" |
| IFH FAA-H-8083-15B Fig 10-6, 1000 dpi (p.303 of `faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf`) | Same, plus the decisive control: teardrop clockwise, parallel counter-clockwise, in one figure |
| IPH FAA-H-8083-16B | Contains **no** entry-path figure. Cannot discriminate. Do not cite it either way |

An adversarial agent assigned to argue the shipped reading concluded: "My assigned position is
untenable. The answer is B." Judge panel: 2–0 for the corrected reading, none dissenting.

### The rule to implement

Let `C` = inbound holding course, `O` = `C + 180°`.

| Pattern | Fix-crossing turn | Rejoin turn | Rejoin rollout heading | Turn at the fix |
|---|---|---|---|---|
| **Standard** (right turns) | **left** onto `O` | **left**, >180° (~225°) | `C − 45°` | right |
| **Nonstandard** (left turns) | **right** onto `O` | **right**, >180° (~225°) | `C + 45°` | left |

**Invariant:** the first two turns of a parallel entry oppose the pattern's turn direction; only the
final turn at the fix follows it. The rejoin arc's centre lies on the **holding** side.

The fix-crossing turn direction falls out of the sector definition automatically and needs no
special-casing. Only the **rejoin** turn must be explicitly forced opposite the pattern.

The `~225°` / 45° intercept is **convention, not AIM text** (AIM requires only "more than 180
degrees"). 45° is chosen here because it matches how the FAA figures draw the rollout. It is
recorded once, in the engine, so the map and the sim cannot drift from it.

## Do not "fix" these — they are correct

1. **The parallel outbound leg is on the nonholding side.** Defining feature of the entry, explicit
   in AIM 5-3-8 j3(a).
2. **Sector classification.** `determineEntry`, `sectorArcs`, the ±5° boundary alternates and the
   70°-line geometry are all correct and **must not change**. Heading 251° / inbound 140° / left
   turns → parallel, unambiguously (41° from the direct boundary, 69° from the teardrop boundary).
3. **The racetrack geometry.** For inbound 140° with left turns the holding side is **northeast**
   (140 − 90 = 050). `racetrack()` in `src/ui/mapview.ts` is right.
4. **Direct and teardrop rejoin WITH the pattern.** Only `parallel` inverts.
5. **All AIM citations.** `AIM 5-3-8 j3`, `FIG 5-3-4`, `AIM 5-3-8 j8(d)` are all accurate.
6. **`towardHoldingSide` in `src/engine/entry.ts:121`** (`pattern === 'right' ? -30 : 30`) is the
   **teardrop's** 30° offset per AIM 5-3-8 j3(b) — a different quantity from the parallel rejoin's
   intercept angle. **It stays 30.** A grep for `30` in the engine finds it; do not sweep it into the
   45° change.
7. **`src/modules/wind-lab.ts:339`** ("non-holding (unprotected) side of the fix"). The wording is
   arguably wrong — the nonholding side *is* protected — but it was a deliberate fix recorded in
   `docs/content-audit.md:433-442` and is pinned by `src/modules/wind-lab.test.ts:376`. Reversing a
   ledger decision without arguing against it is the same mistake this plan exists to correct. It is
   handled in `docs/plans/20260802-protected-airspace-terminology.md`, **not here.**

## Context (from discovery)

**Files involved**

- `src/engine/entry.ts:140-153` — `entryGuidance` `'parallel'` case returns `turnToInbound: pattern`.
  The 6-line comment above it argues the wrong reading and must go. **This is the origin.**
- `src/engine/sim.ts:36` (`PARALLEL_INTERCEPT_DEG = 30`), `:145-152` (`reinterceptTurnSign = pattern`
  and the rollout sign), `:10-16` (header comment states the wrong rule)
- `src/ui/mapview.ts:167-179` — `entryPathD` parallel branch: `turnCenter(legEnd, outboundHeading, s)`
  with `s` = pattern sign puts the arc centre on the **nonholding** side; rollout hardcodes `c + 30*s`;
  sweep flag from `s`
- `src/modules/entry-drill.ts:308-311` — renders `g.turnToInbound` verbatim, so it self-corrects once
  the engine is fixed. Ships the string "then left turn through more than 180°" today
- `src/content/lessons.ts:81` — "The parallel reintercept catches people out: it turns the same way
  the pattern does (right in a standard hold), away from the course at first, because that is the
  only direction that makes the turn exceed 180°."
- `src/content/oral.ts:159` — "Note the parallel reintercept turns the same way the pattern does — a
  right-turn hold reintercepts right — because only that direction is the 'more than 180°' turn the
  AIM specifies."
- `src/content/anki-deck.ts:46` — "The reintercept turn follows the pattern (right in a standard
  hold) — only that direction exceeds 180°."
- `src/engine/entry.test.ts:223-255` — three tests actively **pin the defect**, including
  `'every entry reintercepts in the pattern direction (AIM 5-3-8 j3)'`
- `src/engine/sim.test.ts:152-210` — `'parallel: outbound turn opposes the pattern, reintercept turn
  follows it'` and `'parallel reintercept sweeps more than 180°'` pin it too
- `src/ui/mapview.test.ts:245-263` — sweep-flag assertions pin it
- `docs/research-claude.md:92-93` — the corrected-in-place note whose "correction" is the defect;
  also `:41` (protected airspace) and `:98` (common errors) need work
- `docs/content-audit.md` — ledger entry recording the wrong-way flip

**Related patterns**

- Engine is the oracle (CLAUDE.md): all modules consume `src/engine/`; answers are never hand-keyed.
  The defect spread because the same geometry was hand-written in three places (`entry.ts`, `sim.ts`,
  `mapview.ts`) instead of derived once.
- Assert-the-artifact-as-text: `styles.test.ts` imports `./styles.css?raw`, `dashboard.test.ts`
  imports `README.md?raw`. Task 7 uses the same pattern to guard the content prose.
- Audit ledger: every content fix is recorded in `docs/content-audit.md` with its regression test.

**Dependencies:** none. No new packages (CLAUDE.md forbids them).

**Known model limitation (decided: document, do not fix).** `sim.ts` starts the aircraft
**established on the inbound course at the fix**, so its turn onto outbound is a full 180° leaving
the aircraft `2R` (~0.95 NM) off course. From there the corrected rejoin is *tangent* to the holding
course rather than crossing it, and a converging rollout would be ~150°, not >180°. The real
maneuver does not do this because the aircraft arrives at an angle from sector (a) — at heading 250
with inbound 360 the fix-crossing turn is only 70°, leaving ~0.31 NM offset, and the rejoin then
genuinely crosses. `flyCircuit` is **only ever called with `entry: 'direct'`**
(`src/modules/wind-lab.ts:168`), so the parallel branch is unreachable in the shipping app. Fix its
direction so it stops encoding the wrong rule; document the limitation; do not add an arrival
heading to `SimDecisions` in this plan.

## Development Approach

- **Testing approach: TDD** — per CLAUDE.md, tests first, always. Several existing tests *assert the
  defect*; correcting them **is** the red step. Write the corrected assertion, watch it fail against
  the current implementation, then implement.
- `npm test` **and** `npm run typecheck` must both pass before a task is done — no exceptions.
  Vitest strips types with esbuild and never type-checks; `strict` + `noUncheckedIndexedAccess` +
  `noUnused*` are easy to trip in test files the suite happily runs.
- Complete each task fully before moving to the next; make small, focused changes.
- **CRITICAL: every task MUST include new/updated tests.**
- **CRITICAL: all tests must pass before starting the next task.**
- **CRITICAL: update this plan file when scope changes during implementation.**
- Every user-visible aviation fact keeps its `source` field citing the FAA primary source.

## Testing Strategy

- **unit tests**: Vitest. Engine modules get golden + property tests; UI modules get jsdom tests for
  logic, not pixels.
- **e2e tests**: none — no e2e framework in this project.
- test command: `npm test`; type check: `npm run typecheck`.

### The four assertions every parallel entry must satisfy

- **A1** — the rejoin turn's rotational sense equals the fix-crossing turn's sense, and both oppose
  the pattern's turn direction.
- **A2** — the rejoin turn must never carry the aircraft further onto the nonholding side than the
  turn onto outbound already did. *This assertion alone catches the bug.*
  **Measure it through rejoin completion, not over the whole track.** In `sim.ts`'s model the
  straight intercept leg flown afterwards diverges further west (the "tangent, not crossing"
  limitation below), so a whole-track bound of `2R` is **arithmetically false after the fix** and
  would push a session into reverting the fix to make it pass. Measured values, standard hold,
  no wind: rejoin-turn minimum **−0.9549**, rollout point **−0.1390**, whole-track minimum
  **−1.3022** after the fix vs **−1.9099** before.
- **A3** — total rejoin turn > 180°.
- **A4** — the one-minute outbound leg lies on the nonholding side (already correct — protect it
  with a regression test so the fix does not overshoot into breaking it).

### Golden case (hand-derived; matches the reported screenshot)

Clearance: "Hold northwest of the Delta NDB on the one four zero bearing to the station, left turns."
Aircraft heading 251°. Inbound course 140°, outbound 320°, left turns, holding side **northeast**,
1-minute legs (1.5 NM at 90 kt).

⚠️ The two modules use **different turn radii** and this is not a discrepancy to chase:
`src/ui/mapview.ts:53` uses `TURN_RADIUS_NM = 0.48` (the SVG figures below are computed with it),
while `src/engine/sim.ts` integrates the true standard-rate radius **0.4775**. Either value lands
inside the ±0.5 SVG-unit tolerance below.

| Quantity | Expected after the fix | Ships today (wrong) |
|---|---|---|
| Entry | parallel | parallel ✅ unchanged |
| `turnToInbound` | `right` | `left` |
| Rejoin rollout heading | **185°** (= 140 + 45) | 110° |
| Rejoin arc centre, perpendicular offset from course | **+0.33 NM (holding side, NE)** | −0.63 NM (nonholding) |
| Rollout point, perpendicular offset | **+0.67 NM (holding side)** | −1.05 NM (nonholding) |
| Rejoin sweep | 225° (320 → 185 the right way round) | 210° |
| SVG rollout point (scale 28.57, centre 100) | ≈ `(93.3, 62.3)` | `(53.97, 91.63)` |
| SVG arc sweep flag | `1` | `0` |

The 185° rollout is an independent cross-check: it is the figure the bug report derived separately.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix; blockers with ⚠️ prefix
- update this plan if implementation deviates from scope

## Solution Overview

Invert one field in the engine, derive everything else from it, and delete the three hand-written
copies of the geometry that let the defect spread.

- `entryGuidance('parallel')` returns the **opposed** turn direction.
- `PARALLEL_INTERCEPT_DEG` is exported from the engine; `mapview.ts` and `sim.ts` import it instead
  of hardcoding `30 * s` and their own private copy.
- The content prose is rewritten; the docs that caused the defect are corrected in place.
- A cross-module invariant test makes a future single-file flip impossible.

## Technical Details

`PARALLEL_INTERCEPT_DEG = 45` is exported from `src/engine/entry.ts` (the oracle), replacing the
private `PARALLEL_INTERCEPT_DEG = 30` in `sim.ts` and the inline `30 * s` in `mapview.ts`. That is
the whole of the new API surface — **no new field on `EntryGuidance`.** A `interceptHeading` field
was considered and dropped: exporting the constant already single-sources the convention, and the
field would have had no reader unless the drill also started displaying the rollout heading, which
is a feature, not this fix.

Rejoin sign, everywhere: `rejoin = pattern === 'right' ? -1 : +1` (i.e. `-patternSign`).
Rollout heading: `normalizeDeg(C + PARALLEL_INTERCEPT_DEG * rejoinSign)`.

## What Goes Where

- **Implementation Steps** (`[ ]`): code, tests and docs in this repo.
- **Post-Completion** (no checkboxes): manual verification in a browser and external actions.

## Implementation Steps

### Task 1: Independently re-verify the figure evidence before changing anything

This is a safety-critical inversion of a previously "corrected" value. Confirm the dossier first —
if this task fails to confirm, **STOP and report; do not proceed to Task 2.**

**Files:**
- Create: `docs/parallel-entry-evidence.md`

- [x] fetch AIM FIG 5-3-4. `faa.gov` returns HTTP 403 to plain fetches — use
      `curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"`.
      **Trace the crossing on `https://faraim.org/faa/aim/chapter-5/section-5-3-8.pdf`** (vector,
      render at 400–900 dpi) or the AIP PNG in the later checkbox. The AIM HTML's inline figure
      (`.../aim_html/images/aim0503_At_Anchor2.png`, alt "Holding Pattern Entry Procedures") is only
      **312×221 px** — far too coarse to resolve which side of the course line the arc is on. Use it
      as a sanity check, never as the evidence
- [x] render the figure to PNG (`pdftoppm -png -r 400 -f 5 -l 5`, or
      `magick -density 400 'file.pdf[4]' out.png`, or `gs -sDEVICE=png16m -r400`) and **view it with
      the Read tool** — Read renders images visually. Do NOT infer the figure's content from prose
- [x] orient before tracing: find the racetrack, confirm which side of the course it lies on (= the
      holding side), then trace the parallel dashed track from the fix
- [x] record: does the parallel rejoin arc **cross the holding course onto the holding side**
      (expected: yes), and is its rotational sense **opposite** the pattern's (expected: yes,
      counter-clockwise in the STANDARD PATTERN figure)? — **yes to both, confirmed**
- [x] confirm the discriminator in the same figure: the **teardrop** rejoin is clockwise (with the
      pattern) while the **parallel** rejoin is counter-clockwise (against it) — **confirmed via the
      two rejoin arrowheads: teardrop points due south at the outermost point of its turn
      (clockwise), parallel rolls out heading down-left above the course line (counter-clockwise)**
- [x] repeat with a second independent FAA source — AIP `FIG ENR 1.5-3` at
      `https://www.faa.gov/air_traffic/publications/atpubs/aip_html/images/AIP_ENR_1.5_fig107.png`
      (3162×2238, crop and zoom to the crossing point)
- [x] write `docs/parallel-entry-evidence.md` recording, for each source: URL, byte size, page,
      render command, what was seen, and the verdict. This is the artifact future sessions read
      instead of re-deriving from the AIM sentence
- [x] ⚠️ if either figure shows the rejoin bulging further onto the nonholding side, STOP — the
      dossier is wrong and the shipped behaviour may be right — **not triggered: neither figure
      draws anything below the course line except the straight parallel leg and the sector-(b)
      arrival line. Proceeding to Task 2**
- [x] ⚠️ if the artefacts cannot be **obtained or rendered** (no network, a 403, no renderer), that
      is **not** disconfirmation. Record the failure in `docs/parallel-entry-evidence.md`, fall back
      to ICAO Doc 8168 2.2.4/2.2.5 as the standing textual evidence, and proceed to Task 2.
      Environment note as of 2026-08-02: `faa.gov` returns 200 with a browser UA, `magick` and `gs`
      are present, `pdftoppm` is **not** — **fallback not needed; both artefacts were obtained and
      rendered. Additional note: `magick -density 900` aborts (out of memory) on this page, so the
      900 dpi render was done with `gs -sDEVICE=png16m -r900`**

### Task 2: Invert the parallel rejoin direction in the engine and centralise the intercept angle

**Files:**
- Modify: `src/engine/entry.ts`
- Modify: `src/engine/entry.test.ts`

- [ ] in `src/engine/entry.test.ts`, replace the three tests at lines 223–255 that pin the defect:
      `'parallel: outbound course on the nonholding side, reintercept WITH the pattern'` →
      expects `turnToInbound` `'left'` for a standard hold; `'nonstandard mirrors…'` → expects
      `'right'` for a left-turn hold; `'every entry reintercepts in the pattern direction'` →
      becomes `'direct and teardrop reintercept with the pattern, parallel against it'`, looping
      over `[0, 45, 90, 180, 270, 315]` × standard/nonstandard × `ENTRIES`
- [ ] replace the misleading comment block above those tests with the dossier summary: spatial not
      rotational; FIG 5-3-4 draws teardrop clockwise and parallel counter-clockwise; ICAO 8168
      2.2.4/2.2.5; and an explicit warning that ">180°" does not discriminate
- [ ] add the **A3** assertion here, where it is a genuine property (the map's large-arc flag is
      hardcoded to `1` at `src/ui/mapview.ts:178`, so asserting it there passes before *and* after
      the fix). For all courses × both patterns, the rejoin sweep must exceed 180°:
      `normalizeDeg((rolloutHeading - g.outboundHeading) * rejoinSign) > 180`, where
      `rolloutHeading = normalizeDeg(c + PARALLEL_INTERCEPT_DEG * rejoinSign)`. It is 225 by
      construction, and would have been exactly 180 for a sign flip with no intercept angle
- [ ] add a test that `PARALLEL_INTERCEPT_DEG === 45`
- [ ] run tests — confirm the new assertions FAIL against the current implementation (this is the
      red step; a passing test here means it is asserting the old behaviour)
- [ ] in `src/engine/entry.ts`, export `PARALLEL_INTERCEPT_DEG = 45` and change the `'parallel'` case
      to return the opposed `turnToInbound`. Do **not** add a field to `EntryGuidance` — see
      Technical Details. Leave `towardHoldingSide` at `±30`; it is the teardrop's offset
- [ ] replace the `'parallel'` case's justification comment — it currently argues the wrong reading
      and is the origin of the defect. Cite FIG 5-3-4 and ICAO 8168 2.2.4, and state that ">180°"
      must not be reasoned from
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 3

### Task 3: Redraw the parallel rejoin arc on the holding side in the map view

**Files:**
- Modify: `src/ui/mapview.ts`
- Modify: `src/ui/mapview.test.ts`

- [ ] in `src/ui/mapview.test.ts`, flip the sweep-flag assertions in
      `'parallel: leg on the non-holding side, >180° reintercept turn with the pattern'` (`d[8]`
      `1` → `0`) and `'parallel mirrors for a nonstandard hold'` (`d[8]` `0` → `1`); rename both to
      say the rejoin opposes the pattern
- [ ] add the A2 assertion on the **rollout endpoint** (`d[9]`, `d[10]`) — not the arc centre, which
      is not readable from an SVG `d` string (arcs are endpoint-parameterized). It must lie on the
      **holding** side: for the default `hold()` (inbound 0, right turns) that is east, so
      `d[9] > 100`; add the nonstandard mirror (`d[9] < 100`)
- [ ] **keep** the existing A4 assertions — `mapview.test.ts:251` (`d[2] < 100`) and `:259`
      (`d[2] > 100`) already pin the outbound leg to the nonholding side. Verify they still pass, so
      this change cannot overshoot into breaking the part that was right
- [ ] add the golden case from this plan: inbound 140 / left turns / 1-min legs → sweep flag `1`,
      large-arc `1`, rollout ≈ `(93.3, 62.3)` within 0.5 units
- [ ] run tests — confirm they FAIL first
- [ ] in `src/ui/mapview.ts`, in the `entryPathD` parallel branch introduce the rejoin sign
      `const rs = (s === 1 ? -1 : 1) as 1 | -1` and use it for `turnCenter`, for the rollout heading
      (`normalizeDeg(c + PARALLEL_INTERCEPT_DEG * rs)`, importing the constant from `../engine/entry`
      — do not hardcode 45), and for the sweep flag
- [ ] update the module header comment (lines 1–7), which currently describes the parallel entry as
      "a >180° pattern-direction reintercept"
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 4

### Task 4: Correct the sim's rejoin direction and document its model limitation

**Files:**
- Modify: `src/engine/sim.ts`
- Modify: `src/engine/sim.test.ts`

- [ ] in `src/engine/sim.test.ts`, rewrite `'parallel: outbound turn opposes the pattern, reintercept
      turn follows it'` → `'…and so does the reintercept'`. Timeline for `RIGHT_NORTH`, no wind:
      180° onto outbound (60 s) + 60 s leg + 225° rejoin at 3°/s (75 s) = **195 s**, sampled at 1 s,
      so `track.slice(0, 196)` is everything through rejoin completion. Assert:
      ```ts
      const R = 0.4775
      const throughRejoin = r.track.slice(0, 196)
      // A2: the rejoin turn stays inside the displacement the outbound turn already made
      expect(Math.min(...throughRejoin.map((p) => p.e))).toBeGreaterThan(-2 * R - 1e-3) // ≈ -0.9549
      expect(throughRejoin.at(-1)!.e).toBeGreaterThan(-0.2)                             // ≈ -0.1390
      // whole track: -1.3022 after the fix, -1.9099 before it
      expect(Math.min(...r.track.map((p) => p.e))).toBeGreaterThan(-3 * R)
      ```
      The last line is the exact negation of the current `sim.test.ts:181`
      (`toBeLessThan(-3 * 0.4775)`), so the red step is unambiguous
- [ ] ⚠️ do **not** assert the `-2R` bound over the whole track — it is false after the fix
      (−1.3022). A red test here is the most likely way a memoryless session gets argued back into
      the wrong turn direction, because "make the test pass" outranks "read the dossier"
- [ ] replace `'parallel reintercept sweeps more than 180°'` — its westward-excursion proxy measures
      the defect, not the sweep, and a faithful >180° sweep is not reproducible under this model's
      initial condition. A3 is asserted in the engine instead (Task 2)
- [ ] update `'left-turn parallel mirrors: flies the east (non-holding) side'`: `sim.test.ts:207`
      currently asserts `Math.max(...e) > 3 * 0.4775`; after the fix the max is 1.3022, so it becomes
      `toBeLessThan(3 * 0.4775)`
- [ ] run tests — confirm they FAIL first
- [ ] in `src/engine/sim.ts`, set `reinterceptTurnSign` to oppose the pattern for parallel (it may
      simply reuse `outboundTurnSign`), and flip the rollout sign to
      `c - PARALLEL_INTERCEPT_DEG * pattern`
- [ ] delete the private `PARALLEL_INTERCEPT_DEG = 30` and import the exported 45 from `./entry`
- [ ] rewrite the header comment (lines 10–16) and the inline comments at lines 140–152, which state
      the wrong rule
- [ ] add a header note recording the model limitation verbatim from this plan's Context section:
      the circuit starts established on the inbound course, so the outbound leg sits `2R` off
      instead of ~0.3R, the rejoin is tangent rather than crossing, and the inbound leg therefore
      does not converge. Note that `flyCircuit` is only called with `entry: 'direct'`
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 5

### Task 5: Name the fix-crossing turn and the timing reference in the drill feedback

Bug report §12.1 and §12.2. Naming the first turn makes the "two turns opposite the pattern"
structure visible to the learner, which is the whole point of the corrected geometry.

**Files:**
- Modify: `src/modules/entry-drill.ts`
- Modify: `src/modules/entry-drill.test.ts`

- [ ] confirm the existing feedback string at `src/modules/entry-drill.ts:308-311` now renders the
      corrected direction automatically (it reads `g.turnToInbound`) — add a test pinning the
      rendered text for the golden case (inbound 140 / left / heading 251 → "right turn")
- [ ] extend the "Fly it" line for parallel entries to name the fix-crossing turn explicitly
      (e.g. "cross the fix, turn right onto 320° on the nonholding side…"), deriving the direction
      from the engine, not from a hardcoded string
- [ ] state the outbound timing reference using the AIM's **verbatim** sentence, cited to
      `AIM 5-3-8 j4(b)`: "Outbound leg timing begins over/abeam the fix, whichever occurs later. If
      the abeam position cannot be determined, start timing when turn to outbound is completed."
      ⚠️ The AIM makes **no per-entry distinction** — the familiar "parallel and teardrop time from
      the fix, direct times from abeam" split is a *derivation* from that sentence. Present it as an
      explanation, never as the cited rule; per CLAUDE.md an unverifiable claim is labelled, not
      asserted. Presenting a derivation as citation is exactly the failure this plan corrects
- [ ] write tests for the parallel, teardrop and direct feedback strings
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 6

### Task 6: Rewrite the three content modules that teach the wrong rule in prose

These are the highest-severity strings in the repo: they state the defect explicitly and in words.

**Files:**
- Modify: `src/content/lessons.ts`
- Modify: `src/content/oral.ts`
- Modify: `src/content/anki-deck.ts`
- Modify: `src/content/lessons.test.ts`
- Modify: `src/content/oral.test.ts`
- Modify: `src/content/anki-deck.test.ts`

- [ ] ⚠️ **Both `lessons.ts:81` and `oral.ts:159` quote the AIM's own clause** ("then turn in the
      direction of the holding pattern through more than 180°") and *then* gloss it wrongly. The
      verbatim AIM clause is **retained** — only the gloss that follows it changes. Do not delete the
      primary-source wording along with the error; the app's citation convention rests on it
- [ ] `src/content/lessons.ts:81` — delete "it turns the same way the pattern does (right in a
      standard hold), away from the course at first, because that is the only direction that makes
      the turn exceed 180°". Replace with the corrected rule and *why it is counter-intuitive*: the
      parallel entry is the one entry with two turns against the pattern; only the final turn at the
      fix follows it
- [ ] `src/content/oral.ts:159` — same correction; this is a DPE-facing answer
- [ ] `src/content/anki-deck.ts:46` — same correction. Note this card ships to the user's Anki deck,
      so a wrong card is drilled to memory
- [ ] check `src/content/questions.ts` for any written-test item asserting the rejoin direction and
      correct it if present
- [ ] add tests asserting each corrected string mentions the opposed turn and does **not** claim the
      rejoin follows the pattern
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 7

### Task 7: Add a cross-module invariant guard so a single-file flip cannot happen again

The defect reached five modules because three of them hand-wrote the same geometry. This test makes
the rule single-sourced in assertion as well as in code.

**Files:**
- Create: `src/parallel-entry.invariants.test.ts`

Scope is deliberately narrow: A1 is already covered by Task 2's rewritten test and the sim bound is
covered by Task 4, so only two assertions here are genuinely new.

- [ ] **the map↔engine agreement sweep** — for every course in `[0, 45, 90, 135, 180, 225, 270, 315]`
      × standard/nonstandard, render and require the drawn arc's **sweep flag** to agree with
      `entryGuidance('parallel', hold).turnToInbound`. This is the exact cross-module link whose
      absence let a single-file flip go unnoticed. Note `mapview.test.ts:212-229` does **not** cover
      it: it checks the `data-turn-to-inbound` attribute, which is copied straight from the engine
      and therefore agrees vacuously
- [ ] **the prose scan** — import the content modules as text (`'./content/lessons.ts?raw'`, with the
      extension; `vite/client`'s `*?raw` declaration is what makes it typecheck — see
      `palette.test.ts:14`) and assert each parallel item matches the corrected rule
      (`/opposite|against the pattern|toward the holding side|crosses (back )?over/i`) and does not
      match the wrong one. ⚠️ Write the negative regexes so the **AIM's own verbatim clause does not
      match** — it legitimately contains "turn in the direction of the holding pattern". Anchor on
      the gloss wording ("same way", "follows the pattern"), not the quotation. Fail with a pointer
      to `docs/parallel-entry-evidence.md`
- [ ] place the file at `src/` (not `src/engine/`) — it imports across `engine/`, `ui/` and
      `content/`, and this repo puts cross-cutting suites at the `src/` root (`styles.test.ts`,
      `contrast.test.ts`, `deploy.test.ts`)
- [ ] add a header comment explaining that this file exists because the rule was flipped the wrong
      way once, and that the AIM sentence alone cannot settle it
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 8

### Task 8: Correct the research note that caused the defect, and record the fix in the audit ledger

**Files:**
- Modify: `docs/research-claude.md`
- Modify: `docs/content-audit.md`

- [ ] `docs/research-claude.md:92-93` — the "CORRECTED 2026-07-22" block is itself the error. Replace
      it with the corrected rule, and **keep a dated note explaining that the >180° derivation is
      invalid because it never updated the fix bearing for motion during the turn** (right
      212.6°–222.1°, left 189.3°–215.3°, equal at zero offset). A silently rewritten line invites a
      third flip
- [ ] `docs/research-claude.md:98` — the "common errors" line says parallel pilots err by "turning
      toward the non-holding side instead of back through the course". That is now the *correct*
      description of the error and should be kept, but reworded so it cannot be read as endorsing
      the old rule
- [ ] `docs/content-audit.md` — add a new entry: what was wrong, the AIM/ICAO/figure evidence, the
      files touched, and the regression tests, per the ledger's existing format
- [ ] amend the existing "the parallel entry's reintercept turn was inverted app-wide" entry to
      record that its reasoning was wrong and point forward to the new entry — do not delete it; the
      failed reasoning is the useful part
- [ ] `docs/content-audit.md:115` — the coverage table's `entries` row reads "parallel >180°" and is
      marked `pass`. Update its verdict, or note that the verdict predates this correction
- [ ] add a second ledger entry for the Task 5 timing-reference change (CLAUDE.md requires every
      content fix to be recorded with its regression test; Task 8 otherwise covers only the rejoin
      direction)
- [ ] run `npm test` and `npm run typecheck`

### Task 9: Verify acceptance criteria

- [ ] `entryGuidance('parallel', {inboundCourse: 140, turnDirection: 'left'}).turnToInbound === 'right'`
- [ ] `determineEntry(251, {inboundCourse: 140, turnDirection: 'left'}).primary === 'parallel'` —
      unchanged, proving sector classification was not collaterally damaged
- [ ] rendered map for the golden case: sweep flag `1`, rollout ≈ `(93.3, 62.3)` — i.e. the rollout
      endpoint on the northeast (holding) side. Do not assert the large-arc flag as evidence of
      anything; `mapview.ts:178` hardcodes it to `1`
- [ ] all four assertions A1–A4 hold for both standard and nonstandard patterns
- [ ] no content string anywhere claims the rejoin follows the pattern
- [ ] full suite: `npm test`
- [ ] type check: `npm run typecheck`
- [ ] confirm zero runtime dependencies were added (CLAUDE.md hard rule)

### Task 10: [Final] Update documentation

- [ ] add a CLAUDE.md convention entry recording that the parallel rejoin direction is **settled**,
      that it opposes the pattern, that the evidence lives in `docs/parallel-entry-evidence.md`, and
      that the ">180°" clause must never be used to re-derive it. This repo has now reasoned itself
      into the wrong answer once; the note is what stops a third round
- [ ] update `README.md` if any module description references entry geometry (note
      `dashboard.test.ts` diffs README's route table against `PHASE_PREP` — keep the row shape)
- [ ] run `npm test` and `npm run typecheck` — README is an asserted artifact
      (`dashboard.test.ts:3` imports it `?raw`), so this task can turn the suite red *after*
      acceptance has already passed
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion

*No checkboxes — manual or external.*

**Manual verification**

- Run the app and reproduce the original report: Entry Drill → Learn mode, clearance "Hold northwest
  of the Delta NDB on the one four zero bearing to the station, left turns", heading 251°, answer
  Parallel. Confirm the drawn dashed track now leaves the fix to the northwest on the **southwest**
  (nonholding) side, then curves **right**, crosses the 140°/320° course line, and ends on the
  **northeast** side over the racetrack, pointing back at Delta.
- Check the feedback text reads "right turn through more than 180°" for this left-turn hold.
- Check the same at phone width (320 px) — the arc now overlaps the racetrack, so verify the dashed
  entry track is still visually distinguishable from the solid racetrack outline.

**Follow-up not in this plan**

- Bug report §12.4: the parallel entry is the entry most exposed to unknown drift, because the first
  outbound leg is flown before any drift has been observed. If the drill ever models wind, the
  nonholding-side excursion should be modelled with it.
- `sim.ts` could model the arrival heading (adding it to `SimDecisions`) so the parallel entry
  reproduces FIG 5-3-4 geometry with a genuine >180° sweep. Deliberately deferred — no screen uses
  that path today.
- The map still does not draw the initial fix-crossing turn at all (`entryPathD` starts every path
  at the fix), which is why the picture reads as "why am I over here?". Worth revisiting once the
  direction is correct.
