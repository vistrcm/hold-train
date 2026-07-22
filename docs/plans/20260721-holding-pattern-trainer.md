# Holding Pattern Trainer

## Overview
- A web application that trains an FAA instrument-rating student (G1000 C182, KHAF, Jeppesen) on everything holding-pattern related: entry determination, clearance copying, wind correction and timing, written-test question formats, oral-exam knowledge, and G1000 procedures.
- Problem it solves: existing trainers are native-app-only (PilotsCafe, FlyGo, Holding Pattern Computer), calculator-only, or rote-lookup (Sheppard Air). Nothing browser-based teaches concepts, drills wind correction, maps drills to ACS elements, or exports to Anki (`docs/research-web.md`).
- Primary goal: **teach the user**. Secondary goal: **simplicity and correctness** — no wrong facts, no wrong geometry; an app that teaches a wrong entry sector is worse than no app (negative training before an exam).
- Integrates with nothing external: static single-page app, Vanilla TypeScript + SVG, Vite build, Vitest tests, localStorage persistence, phone/tablet-friendly responsive layout. No backend, no PWA, no deploy pipeline in this plan.

## Context (from discovery)
- Repo is empty except research: `docs/research-claude.md` (FAA-verified holding rules: AIM 5-3-8 verbatim geometry, ACS-8C Task III.B elements, speeds/timing/entries, G1000 SUSP/OBS, KHAF-local holds at OSI/SEEMS/GOBBS) and `docs/research-web.md` (verified pedagogy, competitor, and exam-format findings — see its "Design implications distilled").
- All app content (facts, question explanations, oral answers, Anki cards) must trace to these two documents; both cite primary FAA sources.
- Key reference cases for TDD live in the research: entry sectors (180° direct / 70° teardrop / 110° parallel around the 70° line, ±5° boundary tolerance, nonstandard mirroring per AIM 5-3-8 j3(e)), DME leg worked examples (fix 10 DME + 5 NM legs → turn at 15 DME; fix 28 DME inbound-away + 8 NM legs → turn at 20 DME), the classic 160-radial → 230-radial divider example, triple-drift 8°→24° example, timing rules, max speeds 200/230/265.

## Development Approach
- **testing approach**: TDD — reference-case tests written first for every engine and content module, then implementation until green.
- complete each task fully before moving to the next
- make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
  - tests are not optional - they are a required part of the checklist
  - write unit tests for new functions/methods
  - write unit tests for modified functions/methods
  - add new test cases for new code paths
  - update existing test cases if behavior changes
  - tests cover both success and error scenarios
- **CRITICAL: all tests must pass before starting next task** - no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- run tests after each change
- maintain backward compatibility (localStorage schema carries a version field from day one)
- **Correctness rules specific to this project:**
  - every user-visible aviation fact carries a `source` field (e.g., `"AIM 5-3-8 j2"`) rendered in the UI next to the fact
  - geometry/engine code is validated by golden cases hand-derivable from `docs/research-claude.md` §5–§10 plus property tests (sectors sum to 360°, nonstandard is an exact mirror of standard, entry at the inbound course heading is always direct)
  - the ±5° AIM boundary tolerance is modeled explicitly: near-boundary headings return a primary entry plus acceptable alternates, and drill grading accepts any of them (mirrors real test answers keyed "parallel or teardrop")
  - clearance phrasing always disambiguates radial (FROM) vs bearing/course (TO) — the documented trap from `research-web.md` finding 7
  - a dedicated content-verification task (Task 19) cross-checks every content string against the research docs before acceptance

## Testing Strategy
- **unit tests**: Vitest, required for every task. Engine modules (pure TS, no DOM) get exhaustive golden + property tests. UI modules get jsdom-based tests for logic (grading, state transitions, rendering of key values) — not pixel testing.
- **e2e tests**: none initially — no e2e framework is added, to honor the simplicity goal. UI behavior is covered by jsdom unit tests; a manual smoke-test checklist on a phone-width viewport is part of Task 20 and Post-Completion.
- test command: `npm test` (vitest run)

