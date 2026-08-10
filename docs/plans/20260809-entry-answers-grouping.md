# Answer Row Reads as Part of the Instrument Panel

## Overview
On the entry drill, the `Direct / Teardrop / Parallel` answer row sits flush against the bottom edge
of the G1000 HSI panel. The panel is a filled, hard-edged, rounded rect that fills its whole viewBox,
so the row reads as attached hardware — a bezel, a softkey strip, a status band — rather than as the
answer input. Separate the row from the panel so its position agrees with its appearance about which
group it belongs to.

Measured in the stylesheet, not estimated from a screenshot:
- `.entry-answers` has **no `margin-top`** and `.entry-hsi` has no rule at all → **0 px** between the
  panel's bottom edge and the buttons.
- `.entry-answers { gap: 0.5rem }` → **8 px** between adjacent buttons.
- Ratio **0 : 1**. Each button is strictly closer to the instrument than to its neighbours.

No CSS changed to cause this. On `master` the instrument was `viewBox="0 0 200 200"` with the rose
drawn as a *circle* — transparent corners, page background flowing around it. The G1000 work replaced
it with a rect that fills the viewBox (`LAYOUT` in `src/ui/hsi.ts`: "The panel rect fills exactly
this"). Whitespace that used to be page became panel. The regression lives in an SVG geometry
constant one module away from the screen it broke, which is why no CSS diff shows it.

## Design decision and its evidence

**The spacing value is a chosen convention, not a derived one. Do not add a citation for it.**

A deep literature search (Gestalt primary sources, IBM Carbon, Atlassian, MIL-STD-1472G,
FAA HF-STD-001B, WCAG 2.2) was run specifically to find a defensible number. It found none, and every
quantitative candidate was refuted under 3-vote adversarial verification:

- **Palmer (1992)**, the source behind "common region beats proximity", is demonstration-only — no
  participants, no statistics, no visual angles. It states grouping is a *ceteris paribus* rule and
  that when factors oppose "there is (as yet) no way to predict the outcome". The absolute form of
  the law, as repeated by design blogs, is false.
- Measured common-region effects (Beck & Palmer 2002; Palmer & Beck 2007) all concern elements
  **contained within** a region. Whether an element flush against but *outside* a filled rect gets
  absorbed — exactly this case — is **unmeasured**. Direction only; no effect size is recoverable.
- Carbon and Atlassian publish spacing ladders with **no** inter-group : intra-group ratio, no
  minimum, and no citation for the proximity principle. Carbon's "whitespace can replace dividers" is
  permissive modal, unevidenced, and never contemplates an element abutting a filled region.
- All five readings of MIL-STD-1472G / HF-STD-001B were refuted. **Refuted is not disproven** — those
  standards were not shown to be silent, only that these readings of them did not hold. Do not cite
  them either way.

What survives is a reason to prefer a **multi-cue** fix: since no cue-strength arithmetic exists,
whitespace alone is a bet on winning a competition the primary source explicitly declines to predict.
Adding a second, differentiating cue does not depend on winning it.

Treat the chosen multiplier the way `PARALLEL_INTERCEPT_DEG = 45` is treated in `src/engine/entry.ts`:
a drawing convention picked for legibility, stated as such in the comment that carries it, and never
justified by claiming a source supports the number. The value below is 3x the inter-button gap —
24 px, a rung on both published ladders (Carbon `$spacing-05`, Atlassian `space.300`). The *ladders*
are real; the choice of rung is ours.

## Context
- Files involved:
  - Modify: `src/styles.css` — new `.entry-answers-label` rule carrying the separating `margin-top`
  - Modify: `src/styles.test.ts` — new spacing-ratio invariant
  - Modify: `src/modules/entry-drill.ts` — visible group label + group semantics on `.entry-answers`
  - Modify: `src/modules/entry-drill.test.ts` — assert the label and the group wiring
  - Modify: `CLAUDE.md` — the TDD bullet listing what `styles.test.ts` guards
- Related patterns:
  - `styles.test.ts` checks the stylesheet as **text** because jsdom implements a simplified cascade
    and cannot answer "would this really render?". Every scan in that file asserts **non-vacuity**
    before asserting content (`expect(values.length).toBeGreaterThan(50)`) — a regex typo otherwise
    turns a guard into a green no-op. The new invariant must do the same.
  - `.entry-modes` already carries `role="group" aria-label="Drill mode"`; `.entry-answers` carries
    no role and no accessible name. The label below closes that gap as a side effect.
  - `.entry-lead` is the existing in-house "a new region starts here" idiom (`border-top` +
    `padding-top`). It is **not** reused here: a second hairline directly under the panel risks
    reading as more bezel, which is the defect.
  - Colour rules: no literal outside `:root` (`styles.test.ts`), and `palette.test.ts` sweeps every
    `src/**/*.ts`. The label uses `var(--text-dim)`, already classified `text` in `TIERS` and already
    measured at 4.5:1 against both backdrops. No new custom property, so `TIERS` is untouched.
- Dependencies: none (zero-dependency project, vanilla TS)

## Development Approach
- **Testing approach**: TDD (test first) — project policy per CLAUDE.md
- Complete each task fully before moving to the next
- `npm test` AND `npm run typecheck` must both pass before a task is done (vitest does not type-check)
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Scope is this defect only. Do not restyle the panel, do not touch `hsi.ts`, do not adjust any other
  screen's spacing, and do not "fix" the `.entry-feedback` gap below the buttons.

## Implementation Steps

> Task order matters: the label is inserted **before** `.entry-answers`, so it becomes the first
> element of the answer group. The separating margin therefore belongs on the label, not on the
> button row — putting it on `.entry-answers` would open the gap *between the label and the buttons
> it names*, splitting the group instead of detaching it from the panel. Build the structure first,
> then pin the spacing against it once.

### Task 1: Give the row a page-voice label and real group semantics

**Files:**
- Modify: `src/modules/entry-drill.test.ts`
- Modify: `src/modules/entry-drill.ts`
- Modify: `src/styles.css`

- [x] Write failing tests in `entry-drill.test.ts`: (a) a visible label element precedes
      `.entry-answers` in the rendered DOM; (b) `.entry-answers` carries `role="group"` and is
      accessibly named by that label via `aria-labelledby`; (c) the label renders in both `learn` and
      `cockpit` mode (one template serves both — a regression guard, not a new behaviour)
- [x] Implement in `entry-drill.ts`: insert
      `<p class="entry-answers-label" id="entry-answers-label">Which entry?</p>` immediately before
      the `.entry-answers` div, and add `role="group" aria-labelledby="entry-answers-label"` to that
      div. Do not change the `.entry-answer` buttons, their `data-entry` attributes, or
      `ENTRY_LABELS` — `answerBtns` and every existing `.entry-answer` query must keep working
      untouched
- [x] Add a `.entry-answers-label` rule in `styles.css`: `font-size: var(--fs-sm)`,
      `color: var(--text-dim)`, and a **tight bottom margin** so the label groups with the buttons it
      names. No new colour and no new custom property — `--text-dim` is already classified `text` in
      the `TIERS` map and already measured at 4.5:1 against both backdrops, so the contrast suite is
      untouched
- [x] Run `npm test` and `npm run typecheck` — must pass before Task 2 (751 passed, tsc clean)

### Task 2: Separate the answer group from the panel, and pin the ratio

**Files:**
- Modify: `src/styles.test.ts`
- Modify: `src/styles.css`

- [x] Write a failing test in `styles.test.ts`: harvest the `.entry-answers-label` and
      `.entry-answers` rule blocks from the stylesheet text, read `margin-top` from the label and
      `gap` from the row, and assert `margin-top >= 3 * gap`. Add a `ruleBlock(css, selector)` helper
      beside the existing `rootBlock`, and parse `rem` values with a helper that throws rather than
      returning `NaN` (`remValue`; unitless `0` accepted, every other notation refused)
- [x] Make it non-vacuous, in the idiom of the file: assert **both** rule blocks were actually found
      and **both** declarations parsed to finite numbers. A selector typo must fail the test, not
      pass it silently — every other scan in this file guards itself the same way. Done as: both
      blocks pinned to distinct content (`margin-top:` / `display: flex`), `gap > 0` (a zero gap
      satisfies any margin — the real vacuity hole), and both parses pinned finite *by* those
      comparisons rather than by a `Number.isFinite` line that could not fail
- [x] Comment the test with *why* the rule exists: these are page controls sitting directly beneath a
      filled instrument region, and at a 1:1 ratio each button is as close to the panel as to its
      neighbours. State plainly that the multiplier is a **chosen convention with no published
      basis** (see the design-decision section of this plan), so a later session does not "improve"
      it by inventing a citation
- [x] Implement in `styles.css`: add `margin-top: 1.5rem` to `.entry-answers-label` (24 px = 3 x the
      8 px `gap`). Keep both values in `rem` so the guard compares like with like
- [x] Run `npm test` and `npm run typecheck` — must pass before Task 3 (753 passed, tsc clean)

> Mutation-tested before being trusted, per CLAUDE.md. `gap` 0.5rem -> 0.6rem fails it (the
> assertion moves with the constant, unlike a `toBe(1.5)`); `margin-top: 24px` throws at the parse.
> `ruleBlock`'s two misreads are guarded by *different* mechanisms and needed separate synthetic
> cases: the leading boundary stops a compound `.pill.row`, while the trailing `\s*\{` — not the
> boundary — is what stops `.entry-answers` harvesting `.entry-answers-label`. The first synthetic
> written here passed with the boundary deleted and its comment named the wrong mechanism.

### Task 3: Verify acceptance criteria

- [ ] Run the full suite: `npm test` — all green, no skipped files
- [ ] Run `npm run typecheck` (`tsc --noEmit`) — clean
- [ ] Confirm `main.test.ts`'s default-path test still passes (real registry, real localStorage, real
      clock — the only test exercising the no-argument render path the browser actually takes)
