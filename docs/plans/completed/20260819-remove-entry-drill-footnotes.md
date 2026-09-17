# Remove the cited footnotes from the entry drill

**Status: complete** (2026-09-16). 802/802 tests, typecheck and build green. One finding raised and deliberately left open: `DME_SOURCE`/`dmeOutboundEnd` in `src/engine/wind.ts` have no UI consumer while README advertises the feature — logged in `docs/content-audit.md`, out of scope here.

## Overview

The entry drill screen renders two static paragraphs at the foot of every page, in both learn and
cockpit modes:

- `.entry-lead` — FAA JO 7110.65BB 4-6-1 c.4 and AIM 5-3-8 d quoted verbatim, plus a derivation
  note, justifying why the aircraft is drawn 6–10 NM short of the fix.
- `.entry-cdi` — AIM 1-1-17 b.4 and b.5(e)(3) quoted verbatim, plus a caveat note, justifying what
  a dot on the deviation needle is worth.

Both are removed. **Nothing else about the drill changes** — the HSI keeps its deviation needle,
its nav status line and its distance readout, and the scenario keeps its 6–10 NM window. The
generator constants that produce that window stay exactly as they are.

The rationale is training fidelity: an entry decision in the cockpit is made looking at a panel,
not at a page of citations. The quotes are study-aid apparatus that accreted around a display
decision; they are not entry technique, and they sit on the screen a student is *timed* on. The
entry drill should be entry training and nothing else.

This **reverses part of three 2026-08-07 ledger entries** (see Solution Overview), so it must be
recorded as a deliberate reversal, not a silent edit.

## Context (from discovery)

Files/components involved:

- `src/modules/entry-drill.ts` — renders both `<p>` blocks (lines ~499–503); owns nine prose
  constants and their docblocks (lines ~45–205).
- `src/modules/entry-drill.test.ts` — six `it()` blocks pin the prose; a seventh borrows its
  wording in a title/comment.
- `src/ui/hsi.ts` — exports `FULL_SCALE_SOURCE`, whose only consumer is the `.entry-cdi` block.
- `src/styles.css` — `.entry-lead` and `.entry-cdi` rules (lines ~215–229).
- `CLAUDE.md` — the FAA-source citation convention, which currently names this exact case as its
  worked example.
- `docs/content-audit.md` — three 2026-08-07 entries created this text.
- `README.md` — the "Entry determination" bullet describes both footnotes as features.

Related patterns found:

- **The quotation/derivation split** (`OUTBOUND_TIMING_AIM` vs `OUTBOUND_TIMING_NOTE`) — the
  pattern these constants follow. It stays in force everywhere else, including in the entry drill's
  own **feedback** panel, which is untouched by this change.
- **The depiction exemption already exists.** CLAUDE.md: "An avionics *depiction* is not a content
  item and carries no `source` field: the `GPS`/`OBS` annunciators in `hsi.ts` are a fidelity
  decision … Its justification is Garmin, non-FAA, and lives in the `navStatus` docblock and
  `docs/content-audit.md` — not on screen." This change extends that same reasoning to the needle's
  scale and the aircraft's position, which is why the convention gets a narrow carve-out rather
  than being weakened.

Dependencies identified:

- `distanceNm` never reaches `src/app/store.ts` or `src/app/anki-export.ts`, so **no stored
  progress, miss snapshot or exported card is affected**. Verified by grep — the only consumers are
  `hsi.ts`, `entry-drill.ts` and `engine/nav.ts`.
- `determineEntry` takes no distance, so the answer key cannot move.
- `tsconfig.json` runs `noUnusedLocals`, so a stale *import* of `FULL_SCALE_SOURCE` fails
  `npm run typecheck` even while `npm test` stays green. Unused *exports* are not flagged — which
  is exactly how `FULL_SCALE_SOURCE` shipped orphaned once before.

## Development Approach

- **testing approach**: TDD (tests first)
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task** — no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- run tests after each change
- maintain backward compatibility

Deletion-shaped TDD: for each removal, the *first* move is to replace the assertion that pins the
prose with an assertion that pins its **absence**. That is what turns "we deleted some text" into a
guard a future session trips over when it tries to re-add the footnote as a fix — which is a live
risk here, because the ledger currently records the footnote's *absence* as a defect.

## Testing Strategy

- **unit tests**: required for every task (see Development Approach above)
- **e2e tests**: none — this project has no e2e framework (CLAUDE.md: "No e2e framework"). UI logic
  is covered by jsdom tests in `src/modules/*.test.ts`.