## Progress Tracking
- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix
- document issues/blockers with ⚠️ prefix
- update plan if implementation deviates from original scope
- keep plan in sync with actual work done

## Solution Overview
- **One geometry engine, many thin drill modules.** A pure-TypeScript `engine/` package (no DOM imports) is the single source of truth for headings, sectors, clearances, wind, and the decision sim. Every module — drills, quizzes, sim, debrief — consumes it. This maximizes the power/complexity ratio: the hard, correctness-critical math is written and tested once.
- **Content as typed data.** Questions, oral answers, lessons, G1000 sequences, and Anki cards are plain typed arrays in `src/content/`, each entry tagged with `source` (FAA citation) and `acs` (ACS element code). No CMS, no markdown pipeline.
- **Decision sim, not flight sim.** In the Wind & Timing Lab the user makes pilot decisions (entry, outbound heading, crab, timing); the engine flies a fixed-TAS aircraft through the wind field and draws the actual ground track over the racetrack and protected-airspace outline for debrief. Trains the decisions the checkride tests without flight-model complexity.
- **Modules follow the proven instructional sequence** (`research-claude.md` §16): Learn (concept → geometry → entries → timing/wind → radio → G1000) → drills → exam prep, with the app's home screen presenting them in that order and a dashboard tracking the research-doc benchmarks (e.g., 18/20 entries in <10 s).
- **UI: hash-based router, one screen per module, two shared SVG components** (HSI with thumb overlay; top-down map). Vanilla TS DOM code, mobile-first CSS, large touch targets.

## Technical Details
- **Stack**: TypeScript (strict), Vite, Vitest (+ jsdom for UI tests), no runtime dependencies. Target: evergreen mobile + desktop browsers.
- **Core types** (`src/engine/types.ts`):
  - `HoldSpec` — fix name, inbound course (course TO the fix), turn direction, leg spec ({ minutes } | { nm }), fix type (VOR | intersection | GPS waypoint), charted/uncharted, EFC, max-speed restriction
  - `Clearance` — structured fields matching AIM 5-3-8 i element order (direction, fix, radial/course/bearing, leg length, turns, EFC) plus generated phraseology text
  - `Wind` — direction-from (°true treated as magnetic for training purposes), speed kt
  - `EntryResult` — primary entry + acceptable alternates (±5° boundary), sector boundaries for visualization
- **Entry math** (`src/engine/entry.ts`): sectors computed from heading-relative geometry per AIM 5-3-8 j3 — direct 180°, teardrop 70° (holding side, adjacent to outbound), parallel 110° (non-holding side); nonstandard mirrors per j3(e). Formula derived by drawing first (research caveat: sign conventions are easy to invert), then locked with golden tests.
- **Wind math** (`src/engine/wind.ts`): inbound crab from wind triangle at C182 speeds (~90–100 KTAS holding); outbound heading = triple drift (AIM reference answer; UI notes the double-drift field technique as an alternative, flagged as such); outbound timing adjusted ~1 s per kt of wind component toward a 60 s inbound leg; DME legs end on distance not time.
- **Sim** (`src/engine/sim.ts`): fixed-timestep integrator (1 s steps); state = position, heading; turns at standard rate; wind vector added each step; outputs ground-track polyline + inbound leg time + max lateral excursion vs a simplified protected-area outline (teaching approximation, labeled as such in the UI).
- **Persistence** (`src/app/store.ts`): localStorage, versioned JSON `{ v: 1, drills: {...}, misses: [...] }`; misses feed the Anki "my misses" export.
- **Anki export**: TSV (tab-separated, `front\tback\ttags`) downloaded as a Blob — imports directly into Anki. Two decks: the fixed ROTE/TRAP/SAFETY deck from `research-claude.md` call-outs, and a personalized deck generated from the user's missed drill items.
- **Processing flow**: home → module screen → engine generates scenario → user answers → engine grades (dual-correct aware) → explanation with sector overlay + FAA citation → stats stored → dashboard aggregates vs benchmarks.

