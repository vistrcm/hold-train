# Verify holding protected-airspace dimensions and fix "unprotected side"

## Overview

Two related content defects, both about holding protected airspace:

1. `docs/research-claude.md:41` states "holding side (~8 NM protected) vs. non-holding side (~4 NM
   protected)", sourced to a CFII rather than an FAA publication. There is no fixed pair of numbers —
   the protected area scales with template size.
2. `src/modules/wind-lab.ts:339` renders "non-holding (**unprotected**) side of the fix". The
   nonholding side is not unprotected; it is the narrower of two protected areas. The word teaches
   the wrong mental model of *why* straying onto that side matters.

Split out of `docs/plans/completed/20260802-parallel-entry-rejoin-turn.md` (completed 2026-08-02;
that plan's own Task 10 moved it under `completed/`, which is why line 142 below already uses the
new path), which needed the safety rationale
but not this verification work, and which must not touch these files.

## ⚠️ This reverses a prior ledger decision — argue, do not overwrite

The `docs/content-audit.md` entry titled "**Fixed: the wind-lab debrief hid which side a wide
inbound crossed on**" records "unprotected" as a **deliberate fix**, reasoned as: "The
non-holding side is the side with no protected airspace, so the case the wording softened was
precisely the safety-relevant one." The wording is pinned by `src/modules/wind-lab.test.ts:376`
(`expect(debrief).toMatch(/non-holding \(unprotected\) side of the fix/)`).

That entry's *goal* was right — the debrief must name which side the aircraft crossed on, and must
not soften it to a neutral "off the fix". Only its *parenthetical* is wrong. Preserve the goal.

Silently reversing a ledger decision is the same failure mode as the 2026-07-22 rejoin-direction
flip. Task 3 must argue against the entry in the ledger itself, not quietly edit past it.

## Context (from discovery)

**Files involved**

- `docs/research-claude.md:41` — the unsourced 8/4 NM claim
- `src/modules/wind-lab.ts:339` — `'non-holding (unprotected) side of'`
- `src/modules/wind-lab.test.ts:376` — pins that exact string
- `docs/content-audit.md`, entry "**Fixed: the wind-lab debrief hid which side a wide inbound
  crossed on**" — the prior decision to argue against. Cited by title, not by line: the ledger is
  append-only at the top, so any new entry shifts every line number below it (this reference was
  written as `:433-442` and the 2026-08-02 rejoin entry pushed that range onto an unrelated fix)

**Dependencies:** none. No new packages (CLAUDE.md hard rule).

**Prior research, unverified.** An earlier investigation reported FAA Order 8260.3G Table 16-6-1
values of template 1 = 2.6 / 4.1 (total 6.7), template 8 = 4.9 / 7.7 (12.6), template 31 =
22.5 / 34.5 (57.0), with the nonholding side 38.5–40% of total width across all 31 templates. **Treat
these as a hypothesis to check, not as findings.** Order 7130.3A (the former home, Table 3) was
cancelled 3/14/2016 and folded into TERPS chapter 16; Order 8260.3B is likewise superseded.

**Tooling note.** `faa.gov` returns HTTP 403 to plain fetches — use `curl` with a browser
User-Agent. `magick` and `gs` are available; `pdftoppm` is not. Some FAA order PDFs are scanned with
no text layer and must be rendered to images and read visually.

## Development Approach

- **Testing approach: TDD** — per CLAUDE.md. Task 3 changes a user-visible string pinned by a test:
  update the test first, watch it fail, then change the string.
- `npm test` **and** `npm run typecheck` must both pass before a task is done.
- Every user-visible aviation fact carries a `source` citing the FAA primary source at sub-paragraph
  granularity. Anything that cannot be verified is labelled "unverified", never asserted.

## Testing Strategy

- **unit tests**: Vitest. The only code change is one rendered string in `wind-lab.ts`.
- test command: `npm test`; type check: `npm run typecheck`.

## Progress Tracking

- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix; blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Verify the protected-airspace dimensions against the current FAA source

**Files:**
- Create: `docs/holding-protected-airspace.md`

- [x] establish which order is **current**. Check FAA's directives index for Order 7130.3A ("Holding
      Pattern Criteria") and Order 8260.3B — confirm both are cancelled/superseded and that
      **Order 8260.3G** (eff. 07/01/2024) chapter 16 is the live criteria
      (7130.3A: cancelled 2016-03-14 by 8260.3C; 8260.3B: cancelled 2016-03-14 by 8260.3C;
      8260.3G: Active, eff. 2024-07-01 — all from faa.gov directives index, checked 2026-08-03)