- [ ] Confirm `written-test.test.ts` is still green: it renders the *no-nav* HSI figure and shares the
      `.hsi` rule and viewBox, so it is the regression surface for anything near that panel
- [ ] **Manual, in-product** (not automatable — the research found no published blur-radius threshold
      and no automated visual-grouping check exists): run the app, open `#/entry`, and confirm (a) the
      answer row reads as a control group at a glance; (b) it survives an 8 px Gaussian blur as an
      object distinct from the panel; (c) it holds in both `learn` and `cockpit` mode; (d) it holds at
      a narrow mobile width, where the panel's 420 px cap no longer applies and the row and panel
      widths converge — the worst case for this defect

### Task 4: Update documentation

- [ ] `CLAUDE.md`: extend the TDD bullet listing what `styles.test.ts` guards (currently `[hidden]`
      and `var(--x)` definedness) with the answer-group spacing ratio, stating that the multiplier is
      a chosen convention and that no published source supplies one
- [ ] **No README change**: no route is added or renamed and `PHASE_PREP` is untouched, so the
      asserted module -> exam-phase table stays as-is. Do not reflow it
- [ ] **No `docs/content-audit.md` entry**: the ledger records *content* corrections — user-visible
      aviation facts and their regression tests. This is a layout defect and teaches nothing wrong
      about holding entries. Do not manufacture an entry to look thorough