## What Goes Where
- **Implementation Steps** (`[ ]` checkboxes): tasks achievable within this codebase - code changes, tests, documentation updates
- **Post-Completion** (no checkboxes): items requiring external action - manual testing, changes in consuming projects, deployment configs, third-party verifications

## Implementation Steps

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.ts`, `src/app/router.ts`, `src/styles.css`
- Create: `src/app/router.test.ts`
- Create: `.gitignore`

- [ ] init Vite + TypeScript (strict) + Vitest with jsdom; `npm test` and `npm run dev` work
- [ ] hash-based router: registry of module screens, renders active screen into `#app`, default route = home
- [ ] mobile-first base styles: readable type scale, ≥44 px touch targets, single-column layout that widens on desktop
- [ ] home screen listing the planned modules in instructional order (placeholders)
- [ ] write tests for router (route match, default route, unknown-route fallback)
- [ ] run tests - must pass before task 2

### Task 2: Course math utilities

**Files:**
- Create: `src/engine/geometry.ts`
- Create: `src/engine/geometry.test.ts`

- [ ] write tests first: normalize (0/360 wrap, negatives), signed angular difference, reciprocal, cardinal direction ↔ course (8-point, e.g., "east of" ↔ hold on the 090 side), radial↔course-to-fix conversion (radial 160 FROM = course 340 TO)
- [ ] implement `normalizeDeg`, `angleDiff`, `reciprocal`, `cardinalFromCourse` / `courseFromCardinal`, `radialToInboundCourse`
- [ ] add error-case tests (NaN, out-of-range inputs rejected)
- [ ] run tests - must pass before task 3

### Task 3: Entry determination engine

**Files:**
- Create: `src/engine/entry.ts`
- Create: `src/engine/entry.test.ts`

- [ ] write golden tests first, hand-derived by drawing (per research caveat on sign conventions): standard-pattern cases in all three sectors, exact sector boundaries, the 160-radial → 230-divider classic, nonstandard mirror cases from `research-claude.md` §5
- [ ] write property tests: sectors sum to 360°; heading equal to inbound course → direct; nonstandard result is exact mirror of standard; boundary ±5° always yields ≥2 acceptable entries
- [ ] implement `determineEntry(heading, holdSpec): EntryResult` returning primary entry, acceptable alternates within ±5° of a boundary, and sector boundary angles for visualization
- [ ] implement teardrop/parallel guidance data (teardrop offset = 30° toward holding side; parallel reintercept turns opposite the pattern) with tests
- [ ] run tests - must pass before task 4

### Task 4: Clearance model — generator and answer key

**Files:**
- Create: `src/engine/clearance.ts`
- Create: `src/engine/clearance.test.ts`

- [ ] write tests first: generated phraseology follows AIM 5-3-8 i element order; turn direction stated only for left turns; "as published" form emits only direction + AS PUBLISHED + EFC; leg length in miles only when DME/RNAV; radial (FROM, VOR holds) vs course/bearing (TO, intersection/GPS holds) wording is explicit and internally consistent with the derived `HoldSpec`
- [ ] implement `generateClearance(seedParams): { clearance, holdSpec, expectedFields }` — random but reproducible (seeded) scenario generation across fix types, standard/nonstandard, timed/DME legs
- [ ] implement `gradeCopiedClearance(userFields, expectedFields)` with per-field results, treating omitted turn direction as right turns (the trap)
- [ ] write error/edge tests: contradictory field combinations rejected; grading flags the standard-turns trap distinctly
- [ ] run tests - must pass before task 5

### Task 5: Wind and timing engine

**Files:**
- Create: `src/engine/wind.ts`
- Create: `src/engine/wind.test.ts`

