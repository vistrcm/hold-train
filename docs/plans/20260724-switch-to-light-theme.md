# Switch to light theme

## Overview

Replace the dark palette with a single light palette — no dark code path, no `prefers-color-scheme` branch, no toggle UI, no store change. The work is three-layered: the CSS custom properties in `src/styles.css`, the ~14 hardcoded pass/fail literals that bypass those properties, and the nine instrument colors baked into the SVG string builders in `src/ui/hsi.ts` and `src/ui/mapview.ts`.

Because "it looks fine" is not a testable claim, the palette is locked down by a computed WCAG contrast test rather than by eye. Every value below was computed, not guessed:

| Role | Value | vs `--bg` | vs `--surface` |
|---|---|---|---|
| `--bg` | `#eef2f6` | — | — |
| `--surface` | `#ffffff` | — | — |
| `--text` | `#10161c` | 16.18 | 18.20 |
| `--text-dim` | `#4d5762` | 6.54 | 7.35 |
| `--accent` | `#0b57b8` | 6.08 | 6.84 |
| `--ok` | `#15703f` | 5.46 | 6.14 |
| `--err` (new) | `#a81f18` | 6.49 | 7.31 |
| `--border` | `#7d8894` | 3.21 | 3.61 |

Instrument colors (on the white instrument face): direct `#15703f` (6.14), teardrop `#8a5200` (6.39), parallel `#2f6fd0` (4.88), CDI magenta `#a3168f` (6.84), heading readout `#0b6b8f` (5.98), bezel/minor ticks `#7d8894` (3.61), ink/major ticks `#10161c` (18.20), face `#ffffff`.

Thresholds verified against the W3C source, not memory: SC 1.4.3 requires 4.5:1 for normal text; SC 1.4.11 requires 3:1 for UI components and graphical objects and states explicitly that computed values are not to be rounded up (`w3.org/WAI/WCAG21/Understanding/contrast-minimum.html`, `.../non-text-contrast.html`).

## Context

**Files involved**

- `src/styles.css` — `:root` palette (7 vars, `color-scheme: dark`), plus `#3fbf6f` at lines 159/209/263/349/362/391 and `#e05c5c` at 163/213/268/335/353/366/395
- `src/styles.test.ts` — existing text-level invariants (`[hidden]`, every `var()` defined); the natural home for the palette invariants
- `src/ui/hsi.ts` — `SECTOR_COLORS` + 8 literal sites (rose face `#0d1115`, bezel `#2a323c`, ticks, lubber line, CDI magenta `#e04ee0`, readout `#7fd0ff`)
- `src/ui/mapview.ts` — `ENTRY_COLORS` + 10 literal sites (plate background `#0d1115`, frame `#2a323c`, racetrack, fix triangle, ownship, north arrow, wind vector)
- `src/ui/hsi.test.ts`, `src/ui/mapview.test.ts` — confirmed to assert **zero** colors today, so the swap breaks nothing and is equally unguarded
- `src/contrast.ts` (new) — pure `contrastRatio(hex, hex)` oracle
- `src/ui/palette.ts` (new) — the instrument palette, shared by both SVG modules

**Related patterns**

- Assert-the-artifact-as-text: `styles.test.ts` imports `./styles.css?raw`; `dashboard.test.ts` imports `README.md?raw`. Both new tests follow this, including the anti-vacuous `is actually loaded` guard.
- `vite.config.ts` must keep `test.css.include = [/styles\.css/]` or the raw import is blank and the assertions pass vacuously.
- CLAUDE.md records that a silent `var()` fallback once shipped a sub-4.5:1 "Ready ✓". This plan turns that class of bug from "caught by review" into "caught by `npm test`".

**Dependencies:** none. Zero runtime deps preserved; both new files are pure TS.

**Pre-existing defects this exposes (fixed here, because light mode makes them visible):**

1. `.copy-form input`, `.wind-input`, and card-like blocks use `border: 1px solid var(--surface)` — white on near-white once inverted. These move to `var(--border)`, which is why `--border` is held to the 3:1 UI-component threshold.
2. Pass/fail colors are hardcoded 14 times, invisible to the `var()`-is-defined test. They become `var(--ok)` / `var(--err)`.

**Explicit non-goals:** no `prefers-color-scheme` block, no theme toggle, no `store.ts` schema bump, no engine or content changes.

## Development Approach

- **Testing approach: TDD** — per CLAUDE.md, tests first, always. Each task writes a failing test, then makes it pass.
- `npm test` **and** `npm run typecheck` must both pass before a task is considered done. Vitest strips types with esbuild and never type-checks; `strict` + `noUncheckedIndexedAccess` + `noUnused*` are easy to trip in new test files.
- Complete each task fully before moving to the next.
- **CRITICAL: every task MUST include new/updated tests.**
- **CRITICAL: all tests must pass before starting the next task.**

## Implementation Steps

### Task 1: Contrast oracle

The palette tests are only as trustworthy as the function computing the ratios, so it gets its own reference tests first.

**Files:**
- Create: `src/contrast.ts`, `src/contrast.test.ts`