- [x] download 8260.3G and locate **Table 16-6-1 "Holding Pattern Dimensions (NM)"** and para
      **16-6-2 "Basic Primary Area Construction"** (table on printed page 16-18, PDF page 409)
- [x] extract the table. If the PDF has no text layer, render the page and read it visually
      (PDF has a text layer — gs txtwrite; table page and figure pages also rendered and read
      visually as a cross-check)
- [x] verify **at least three rows independently**, and check the structural identity that the two
      perpendicular columns sum to Total Width (and the three along-course columns to Total Length)
      (patterns 4, 8, 16, 31 verified digit-by-digit against the rendered page; length identity
      exact 28/28; width identity exact 27/28 — pattern 16 prints 21.1 vs 8.2+12.8=21.0, a
      rounding artifact in the published table, visually confirmed as-printed)
- [x] confirm which column is which side. The order does **not** use the words "holding side" /
      "non-holding side" — the mapping is an inference. 16-6-2 is written for the right-hand pattern
      ("for left-hand pattern reverse the instructions"); record the reasoning explicitly and label
      the side mapping as derived (derivation recorded in the doc; M-E = holding side, L-I/M-H =
      non-holding side; corroborated by ¶2-8-9's prose use of "holding side")
- [x] write `docs/holding-protected-airspace.md` with the verified table, the citation at
      sub-paragraph granularity, and the derivation for the side mapping
- [x] ⚠️ if the values cannot be verified, say so and label them unverified — do not carry the
      prior numbers forward as though checked (the prior "template 1 = 2.6/4.1" row is NOT in the
      current order — ¶16-3-1 retired pattern sizes 1–3; recorded as historical/unverified in the
      doc. Patterns 8 and 31 hypothesis values confirmed; 38.5–40% fraction confirmed over the 28
      current patterns)

### Task 2: Correct the research note

**Files:**
- Modify: `docs/research-claude.md`

- [ ] replace the 8/4 NM claim at `:41` with the verified finding, citing 8260.3G Table 16-6-1 and
      linking `docs/holding-protected-airspace.md`
- [ ] state plainly that **both sides are protected** and that there is no single pair of numbers —
      the area scales with template (altitude/speed)
- [ ] keep a dated note that the previous figure was sourced to a CFII, not the FAA, so the
      correction is not silently rewritten
- [ ] note that "non-maneuvering side" is **not** an FAA term — it originates in an Aeronautical
      Charting Forum submission by an outside consultant (ACF Control # 03-01-247)
- [ ] run `npm test` and `npm run typecheck`

### Task 3: Fix the wind-lab debrief wording without losing the prior fix's intent

**Files:**
- Modify: `src/modules/wind-lab.test.ts`
- Modify: `src/modules/wind-lab.ts`
- Modify: `docs/content-audit.md`

- [ ] update `wind-lab.test.ts:376` to expect the corrected wording, keeping a test that the debrief
      still **names the side** — that is what the 2026-07-22 fix was for and it must not regress
- [ ] run tests — confirm the new expectation FAILS first
- [ ] change `wind-lab.ts:339` from "non-holding (unprotected) side of" to wording that names the
      side and conveys the narrower margin without claiming the side is unprotected
- [ ] amend that same `docs/content-audit.md` entry in place: record that the entry's goal was right and its
      parenthetical wrong, with the 8260.3G citation. Do not delete the entry
- [ ] add a new ledger entry for this correction with its regression test
- [ ] run `npm test` and `npm run typecheck`

### Task 4: Verify acceptance criteria

- [ ] no user-visible string calls the nonholding side "unprotected"
- [ ] the wind-lab debrief still names which side an inbound crossing fell on
- [ ] every protected-airspace figure in `docs/` cites 8260.3G at sub-paragraph granularity or is
      labelled unverified
- [ ] full suite: `npm test`; type check: `npm run typecheck`
- [ ] no runtime dependencies added

### Task 5: [Final] Update documentation

- [ ] add a CLAUDE.md note if a durable convention emerged
- [ ] remove the "unverified — pending" caveat from
      `docs/plans/completed/20260802-parallel-entry-rejoin-turn.md`'s Overview if that plan has
      already completed, or from the live plan if not
- [ ] run `npm test` and `npm run typecheck`
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion

**Manual verification**

- Run the Wind & Timing Lab, fly a circuit that ends off the holding side, and confirm the debrief
  names the side clearly and does not call it unprotected.