- both `npm test` and `npm run typecheck` must pass before a task is done; vitest strips types with
  esbuild and never type-checks, so a green suite does not mean the code compiles.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope
- keep plan in sync with actual work done

## Solution Overview

**Approach**: delete the rendered prose and every constant that exists only to feed it; keep every
number that feeds the *picture*; migrate the provenance of those numbers from screen prose into
source docblocks and the ledger; record the convention carve-out.

**Key design decisions:**

1. **The numeric constants stay.** `CLEARANCE_LEAD_MINUTES`, `SPEED_REDUCTION_MINUTES`,
   `NOMINAL_GROUNDSPEED_KT`, `MIN_DISTANCE_NM`, `MAX_DISTANCE_NM` all drive `generateScenario`.
   Removing them would change the drawn scenario, which is out of scope.

2. **Provenance moves to the docblock, not to nothing.** The `<cite>` strings are deleted from the
   UI, but `FAA JO 7110.65BB 4-6-1 c.4` and `AIM 5-3-8 d` must survive *in source* on the constants
   they justify — otherwise the next session finds bare `5` and `3` with no record of why, and
   re-derives them wrongly. Same for `AIM 1-1-17 b.4` on `FULL_SCALE_NM`, which already has a long
   docblock and only needs its dangling references repaired.

3. **`FULL_SCALE_SOURCE` is deleted, not orphaned.** Its only consumer was `.entry-cdi`. Leaving it
   exported with no consumer recreates the precise state the 2026-08-07 entry filed as a defect
   ("exported with **no consumer anywhere** — not rendered, not asserted, not referenced"). The
   citation folds into the `FULL_SCALE_NM` docblock instead.

4. **The convention gets a narrow carve-out, not a repeal.** CLAUDE.md keeps requiring an on-screen
   FAA source for every user-visible aviation *fact*; the carve-out says an instrument's **scale
   and the aircraft's position within it are part of the depiction**, on the same footing as the
   `GPS`/`OBS` annunciators already exempted. Their justification lives in the docblock and the
   ledger. This matters because the convention paragraph currently uses `FULL_SCALE_NM` as its
   worked example of the opposite rule — leaving it would make CLAUDE.md actively wrong.

5. **The feedback panel is untouched.** `OUTBOUND_TIMING_AIM`/`_NOTE` render inside
   `.entry-outbound-timing` *after grading*, as teaching content answering the question just asked.
   That is not the always-on footnote the user asked about, and it stays.

6. **One drawing invariant is kept and retitled.** `draws the pegged needle its own prose tells the
   student to expect` asserts the rendered bar is genuinely pegged across the window and genuinely
   centred on course. It references no prose constant and is a real guard against a re-tuned
   `FULL_SCALE_NM`; only its title and comment cite prose that will no longer exist.

**Alternatives rejected:**

- *Remove the needle and distance too* — would satisfy the existing convention with no amendment,
  but deletes cockpit fidelity the user explicitly wants kept. Rejected on the user's reasoning:
  the panel is what you look at in the aircraft.
- *Collapse the footnotes behind `<details>`* — keeps compliance and de-clutters, but the text is
  still on the page, which is not what was asked for.

## Technical Details

**Constants removed from `src/modules/entry-drill.ts`** (all exported, all prose-only):

| Constant | Role |
|---|---|
| `CLEARANCE_LEAD_ATC` | 7110.65 quotation |
| `CLEARANCE_LEAD_SOURCE` | its `<cite>` |
| `SPEED_REDUCTION_AIM` | AIM 5-3-8 d quotation |
| `SPEED_REDUCTION_SOURCE` | its `<cite>` |
| `LEAD_DISTANCE_NOTE` | the groundspeed derivation |
| `CDI_SCALE_AIM` | AIM 1-1-17 b.4 quotation |
| `CDI_ARMING_AIM` | AIM 1-1-17 b.5(e)(3) quotation |
| `CDI_ARMING_SOURCE` | its `<cite>` |
| `CDI_SCALE_NOTE` | the terminal-mode caveat |

**Constants kept** (feed `generateScenario`, not prose): `CLEARANCE_LEAD_MINUTES`,
`SPEED_REDUCTION_MINUTES`, `NOMINAL_GROUNDSPEED_KT`, `MIN_DISTANCE_NM`, `MAX_DISTANCE_NM`.