- [ ] write tests first from research worked examples: 8° left inbound crab → 24° right outbound (AIM verbatim example); zero wind → zero crab and 60 s legs; DME-leg endpoints (fix 10 DME + 5 NM → 15 DME; fix 28 DME inbound-away + 8 NM → 20 DME); timing adjustment direction for head/tailwind outbound (~1 s per kt)
- [ ] implement wind triangle: `inboundCrab(wind, tas, course)`, `outboundHeading(inboundCrab)` (triple drift), `outboundTimeSeconds(wind, course, targetInbound=60)`
- [ ] implement DME/ATD leg endpoint calculator for toward/away NAVAID geometries
- [ ] write edge tests: direct crosswind, wind aligned with course, wind speed near TAS rejected with clear error
- [ ] run tests - must pass before task 6

### Task 6: Decision-sim integrator

**Files:**
- Create: `src/engine/sim.ts`
- Create: `src/engine/sim.test.ts`

- [ ] write tests first: no-wind sim of a correctly-flown standard hold produces ~60 s inbound leg and closed racetrack (within tolerance); known-wind sim with textbook triple-drift decisions yields inbound leg within a few seconds of 60; deliberately wrong decisions (no crab) show measurable drift
- [ ] implement fixed-timestep integrator: standard-rate turns, fixed TAS (C182 holding ≈ 95 KTAS), wind vector per step; pilot decisions as input script (entry type, outbound heading, crab, outbound seconds)
- [ ] implement ground-track output (polyline) + measured inbound-leg time + turn anticipation at the fix
- [ ] implement simplified protected-area outline (holding side vs non-holding side extents, labeled as a teaching approximation per `research-claude.md` §2) and excursion detection, with tests
- [ ] run tests - must pass before task 7

### Task 7: Progress store

**Files:**
- Create: `src/app/store.ts`
- Create: `src/app/store.test.ts`

- [ ] write tests first: versioned schema round-trip; per-drill stats accumulation (attempts, correct, avg answer time); miss recording with scenario snapshot; corrupt/missing localStorage falls back to empty state without throwing
- [ ] implement `loadState` / `saveState` / `recordDrillResult` / `recordMiss` over localStorage with schema `{ v: 1, ... }`
- [ ] implement benchmark evaluation helpers (e.g., last-20 entry accuracy and median time vs the §16 benchmarks: 18/20 under 10 s, 95% under 15 s)
- [ ] write error tests (quota exceeded → in-memory fallback, version mismatch → migration stub)
- [ ] run tests - must pass before task 8

### Task 8: HSI SVG component

**Files:**
- Create: `src/ui/hsi.ts`
- Create: `src/ui/hsi.test.ts`

- [ ] write tests first (jsdom): compass rose rotates so heading is up; course pointer at correct rose position for given course; lubber line fixed; thumb overlay renders on the 3 o'clock side for standard and 9 o'clock for nonstandard, spanning 20° starting at the 70° line
- [ ] implement `renderHSI(el, { heading, course, thumbOverlay, sectorOverlay })` as pure-function SVG rendering (state in, SVG out; no internal state)
- [ ] implement sector overlay (direct/teardrop/parallel wedges colored, boundaries from `EntryResult`) used by drill explanations
- [ ] touch-friendly sizing: scales to container width, works at 320 px viewport
- [ ] write tests for sector overlay angles matching engine output for standard and nonstandard cases
- [ ] run tests - must pass before task 9

### Task 9: Map-view SVG component

**Files:**
- Create: `src/ui/mapview.ts`
- Create: `src/ui/mapview.test.ts`

- [ ] write tests first (jsdom): racetrack drawn on the holding side of the inbound course; fix at expected position; standard vs nonstandard mirror; ownship arrow at given position/heading; polyline ground track rendered from sim output; protected-area outline on correct sides
- [ ] implement `renderMap(el, { holdSpec, ownship?, track?, ghostTrack?, protectedArea? })` — north-up top-down view with scale suited to 1-minute legs at 95 KTAS
- [ ] implement entry-path illustration mode (draws the direct/teardrop/parallel path for a given arrival heading) for Learn and drill explanations
- [ ] write tests for entry-path geometry (teardrop offset 30° toward holding side; parallel on non-holding side with opposite-direction reintercept)
- [ ] run tests - must pass before task 10