- [ ] write `src/contrast.test.ts` first, against hand-checkable reference pairs: `#000000`/`#ffffff` → 21, identical colors → 1, ratio is symmetric, 3-digit shorthand (`#fff`) parses the same as `#ffffff`, and an invalid hex throws
- [ ] implement `contrastRatio(a: string, b: string): number` in `src/contrast.ts` using the WCAG relative-luminance formula (sRGB channel linearization at the 0.03928 breakpoint, `0.2126 R + 0.7152 G + 0.0722 B`, then `(L1 + 0.05) / (L2 + 0.05)`), returning the unrounded value — the spec forbids rounding up to a threshold
- [ ] cite the formula source in a file comment
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 2

### Task 2: Light palette in the stylesheet

**Files:**
- Modify: `src/styles.test.ts`, `src/styles.css`

- [ ] extend `src/styles.test.ts` with three failing assertions: (a) the stylesheet declares `color-scheme: light`; (b) no hex literal appears outside the `:root` block — this is what forces the 14 stray pass/fail colors through the palette; (c) a computed contrast test that parses `--name: #value` pairs out of the raw CSS and asserts each text role (`--text`, `--text-dim`, `--accent`, `--ok`, `--err`) clears 4.5:1 against **both** `--bg` and `--surface`, and `--border` clears 3.0:1 against both
- [ ] confirm the new tests fail for the right reason before touching `styles.css`
- [ ] replace the `:root` values with the light palette from the Overview table, add `--err: #a81f18`, and set `color-scheme: light`
- [ ] replace all six `#3fbf6f` occurrences with `var(--ok)` and all seven `#e05c5c` occurrences with `var(--err)`
- [ ] change `border: 1px solid var(--surface)` to `var(--border)` on the input and card rules (lines ~241, ~309, ~328) and the `border-left: 3px solid var(--surface)` accent bar (~140), so component boundaries survive the inversion
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 3

### Task 3: Instrument palette for the SVG modules

`hsi.ts` and `mapview.ts` currently define the same entry-color triple twice and scatter seven more literals across template strings. One shared const removes the existing duplication and gives the test a single object to assert against.

**Files:**
- Create: `src/ui/palette.ts`, `src/ui/palette.test.ts`
- Modify: `src/ui/hsi.ts`, `src/ui/mapview.ts`

- [ ] write `src/ui/palette.test.ts` first: every entry color and ink color in the palette clears 4.5:1 against `PALETTE.face` when it renders text (labels, heading readout) and 3.0:1 when it renders a line or shape (ticks, bezel, racetrack, entry paths, wind vector); assert the entry-color keys are exactly `direct | teardrop | parallel`
- [ ] add a source-text assertion in the same file, using the `?raw` idiom already used for `styles.css` and `README.md`: importing `../ui/hsi.ts?raw` and `../ui/mapview.ts?raw`, assert neither contains a `#rrggbb` literal — the palette import is now the only way a color enters an instrument. Include a non-empty length guard so the assertion cannot pass vacuously
- [ ] create `src/ui/palette.ts` exporting a single frozen `PALETTE` (`face`, `bezel`, `ink`, `inkDim`, `entry: {direct, teardrop, parallel}`, `cdi`, `readout`) with the verified values from the Overview
- [ ] replace `SECTOR_COLORS` in `hsi.ts` and `ENTRY_COLORS` in `mapview.ts` with `PALETTE.entry`, and substitute every remaining literal in both files
- [ ] verify the existing `hsi.test.ts` and `mapview.test.ts` geometry assertions still pass untouched — the change is color-only, so any failure there means a template string was broken
- [ ] run `npm test` and `npm run typecheck` — both must pass before Task 4

### Task 4: Verify acceptance criteria

- [ ] `grep -rnE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(' src index.html` returns hits only in `src/styles.css` `:root` and `src/ui/palette.ts` — any other hit is an unthemed color that survived
- [ ] grep for `dark` across `src/` and `index.html` to confirm no dark-theme remnant (`color-scheme`, comments, class names)
- [ ] confirm `vite.config.ts` still has `test.css.include = [/styles\.css/]`, and that `styles.test.ts`'s `is actually loaded` guard passes — without it the whole palette suite is vacuous
- [ ] run the full suite: `npm test`
- [ ] run `npm run typecheck` (`tsc --noEmit`)
- [ ] run `npm run build` to confirm the production bundle still compiles

### Task 5: Update documentation

- [ ] add a Conventions entry to `CLAUDE.md`: colors live in exactly two places (`:root` in `src/styles.css`, `PALETTE` in `src/ui/palette.ts`); every new color must clear 4.5:1 as text / 3:1 as a graphic against both `--bg` and `--surface`, enforced by `styles.test.ts` and `palette.test.ts` — a raw hex anywhere else fails the suite
- [ ] check `README.md` for any dark-theme or screenshot reference and update it. Note the README↔code coupling: `dashboard.test.ts` diffs the module table, so keep the row shape `` | `#/<route>` | <Module> | ✓ | | | `` intact if that table is touched at all
- [ ] no `docs/content-audit.md` entry — that ledger is for aviation-content fixes, and no content changed

## Post-Completion (manual, not agent-automatable)

- Run `npm run dev` and view every screen in a browser: dashboard, entry drill, entry learn, written test, oral prep, wind lab, clearance copy. jsdom models a simplified cascade and cannot tell you whether the HSI is actually readable.
- Check the instruments outdoors or at high screen brightness — this is a light theme partly so it survives a sunlit cockpit or a kneeboard tablet.
- Confirm the magenta CDI still reads as the conventional GPS magenta at `#a3168f`; if it reads muddy against white, adjust hue but keep the ratio ≥ 4.5:1 and re-run the suite.