**Removed from `src/ui/hsi.ts`**: `FULL_SCALE_SOURCE`. Two docblock references to
`CDI_ARMING_AIM` / `CDI_SCALE_AIM` / `CDI_SCALE_NOTE` (lines ~108 and ~117) must be rewritten in
the same pass — they will otherwise point at deleted identifiers.

**Removed from `src/styles.css`**: the `.entry-lead` rule (border-top + padding-top), the
`.entry-lead, .entry-cdi` rule (font-size + color), and the four-line comment above them.

**Test blocks deleted whole** (`src/modules/entry-drill.test.ts`):

- `cites both timings at sub-paragraph granularity` (~230)
- `quotes timings that still say what the generator's constants claim` (~240)
- `quotes both timings verbatim with their sources, derivation kept outside` (~928)
- `cites the CDI scale beside the needle, with the mode caveat outside the quote` (~960)
- `does not offer the drill's distance as a reason for terminal scaling` (~1011)
- `quotes a scale the instrument still draws on` (~1042)

**Test blocks kept**: `spans the window between the two verified timings` (~183),
`spreads across the window rather than parking on one end` (~207), `quantises to the resolution
distanceText renders` (~218) — all test the generator, not the prose.

**New guard**: one test asserting `.entry-lead` and `.entry-cdi` are absent from the rendered
screen in **both** modes, and that the screen renders no `<cite>` outside the feedback panel. The
mode coverage is the load-bearing half — the footnote was mode-independent, so a re-add that only
appears in learn mode must fail too.

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): code, tests, and in-repo documentation.
- **Post-Completion** (no checkboxes): visual confirmation in a browser, redeploy.

## Implementation Steps

### Task 1: Replace the prose assertions with an absence guard

**Files:**
- Modify: `src/modules/entry-drill.test.ts`

- [x] delete the six prose-pinning `it()` blocks listed in Technical Details, and drop the nine
      now-unused constant imports plus `FULL_SCALE_SOURCE` from the import list
- [x] write `renders no cited footnotes below the drill` — asserts `.entry-lead` and `.entry-cdi`
      are both `null`, in **both** `learn` and `cockpit` mode
- [x] extend it to assert the screen renders no `<cite>` element outside `.entry-feedback`, so a
      re-added footnote under any new class name also fails
- [x] add a comment recording *why* absence is asserted — the 2026-08-07 ledger entries make the
      footnote's absence look like a defect, and this is what stops it being "fixed" back in
- [x] run tests — suite must be RED here (the `<p>` blocks still render); confirm the failure names
      the absence guard, not a compile error, before proceeding

### Task 2: Remove both footnote blocks and their constants

**Files:**
- Modify: `src/modules/entry-drill.ts`

- [x] delete the `<p class="entry-lead">` and `<p class="entry-cdi">` blocks from the `innerHTML`
      template (~lines 499–503)
- [x] delete the nine prose constants listed in Technical Details, with their docblocks
- [x] fold the citations into the docblocks of the constants that survive: `CLEARANCE_LEAD_MINUTES`
      keeps `FAA JO 7110.65BB 4-6-1 c.4` and the verbatim sentence, `SPEED_REDUCTION_MINUTES` keeps
      `AIM 5-3-8 d` and its sentence, and both note the citation no longer renders on screen
- [x] remove `FULL_SCALE_SOURCE` from the `src/ui/hsi.ts` import list (`noUnusedLocals` will
      otherwise fail typecheck while the suite stays green)
- [x] verify `NOMINAL_GROUNDSPEED_KT`'s "never cited as one" warning survives the edit intact
- [x] run tests and `npm run typecheck` — the Task 1 guard must now pass

### Task 3: Retire `FULL_SCALE_SOURCE` from the instrument

**Files:**
- Modify: `src/ui/hsi.ts`
- Modify: `src/ui/hsi.test.ts` (only if it references the constant)

- [x] delete the `FULL_SCALE_SOURCE` export and its docblock
- [x] fold `AIM 1-1-17 b.4` into the `FULL_SCALE_NM` docblock as the value's provenance, stating
      plainly that it is recorded here and not rendered
- [x] rewrite the `FULL_SCALE_NM` docblock's closing line — it currently ends "the withdrawal is
      rendered to the student by `CDI_ARMING_AIM`", which becomes false; the withdrawal survives in
      `docs/content-audit.md` and must be cited there instead
- [x] grep for `FULL_SCALE_SOURCE` across `src/` and confirm zero hits remain
- [x] write/adjust a test asserting `hsi.ts` exports no unconsumed `*_SOURCE` constant, so the
      orphaned-export defect cannot recur