### Task 10: Entry drill module

**Files:**
- Create: `src/modules/entry-drill.ts`
- Create: `src/modules/entry-drill.test.ts`
- Modify: `src/app/router.ts`

- [ ] write tests first: seeded scenario generation (mix of standard/nonstandard, fix types, diagram-style and heading+clearance-style prompts); grading accepts primary and boundary-alternate entries; timer captured per answer; miss recorded with full scenario; explanation payload includes sector overlay + citation
- [ ] implement drill screen: clearance text + HSI (heading set) + optional map toggle; three-button answer (direct/teardrop/parallel) sized for touch; instant feedback with sector overlay on the HSI and correct-path drawing on the map
- [ ] implement two practice modes: untimed learn mode (aid overlays available — thumb/sectors, legitimate for written-test practice per Order 8080.6H) and timed cockpit mode (no aids, 15 s target)
- [ ] wire per-session and stored stats vs benchmarks (18/20 <10 s; 95% <15 s)
- [ ] write error/edge tests (answering after timeout, repeated scenario seeds, nonstandard grading mirror)
- [ ] run tests - must pass before task 11

### Task 11: Clearance copy module

**Files:**
- Create: `src/modules/clearance-copy.ts`
- Create: `src/modules/clearance-copy.test.ts`
- Modify: `src/app/router.ts`

