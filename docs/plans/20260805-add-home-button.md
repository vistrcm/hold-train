# Home Button on Every Screen

## Overview
Add a persistent "Home" link that returns the user to `#/` (the home screen listing all activities). Rendered centrally by the router on every screen except home itself, so users never need to edit the URL to get back to the main menu.

## Context
- Files involved:
  - Modify: `src/app/router.ts` — render the nav + screen container in `renderCurrent`
  - Modify: `src/app/router.test.ts` — new assertions; update two exact-textContent assertions
  - Modify: `src/styles.css` — style for the home link using existing `:root` variables only
- Related patterns:
  - Router already owns the home screen and the `''` path; `resolve` falls back to home, so `#/` is always a valid target
  - Screens set `el.innerHTML` on the element passed to `render` — the router must pass them a child container so the nav survives
  - `styles.test.ts` bans colour literals outside `:root` and requires every `var(--x)` to be defined; reuse existing variables (`--accent`/`--ink` family), no new colours
  - `main.test.ts` exercises the real registry's default render path — must stay green
- Dependencies: none (zero-dependency project, vanilla TS)

## Development Approach
- **Testing approach**: TDD (test first) — project policy per CLAUDE.md
- Complete each task fully before moving to the next
- `npm test` AND `npm run typecheck` must both pass before a task is done (vitest does not type-check)
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Implementation Steps

### Task 1: Router renders a home link on every non-home screen

**Files:**
- Modify: `src/app/router.test.ts`
- Modify: `src/app/router.ts`

- [x] Write failing tests in `router.test.ts`: (a) rendering a module route puts an `<a href="#/">` home link in the root; (b) rendering the home screen does NOT include the home link; (c) the screen's own content still renders alongside the nav; (d) following a hashchange back to `''` re-renders home without the link
- [x] Update the two existing assertions that expect `root.textContent` to equal exactly the screen title (`renderCurrent renders the screen...`, `re-renders when the hash changes`) to `toContain`, and additionally assert the home link is present — the nav text is now part of root
- [x] Implement in `router.ts` `renderCurrent`: clear root; if the resolved screen is not home, append a `<nav>` containing `<a class="home-link" href="#/">← Home</a>`; append a child `<div>` and call `screen.render` on that div (screens own their container's innerHTML, so the nav must be a sibling, not inside it)
- [x] Run `npm test` and `npm run typecheck` — must pass before Task 2

### Task 2: Style the home link within the colour-guard rules

**Files:**
- Modify: `src/styles.css`

- [x] Add a `.home-link` rule (or a `nav` rule scoped to the router nav) using only existing `:root` custom properties for any colour — no literals, no new variables (avoids extending the contrast TIERS map)
- [x] Keep it a text link (4.5:1 text contrast is already satisfied by the existing ink/accent variables against both `--bg` and `--surface`); do not introduce a filled/bordered component, which would trigger the SC 1.4.11 boundary rules
- [x] Confirm `styles.test.ts` still passes (colour-literal sweep, `var()` definedness) — it asserts against the stylesheet text, so no new test file is needed; add a `var(--…)` reference only to variables that exist
- [x] Run `npm test` and `npm run typecheck` — must pass before Task 3

### Task 3: Verify acceptance criteria

- [ ] Run full test suite: `npm test`
- [ ] Run `npm run typecheck` (`tsc --noEmit`)
- [ ] Verify `main.test.ts` default-path test still passes (real registry, real render path — proves the nav renders without breaking any registered screen)

### Task 4: Update documentation

- [ ] Check README.md: the asserted route table's row shape is unchanged (no new routes), so no table edit; add a one-line mention of the home navigation only if README describes navigation at all
- [ ] No CLAUDE.md change — no new internal pattern (router remains the single owner of chrome around screens)