- [x] run tests and typecheck — must pass before task 4

### Task 4: Remove the footnote styles

**Files:**
- Modify: `src/styles.css`

- [x] delete the `.entry-lead` rule, the `.entry-lead, .entry-cdi` rule, and the explanatory
      comment above them
- [x] confirm `.entry-stats` still reads correctly as the last element on the screen now that the
      bordered block below it is gone
- [x] run `styles.test.ts` — every `var(--x)` must still resolve and no colour may have moved out
      of `:root`
- [x] confirm the answer-group invariants still pass (`separates the answer group from the
      instrument above it`, and the `label.previousElementSibling` pin in `entry-drill.test.ts`)
- [x] run tests — must pass before task 5

### Task 5: Retitle the pegged-needle invariant

**Files:**
- Modify: `src/modules/entry-drill.test.ts`

- [x] rename `draws the pegged needle its own prose tells the student to expect` — the prose is
      gone, but the invariant is not; it now guards the drawn picture against a re-tuned
      `FULL_SCALE_NM` on its own terms
- [x] rewrite its leading comment, which currently quotes `CDI_SCALE_NOTE` verbatim as the claim
      under test; restate the claim as a property of the drawing
- [x] keep both halves of the assertion (pegged off-course, centred on-course) — the second is what
      distinguishes real geometry from a clamp that pegs everything
- [x] run tests — must pass before task 6

### Task 6: Record the reversal in CLAUDE.md, the ledger and README

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/content-audit.md`
- Modify: `README.md`

- [x] add a dated entry to `docs/content-audit.md` stating what was removed and why, naming the
      three 2026-08-07 entries it reverses, and recording that the *facts* were never wrong — the
      judgement that changed is whether an instrument depiction owes the student a citation
- [x] amend those three 2026-08-07 entries in place with a pointer to the new entry (the
      2026-08-03 protected-airspace correction is the model — never silently edit past)
- [x] narrow the CLAUDE.md citation-convention paragraph: an instrument's scale and the aircraft's
      position within it are part of the **depiction**, exempt on the same footing as the
      `GPS`/`OBS` annunciators, with provenance in the docblock and ledger
- [x] delete the `FULL_SCALE_NM`/`FULL_SCALE_SOURCE` worked example from that paragraph — it is
      now an example of the opposite rule and would mislead the next session outright
- [x] rewrite the README "Entry determination" bullet — it currently advertises both footnotes,
      including "The screen states what the needle is worth … quoting AIM 1-1-17 b.4"
- [x] run tests — `dashboard.test.ts` diffs README's route table, so confirm that table is untouched

### Task 7: Verify acceptance criteria

- [x] `.entry-lead` and `.entry-cdi` render nowhere, in either mode
- [x] the HSI is unchanged: needle, dots, TO/FROM flag, nav status line and distance readout all
      still render, and the scenario line still names the distance
- [x] the 6–10 NM window is unchanged — `MIN_DISTANCE_NM` is 6, `MAX_DISTANCE_NM` is 10
- [x] `determineEntry` output is unchanged for a seed sweep; no answer key moved
- [x] the feedback panel still renders `OUTBOUND_TIMING_AIM`/`_NOTE` after grading
- [x] no `*_SOURCE` constant is left exported without a consumer
- [x] run full test suite: `npm test`
- [x] run `npm run typecheck`
- [x] run `npm run build` to confirm the production build is clean

### Task 8: [Final] Update documentation

- [x] re-read the CLAUDE.md carve-out as a stranger would — confirm it states the *mechanism*
      (depiction vs taught fact), not an enumeration of the two exempt cases
- [x] confirm no docblock anywhere still references a deleted identifier (grep the nine names plus
      `FULL_SCALE_SOURCE`)
- [x] move this plan to `docs/plans/completed/`

## Post-Completion

*Items requiring manual intervention or external systems — no checkboxes, informational only*

**Manual verification:**

- Load `#/entry-drill` in a browser in both learn and cockpit mode and confirm the screen ends at
  the stats line, with no bordered block beneath it.
- Check the page at 320 px width — the footnote was a large share of the scroll length on a phone,
  and the layout below `.entry-stats` has not been seen without it.

**External system updates:**

- Redeploy via `mise run deploy` to publish to https://holdpractice.vitko.info.
- No Anki re-import is needed: the footnote was never exported to a card, and no miss snapshot
  carries it.