- [ ] write tests first: field-by-field grading display; standard-turns trap surfaced when user marks "left" for a clearance that omitted turn direction; "as published" clearances grade only the fields they contain; TO/FROM micro-drill grading (given a bearing TO or radial FROM, place the aircraft's side of the fix)
- [ ] implement copy screen: clearance shown briefly (then hidden, like real radio) → structured input form (direction, fix, radial/course, legs, turns, EFC) → graded review with AIM element-order explanation and citations
- [ ] implement the radial-vs-bearing micro-drill mode (the documented CFII trap from `research-web.md` finding 7)
- [ ] record misses to the store for Anki export
- [ ] write edge tests (partial answers, re-show clearance counts as an assist in stats)
- [ ] run tests - must pass before task 12

### Task 12: Wind & Timing Lab (decision sim)

**Files:**
- Create: `src/modules/wind-lab.ts`
- Create: `src/modules/wind-lab.test.ts`
- Modify: `src/app/router.ts`

- [ ] write tests first: scenario generation (hold + wind); decision inputs validated; sim invoked with user decisions; debrief computes inbound-leg time delta, drift assessment, protected-area excursions; ACS-tolerance framing in the grade (headings ±10°); next-circuit suggestion (adjust outbound time toward 60 s inbound) matches engine math
- [ ] implement the predict step: user states expected inbound crab, outbound heading (triple drift), and outbound time before flying (mirrors the CFI Notebook "predict wind effect" exercise)
- [ ] implement the fly step: engine runs the circuit; map view animates ownship along the track with a ghost ideal track
- [ ] implement the debrief: measured vs target numbers, wind-triangle explanation, triple-vs-double drift note (FAA reference answer = triple, field technique = double, labeled per research), iterate button for next circuit carrying corrections forward
- [ ] record results/misses; write edge tests (extreme winds capped, DME-leg scenarios end on distance)
- [ ] run tests - must pass before task 13

### Task 13: Written-test question bank and exam module

**Files:**
- Create: `src/content/questions.ts`
- Create: `src/modules/written-test.ts`
- Create: `src/content/questions.test.ts`, `src/modules/written-test.test.ts`
- Modify: `src/app/router.ts`

- [ ] write content-validation tests first: every question has ≥3 options, exactly one keyed answer (or dual-keyed like "parallel or teardrop" where the geometry is near-boundary — validated against the engine), an explanation, and a `source` citation; entry questions' keyed answers MUST match `determineEntry` output (engine is the answer oracle — no hand-keyed entry answers)
- [ ] author ~40 original questions in FAA IRA style across the researched formats: diagram-based entry determination (generated figures, standalone-hold style), missed-approach-hold entries on simplified chart excerpts (incl. KHAF RNAV 30 → SEEMS, OSI climb-in-hold from `research-claude.md` §16), max speeds (200/230/265, the (175) icon), timing (1 vs 1½ min, outbound-start rule), required reports, EFC/lost-comm (91.185(c)(3) scenarios), standard-vs-nonstandard identification
- [ ] implement exam-sim mode: fixed-length quiz, literal option formats (including "parallel or teardrop" options), no aids, score report mapped to weak areas
- [ ] implement practice mode: immediate explanation + citation per question; misses recorded
- [ ] run tests - must pass before task 14

### Task 14: Oral-exam prep module

**Files:**
- Create: `src/content/oral.ts`
- Create: `src/modules/oral-prep.ts`
- Create: `src/content/oral.test.ts`, `src/modules/oral-prep.test.ts`
- Modify: `src/app/router.ts`

- [ ] write content-validation tests first: every item has an ACS element tag (IR.III.B.K1, R1–R4, S1–S8), a model answer, and a `source`; coverage test asserts every ACS Task III.B element has ≥1 item
- [ ] author oral Q&A content from `research-claude.md` §15 model answers + §3/§12/§14 (clearance elements, reports, lost comm, fuel/EFC ADM incl. Avianca 052 framing, protected-airspace explanation, G1000 will/won't and when to intervene)
- [ ] implement self-test flow: question shown → user reveals model answer → self-grades (got it / partially / missed); missed items recorded for Anki export
- [ ] implement browse-by-ACS-element view (the "explain" side of Task III.B)
- [ ] run tests - must pass before task 15

### Task 15: G1000 chair-fly module

**Files:**
- Create: `src/content/g1000.ts`
- Create: `src/modules/g1000-drill.ts`
- Create: `src/content/g1000.test.ts`, `src/modules/g1000-drill.test.ts`
- Modify: `src/app/router.ts`

- [ ] write content-validation tests first: each procedure is an ordered step sequence with per-step explanation and `source`; distractor steps defined per step; software-version-dependent features (Hold at Waypoint / Present Position) carry the verify-your-unit caveat flag
- [ ] author the two checkride-critical sequences from `research-claude.md` §13: published hold/HILPT with SUSP behavior (auto-suspend, extra circuits, exit), and ATC-assigned uncharted hold via OBS + course knob (GOBBS-style), plus the fly-by/ground-track/outbound-long GPS caveats as quiz items
- [ ] implement step-sequencing drill: "what do you do next?" multiple choice through each sequence, wrong choices explained
- [ ] record misses; write edge tests (sequence restart, caveat flags rendered)
- [ ] run tests - must pass before task 16

### Task 16: Learn module (guided lessons)

**Files:**
- Create: `src/content/lessons.ts`
- Create: `src/modules/learn.ts`
- Create: `src/content/lessons.test.ts`, `src/modules/learn.test.ts`
- Modify: `src/app/router.ts`

- [ ] write content-validation tests first: lessons ordered per the instructional sequence (`research-claude.md` §16: why → anatomy → entries → timing/wind → radio → G1000); every factual paragraph carries a `source`; every lesson ends with a mini-drill reference to an existing module
- [ ] author lesson content: purpose/safety framing (Avianca, protected side over entry aesthetics), anatomy/terminology with interactive map figure, entry determination teaching all methods with the thumb-method HSI overlay as flagship (+ draw-it map exercise, CDI-twist note for G1000 workflow), timing/wind, reports/phraseology, 5 Ts flow
- [ ] implement lesson screens using the HSI and map components interactively (rotate heading → watch sector highlight change; drag wind → watch racetrack distort)
- [ ] link each lesson's mini-drill into the corresponding drill module with a preset scenario
- [ ] run tests - must pass before task 17

### Task 17: Anki export

**Files:**
- Create: `src/content/anki-deck.ts`
- Create: `src/app/anki-export.ts`
- Create: `src/app/anki-export.test.ts`, `src/content/anki-deck.test.ts`
- Modify: `src/app/router.ts` (export screen/home entry)

- [ ] write tests first: TSV output escapes tabs/newlines in fields; every fixed-deck card has front/back/tags (tags = topic + ACS element); miss-deck generation converts stored misses (entry scenarios, clearance fields, oral items, G1000 steps) into cards with the scenario embedded in the front
- [ ] author the fixed deck from `research-claude.md` Anki-ready call-outs (ROTE verbatim numbers, TRAPS, SAFETY-CRITICAL) with citations on card backs
- [ ] implement TSV Blob download (one file per deck: `hold-train-core.tsv`, `hold-train-misses.tsv`) with in-app import instructions for Anki
- [ ] write edge tests (empty miss list → informative empty state, not an empty file)
- [ ] run tests - must pass before task 18

### Task 18: Progress dashboard and home screen

**Files:**
- Create: `src/modules/dashboard.ts`
- Create: `src/modules/dashboard.test.ts`
- Modify: `src/app/router.ts`, `src/main.ts` (home = dashboard)

- [ ] write tests first: benchmark computation per module from stored stats (entry: last-20 accuracy + median time vs 18/20 <10 s and 95% <15 s targets; written: last exam-sim score; oral: ACS-element coverage of "got it" self-grades); stage-gate display mirrors `research-claude.md` Recommendations stages 1–5
- [ ] implement dashboard: per-module readiness cards with the specific benchmark numbers and what to drill next
- [ ] implement "exam readiness" summary view (written / oral / flight columns mapping modules to ACS Task III.B elements)
- [ ] make dashboard the home screen with the instructional-order module list
- [ ] run tests - must pass before task 19

### Task 19: Content verification pass

**Files:**
- Modify: `src/content/*.ts` (fixes only)
- Create: `docs/content-audit.md`

- [ ] cross-check every string in `src/content/` against `docs/research-claude.md` / `docs/research-web.md`: numbers (speeds, times, sectors, tolerances), rule statements, phraseology examples, citations — record each check in `docs/content-audit.md` with pass/fixed status
- [ ] verify every entry-question keyed answer is engine-generated (grep for hand-keyed entry answers; none allowed)
- [ ] verify all caveat-flagged content renders its caveat (double-vs-triple drift, G1000 software-version features, protected-area approximation, ±5° vs 10° buffer)
- [ ] fix any discrepancies found; add regression tests for each fix
- [ ] run tests - must pass before task 20

### Task 20: Verify acceptance criteria
- [ ] verify all requirements from Overview are implemented (all modules, Anki export replaces in-app flashcards, phone/tablet layout)
- [ ] verify edge cases are handled (nonstandard mirrors everywhere, boundary dual-correct grading, standard-turns trap, TO/FROM)
- [ ] run full test suite: `npm test`
- [ ] manual smoke test at 320/768/1280 px widths: every module usable, touch targets adequate
- [ ] verify test coverage of `src/engine/` is comprehensive (every exported function has golden + edge tests)

### Task 21: [Final] Update documentation
- [ ] write README.md: what the app trains, module map to exam phases, how to run (`npm run dev`), how to import the Anki decks, correctness/source policy
- [ ] create CLAUDE.md: engine-is-the-oracle rule, content `source` field convention, TDD policy, no-new-dependencies bias
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion
*Items requiring manual intervention or external systems - no checkboxes, informational only*

**Manual verification:**
- User drills each module and reports anything that contradicts their CFII's teaching or current Jeppesen charts (local procedures amend frequently — verify OSI/SEEMS/GOBBS holds against current charts before relying on those scenarios)
- Cross-check a sample of app-generated entry answers against the Holding Pattern Computer (holdingpattern.com) as an independent oracle, per `research-claude.md` §16
- Import both Anki decks into the user's actual Anki setup and confirm formatting
- Phone/tablet ergonomics check on the user's real devices

**External system updates:**
- Hosting/deployment (GitHub Pages or similar) deliberately out of scope — decide after the app proves useful locally
- Optional future plan: PWA/offline support if airport-use demand materializes
