# Holding Pattern Trainer

## Overview
- A web application that trains an FAA instrument-rating student (C172 around KTCY; G1000 avionics assumed — confirm on the actual club aircraft) on holding patterns: entry determination, realistic clearances, wind correction and timing, written-test question formats, and oral-exam knowledge.
- Chart data source: **free public FAA dTPP charts** (KTCY/KLVK procedures). The user flies with Jeppesen plates — no Jeppesen data is used or available; where chart depiction is taught, note Jeppesen-vs-FAA styling differences (e.g., bold HILPT racetrack, 45/45 PT barb) so the FAA-styled figures transfer to the Jepp plates in the cockpit.
- Problem it solves: existing trainers are native-app-only (PilotsCafe, FlyGo, Holding Pattern Computer), calculator-only, or rote-lookup (Sheppard Air). Nothing browser-based teaches concepts, drills wind correction, maps drills to ACS elements, or exports to Anki (`docs/research-web.md`).
- Primary goal: **teach the user, efficiently** — checkride is ~1 month out with limited daily study time. Secondary goal: **simplicity and correctness** — no wrong facts, no wrong geometry; an app that teaches a wrong entry sector is negative training.
- **Priority principle (hard rule):** tasks are tiered P0 → P1 → P2. Each tier ends with a working, useful app. Build P0 completely before touching P1; P2 is cut unless time clearly remains. Do not gold-plate; do not implement things that don't move exam readiness, even if listed here.
- Static single-page app: Vanilla TypeScript + SVG, Vite build, Vitest tests, localStorage persistence, phone/tablet-friendly. No backend, no PWA, no deploy pipeline in this plan.

## Context (from discovery)
- Repo contains research only: `docs/research-claude.md` and `docs/research-web.md`. These are convenient, cited compilations — **the source of truth is always the FAA primary sources they point to** (AIM 5-3-8/5-3-3, 14 CFR 91.185/91.167, FAA-S-ACS-8C Task III.B, FAA JO 7110.65 for controller phraseology). **ACS is the exam standard** — drills and content map to ACS element codes.
- ⚠️ Locale correction: the research docs assumed a G1000 C182 based at KHAF (OSI/SEEMS/GOBBS scenarios). Actual training context: **C172 around KTCY** — local scenarios must be built from **current FAA charts** for **KTCY RNAV (GPS) RWY 12** (its missed-approach hold; circle-to-land RWY 30 is the usual arrival) and **KLVK** procedures. Do not reuse the KHAF examples.
- Key TDD reference cases (verify against AIM before locking): entry sectors 180° direct / 70° teardrop / 110° parallel around the 70° line, ±5° boundary tolerance, nonstandard mirroring (AIM 5-3-8 j3(e)); DME worked examples (fix 10 DME + 5 NM legs → turn at 15 DME; fix 28 DME inbound-away + 8 NM → 20 DME); 160-radial → 230-divider classic; triple drift 8°→24°; timing rules; max speeds 200/230/265.

## Development Approach
- **testing approach**: TDD — reference-case tests first for engine and content modules, then implement until green.
- complete each task fully before moving to the next; make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
  - unit tests for new/modified functions; new cases for new code paths; success and error scenarios
- **CRITICAL: all tests must pass before starting next task** - no exceptions
- **CRITICAL: update this plan file when scope changes during implementation**
- maintain backward compatibility (localStorage schema carries a version field from day one)
- **Correctness rules specific to this project:**
  - every user-visible aviation fact carries a `source` field citing the **FAA primary source** (e.g., `"AIM 5-3-8 j2"`), rendered in the UI
  - content is verified **against FAA publications directly (plus reputable internet cross-checks)** — the research docs are an index into sources, not the authority
  - geometry/engine code validated by golden cases hand-derived by drawing + property tests (sectors sum to 360°; nonstandard mirrors standard; heading = inbound course → direct)
  - ±5° AIM boundary tolerance modeled explicitly: near-boundary headings return primary entry + acceptable alternates; grading accepts any (mirrors real test answers keyed "parallel or teardrop")
  - **clearance phraseology must sound like a real controller** — generated exactly as heard on the checkride and from NorCal: format per AIM 5-3-8 i element order and FAA JO 7110.65 holding-instruction phraseology (verify exact paragraph in the current order during implementation); always disambiguates radial (FROM) vs bearing (TO)
  - dedicated content-verification task cross-checks every content string against FAA sources before acceptance

## Testing Strategy
- **unit tests**: Vitest, required for every task. Engine modules (pure TS, no DOM) get exhaustive golden + property tests. UI modules get jsdom-based tests for logic (grading, state transitions) — not pixel testing.
- **e2e tests**: none — no e2e framework, honoring the simplicity/time budget. Manual smoke-test checklist at phone width in the acceptance task.
- test command: `npm test` (vitest run)

## Progress Tracking
- mark completed items with `[x]` immediately when done
- add newly discovered tasks with ➕ prefix; blockers with ⚠️ prefix
- update plan if implementation deviates from original scope

## Solution Overview
- **One geometry engine, many thin drill modules.** A pure-TypeScript `engine/` package (no DOM) is the single source of truth for headings, sectors, clearances, wind. Every module consumes it; quiz answer keys are engine-generated (the engine is the oracle — no hand-keyed entry answers).
- **Content as typed data.** Questions, oral answers, Anki cards are plain typed arrays in `src/content/`, each tagged `source` (FAA citation) and `acs` (ACS element code).
- **Decision sim, not flight sim** (P1). User makes pilot decisions (entry, outbound heading, crab, timing); the engine flies fixed-TAS through wind and draws the actual ground track for debrief. Trains checkride decisions without flight-model complexity.
- **Realistic instrument look.** The HSI component approximates the real aircraft instrument, clean and uncluttered — load the `frontend-design` skill and study real HSI/G1000 depictions before drawing it.
- **UI**: hash router, one screen per module, shared SVG HSI (+ map view in P1). Vanilla TS DOM, mobile-first CSS, large touch targets.

## Technical Details
- **Stack**: TypeScript (strict), Vite, Vitest (+ jsdom), no runtime dependencies.
- **Core types** (`src/engine/types.ts`): `HoldSpec` (fix, inbound course TO fix, turn direction, leg spec {minutes}|{nm}, fix type, EFC, max-speed restriction), `Clearance` (structured AIM 5-3-8 i fields + phraseology text), `Wind` (direction-from, kt), `EntryResult` (primary entry + acceptable alternates + sector boundaries for visualization).
- **Entry math** (`src/engine/entry.ts`): sectors per AIM 5-3-8 j3; formula derived by drawing first (sign conventions are easy to invert), then locked with golden tests.
- **Wind math** (`src/engine/wind.ts`, P1): wind triangle at C172 holding speed (~90 KTAS); triple drift outbound (FAA reference answer; double-drift noted as field technique); outbound timing ~1 s/kt toward 60 s inbound; DME legs end on distance.
- **Persistence** (`src/app/store.ts`): localStorage, versioned `{ v: 1, drills, misses }`; misses feed the Anki "my misses" export.
- **Anki export**: TSV (`front\tback\ttags`) Blob download — imports directly into Anki. Fixed core deck + personalized misses deck.

## What Goes Where
- **Implementation Steps** (`[ ]` checkboxes): code, tests, docs in this repo — tiered P0/P1/P2.
- **Post-Completion** (no checkboxes): manual verification and external actions.

## Implementation Steps

### P0 — exam-critical core (build first; app is useful after Task 8)

### Task 1: Project scaffold [P0]

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.ts`, `src/app/router.ts`, `src/styles.css`, `src/app/router.test.ts`
- Create: `.gitignore`

- [x] init Vite + TypeScript (strict) + Vitest with jsdom; `npm test` and `npm run dev` work
- [x] hash-based router: registry of module screens, default route = home listing modules
- [x] mobile-first base styles: readable type scale, ≥44 px touch targets
- [x] write tests for router (route match, default route, unknown-route fallback)
- [x] run tests - must pass before task 2

### Task 2: Course math utilities [P0]

**Files:**
- Create: `src/engine/geometry.ts`, `src/engine/geometry.test.ts`

- [x] write tests first: normalize (0/360 wrap, negatives), signed angular difference, reciprocal, cardinal ↔ course (8-point), radial↔inbound-course conversion (radial 160 FROM = course 340 TO)
- [x] implement `normalizeDeg`, `angleDiff`, `reciprocal`, `cardinalFromCourse`/`courseFromCardinal`, `radialToInboundCourse`
- [x] add error-case tests (NaN, out-of-range rejected)
- [x] run tests - must pass before task 3

### Task 3: Entry determination engine [P0]

**Files:**
- Create: `src/engine/entry.ts`, `src/engine/entry.test.ts`

- [x] write golden tests first, hand-derived by drawing and checked against AIM 5-3-8 j3: all three sectors standard, exact boundaries, 160-radial → 230-divider classic, nonstandard mirrors
- [x] write property tests: sectors sum to 360°; heading = inbound course → direct; nonstandard = exact mirror; ±5° boundary always yields ≥2 acceptable entries
- [x] implement `determineEntry(heading, holdSpec): EntryResult` (primary + alternates + sector boundaries)
- [x] implement teardrop/parallel guidance data (teardrop offset 30° toward holding side; parallel reintercept opposite the pattern) with tests
- [x] run tests - must pass before task 4
- ➕ verified against AIM 5-3-8 text and FIG 5-3-4 image fetched from faa.gov during implementation; the ±5° tolerance is verbatim in AIM 5-3-8 (recommended pilot actions, j8). Note: the "160-radial → 230-divider" classic holds for the LEFT-turn variant (160+70=230); a standard-turn hold on the 160 radial has dividers at 090/270/160 — golden tests encode both.

### Task 4: Clearance model — realistic phraseology + answer key [P0]

**Files:**
- Create: `src/engine/clearance.ts`, `src/engine/clearance.test.ts`

- [x] look up holding-instruction phraseology in the current FAA JO 7110.65 (and AIM 5-3-8 examples); record the exact citation in the code's `source` fields
- [x] write tests first: generated text matches real controller phraseology and AIM 5-3-8 i element order; turn direction stated only for left turns; "as published" form; leg length in miles only for DME/RNAV; radial (FROM) vs bearing/course (TO) wording explicit and consistent with the derived `HoldSpec`
- [x] implement `generateClearance(seed): { clearance, holdSpec, expectedFields }` — seeded random scenarios across fix types, standard/nonstandard, timed/DME legs
- [x] implement `gradeCopiedClearance(userFields, expected)` with per-field results; omitted turn direction = right turns (the trap), flagged distinctly
- [x] run tests - must pass before task 5
- ➕ phraseology re-verified against JO 7110.65BB (current, Chg 1+2 dtd 1-22-26) 4-6-4 and 4-6-1 fetched from faa.gov: element order; leg length in miles only for DME/RNAV; turns stated only if left; charted holds abbreviate to direction + "as published". Generator fix names are practice fixtures — Task 8 brings chart-derived holds.

### Task 5: Progress store [P0]

**Files:**
- Create: `src/app/store.ts`, `src/app/store.test.ts`

- [x] write tests first: versioned round-trip; per-drill stats (attempts, correct, avg time); miss recording with scenario snapshot; corrupt/missing localStorage → empty state without throwing
- [x] implement `loadState`/`saveState`/`recordDrillResult`/`recordMiss`; benchmark helpers (last-20 entry accuracy + median time vs 18/20 <10 s, 95% <15 s)
- [x] write error tests (quota exceeded → in-memory fallback)
- [x] run tests - must pass before task 6

### Task 6: HSI SVG component [P0]

**Files:**
- Create: `src/ui/hsi.ts`, `src/ui/hsi.test.ts`

- [x] load the `frontend-design` skill and study how the real instrument (HSI / G1000 PFD compass rose) is depicted; aim for a close, clean approximation — not a toy diagram
- [x] write tests first (jsdom): rose rotates so heading is up; course pointer at correct rose position; thumb overlay on 3 o'clock side for standard / 9 o'clock for nonstandard, 20° wide starting at the 70° line; sector overlay angles match engine output
- [x] implement `renderHSI(el, { heading, course, thumbOverlay, sectorOverlay })` as pure SVG rendering (state in, SVG out)
- [x] scales to container width, usable at 320 px (viewBox-only SVG + `.hsi` CSS, width 100%)
- [x] run tests - must pass before task 7
- ➕ G1000 conventions encoded: 5° ticks, labels every 30° (cardinal letters + numbers sans trailing zero), magenta course pointer, heading-0 readout shown as 360°; sector-overlay tests feed `determineEntry` output verbatim (engine is the oracle)

### Task 7: Entry drill module [P0]

**Files:**
- Create: `src/modules/entry-drill.ts`, `src/modules/entry-drill.test.ts`
- Modify: `src/app/router.ts`

- [x] write tests first: seeded scenarios (standard/nonstandard, fix types; prompt = realistic clearance text + current heading on HSI); grading accepts primary + boundary alternates; timer per answer; miss recorded with scenario; explanation payload includes sector overlay + FAA citation
- [x] implement drill screen: clearance text + HSI; three-button answer (direct/teardrop/parallel), touch-sized; instant feedback with sector overlay and citation
- [x] two modes: untimed learn mode (thumb/sector aids visible — legitimate for the written per FAA Order 8080.6H) and timed cockpit mode (no aids, 15 s target)
- [x] session + stored stats vs benchmarks (18/20 <10 s; 95% <15 s)
- [x] run tests - must pass before task 8
- ➕ pure controller (`createEntryDrill`, injectable clock/store) split from DOM renderer; cockpit results stored under `entry` (the benchmarked drill), learn results under `entry-learn` so the timed window stays clean; `mulberry32` exported from `clearance.ts` for the heading stream; screen registered in `main.ts` (the route registry lives there, not in `router.ts`)

### Task 8: Written-test question bank + exam module [P0]

**Files:**
- Create: `src/content/questions.ts`, `src/modules/written-test.ts`
- Create: `src/content/questions.test.ts`, `src/modules/written-test.test.ts`
- Modify: `src/app/router.ts`

- [x] fetch current FAA charts (dTPP) for **KTCY RNAV (GPS) RWY 12** (missed-approach hold) and a **KLVK** procedure with a hold; derive hold parameters from the real charts — checkbox blocked until verified current
- [x] write content-validation tests first: every question has options, keyed answer, explanation, FAA `source`, `acs` tag; entry-question answers MUST come from `determineEntry` (engine is the oracle; dual-keyed "parallel or teardrop" allowed only when engine says near-boundary)
- [x] author ~40 original FAA-IRA-style questions: diagram-based entry determination, missed-approach-hold entries on the KTCY/KLVK chart scenarios, max speeds (200/230/265, (175) icon), timing (1 vs 1½ min; outbound-start rule), required reports, EFC/lost-comm 91.185(c)(3), standard-vs-nonstandard
- [x] implement practice mode (immediate explanation + citation; misses recorded) and exam-sim mode (fixed-length, literal option formats incl. "parallel or teardrop", no aids, weak-area score report)
- [x] run tests - must pass before task 9
- ➕ chart data verified against dTPP cycle 2607 (eff. 9 Jul–6 Aug 2026) cross-checked with same-cycle CIFP records: KTCY HAIRE missed hold (231° in, RT, 4 NM) + OYOSO HILPT (116° in, LT, 4 NM); KLVK UHHUT HILPT (255° in, RT, 4 NM) + ALTAM missed hold on the OAK 060 radial (240° in, LT, 1 min). Bank: 43 questions (11 entry, engine-keyed via `entryOptionSet`; 32 static, source-verified). Exam sim: seeded 20-question draw, empty answer ack (no key leak mid-exam), weak-topic report <70%. Screen registered in `main.ts` (registry lives there, not `router.ts`).

### Task 9: Oral-exam prep module [P0]

**Files:**
- Create: `src/content/oral.ts`, `src/modules/oral-prep.ts`
- Create: `src/content/oral.test.ts`, `src/modules/oral-prep.test.ts`
- Modify: `src/app/router.ts`

- [x] write content-validation tests first: every item has ACS element tag (IR.III.B.K1, R1–R4, S1–S8), model answer, FAA `source`; coverage test: every Task III.B element has ≥1 item
- [x] author oral Q&A: clearance elements, reports, lost comm, protected airspace/holding side, max speeds and why, fuel/EFC ADM (Avianca 052 framing), **G1000 hold behavior (SUSP, OBS holds, when to intervene) as Q&A content** (replaces the cut G1000 module; flag software-version-dependent features)
- [x] implement self-test flow: question → reveal answer → self-grade (got it / partial / missed); missed → Anki export; browse-by-ACS-element view
- [x] run tests - must pass before task 10
- ➕ ACS element list encodes all 14 Task III.B codes incl. `IR.III.B.S3a` (confirmed in FAA-S-ACS-8C's own added-codes list); AIM 5-5-15 (minimum fuel advisory) verified via faa.gov chapter listing. Items carry `caveat` fields (triple-vs-double drift, G1000 software-version, ±5°) ready for Task 17's caveat-rendering check. Grades: only "got it" counts correct under drill id `oral`; only "missed" records a miss (Anki-ready snapshot). Browse view keeps empty elements visible as a coverage checklist. Screen registered in `main.ts` (registry lives there, not `router.ts`).

### Task 10: Anki export [P0]

**Files:**
- Create: `src/content/anki-deck.ts`, `src/app/anki-export.ts`
- Create: `src/content/anki-deck.test.ts`, `src/app/anki-export.test.ts`
- Modify: `src/app/router.ts`

- [x] write tests first: TSV escaping (tabs/newlines); every fixed-deck card has front/back/tags (topic + ACS element); misses deck converts stored misses (entry scenarios, oral items, question misses) into cards
- [x] author fixed deck from the ROTE/TRAP/SAFETY call-outs (`research-claude.md` §Anki, each verified against its FAA source; citations on card backs)
- [x] implement TSV Blob downloads (`hold-train-core.tsv`, `hold-train-misses.tsv`) + Anki import instructions; empty miss list → informative empty state
- [x] run tests - must pass before task 11
- [x] **P0 checkpoint: app is exam-useful now. Reassess remaining time before starting P1.** (checkpoint noted: P0 complete, all 6 modules working; ~1 month to exam — proceeding to P1 wind/timing work, which maps directly to ACS S5/R4)
- ➕ 24-card core deck (11 rote / 7 trap / 6 safety), each tagged with a group + ACS element code, tags whitespace-free (Anki splits tags on spaces); newlines escape to `<br>` (Anki renders HTML); miss cards rebuilt from store snapshots per drill type, malformed snapshots skipped; screen registered in `main.ts` at `#anki`

### P1 — high value if time allows

### Task 11: Wind and timing engine [P1]

**Files:**
- Create: `src/engine/wind.ts`, `src/engine/wind.test.ts`

- [x] write tests first from AIM worked examples: 8° inbound crab → 24° outbound (triple drift); zero wind → 60 s legs; DME endpoints (10+5→15; 28 away +8→20); timing adjustment direction ~1 s/kt
- [x] implement `inboundCrab`, `outboundHeading` (triple drift), `outboundTimeSeconds`, DME/ATD endpoint calculator
- [x] edge tests: direct crosswind, wind aligned with course, wind ≥ TAS rejected
- [x] run tests - must pass before next task
- ➕ AIM 5-3-8 re-fetched from faa.gov: triple drift (8°→24°) is verbatim in j8 (same recommended-actions list as the ±5° rule), timing in j4, DME/ATD examples in j5. The "~1 s/kt" heuristic is NOT in the AIM — `outboundTimeSeconds` computes exact ground-speed ratios (t_out = target·GSin/GSout); tests confirm ~1.2 s/kt emerges at 90 KTAS. Crab sign convention: positive = right; outbound single-drift correction is the exact negation of inbound crab, so triple drift is one line. Courses follow the engine's [0, 360) convention (360 rejected, HSI handles display).

### Task 12: Map view SVG component [P1]

**Files:**
- Create: `src/ui/mapview.ts`, `src/ui/mapview.test.ts`

- [x] write tests first (jsdom): racetrack on holding side; standard/nonstandard mirror; ownship position/heading; ground-track polyline; entry-path illustration (teardrop 30° offset; parallel on non-holding side, opposite reintercept)
- [x] implement `renderMap(el, { holdSpec, ownship?, track?, ghostTrack? })` — north-up, scaled for 1-min legs at ~90 KTAS; same clean instrument-chart aesthetic as the HSI (frontend-design skill)
- [x] run tests - must pass before next task
- ➕ geometry in NM east/north of the fix (fix at origin), single `project()` to the 200×200 viewBox; turn radius 0.48 NM (standard-rate 180° at ~90 kt = 1.5 NM/π), scale adapts so 4-NM DME legs still fit; entry paths consume `entryGuidance` verbatim (engine is the oracle) with per-entry colors matching the HSI sectors; `MapPoint {e, n}` NM offsets are the track interface Task 13's sim will emit; extra `entryPath?: Entry` prop covers the plan's entry-illustration tests

### Task 13: Wind & Timing Lab — decision sim [P1]

**Files:**
- Create: `src/engine/sim.ts`, `src/modules/wind-lab.ts`
- Create: `src/engine/sim.test.ts`, `src/modules/wind-lab.test.ts`
- Modify: `src/app/router.ts`

- [x] write sim tests first: no-wind correctly-flown hold → ~60 s inbound, closed racetrack; textbook triple-drift decisions in known wind → inbound within seconds of 60; no-crab decisions → measurable drift
- [x] implement fixed-timestep integrator (standard-rate turns, ~90 KTAS, wind per step; decisions as input: entry, outbound heading, crab, outbound seconds) + ground-track output
- [x] implement predict → fly → debrief flow: user states expected crab/outbound heading/time first (CFI Notebook exercise), engine flies it, debrief shows measured vs target (ACS ±10° framing), next-circuit timing suggestion; misses recorded
- [x] run tests - must pass before next task
- ➕ physics finding encoded in tests: the AIM ratio-timing rule models only the straight legs — wind keeps drifting the pattern during the two 1-minute turns, so textbook decisions leave the first inbound ~10 s off in a 15 kt crosswind and ~+34 s with a 20 kt inbound headwind. Since inbound time is affine in outbound time, one adjustment of (60 − measured)·GSin/GSout seconds closes it to ≤3 s (that IS AIM 5-3-8 j4's "adjust subsequent outbound legs"); `groundSpeeds` added to `wind.ts` for it. Lab therefore grades the *decisions* (outbound heading + crab vs engine within ACS ±10° — verified verbatim in FAA-S-ACS-8C Task III.B "selected headings ±10°"; planned time within 10 s of the rule), while measured inbound drives the next-circuit suggestion; only the first circuit per scenario is scored (re-fly = practice loop). Entry decision sets sim turn directions (parallel opposite); teardrop honestly crosses ~0.75 NM holding-side without an intercept (no intercept logic — decisions, not autopilot). Screen registered in `main.ts` at `#wind-lab`; ghost track = sim flying the textbook numbers.

### Task 14: Clearance copy drill [P1]

**Files:**
- Create: `src/modules/clearance-copy.ts`, `src/modules/clearance-copy.test.ts`
- Modify: `src/app/router.ts`

- [x] write tests first: field-by-field grading; standard-turns trap surfaced; "as published" grades only present fields; TO/FROM micro-drill grading (bearing TO vs radial FROM → which side of the fix)
- [x] implement: clearance shown briefly then hidden (like real radio) → structured field form → graded review with citations; TO/FROM micro-drill mode; misses recorded
- [x] run tests - must pass before next task
- ➕ engine already held all the grading (`gradeCopiedClearance` from Task 4 is the oracle); the module adds only presentation + the pure `holdSide(kind, degrees)` (radial FROM → hold on the radial side; bearing TO → reciprocal side, P/CG). Clearance auto-hides after ~spoken duration (450 ms/word, 4 s floor) with a "got it" skip; empty degrees input is treated as not-copied (Number('') is 0, which would falsely match a spoken 360). Trap review row gets a distinct `.is-trap` accent. Misses stored under `clearance-copy` / `to-from`; Anki export skips unknown drill ids by design, so exporting these misses is deferred (would extend Task 10's converters). Screen registered in `main.ts` at `#clearance-copy`.

### P2 — cut unless time clearly remains

### Task 15: Learn pages (concise) [P2]

**Files:**
- Create: `src/content/lessons.ts`, `src/modules/learn.ts`, tests for both
- Modify: `src/app/router.ts`

- [x] short lesson pages in instructional order (why → anatomy → entries/thumb method → timing/wind → reports); every factual paragraph carries FAA `source`; each links to the relevant drill
- [x] content-validation tests (ordering, sources present, drill links resolve)
- [x] run tests - must pass before next task
- ➕ 5 lessons, wording reuses statements already source-verified in Tasks 3/4/8/9/11 (Task 17 re-audits). No entry answers in lessons (engine stays the oracle); thumb-method paragraph explicitly labeled field technique with AIM cited only for the sector geometry, edges derived to match the Task 6 HSI overlay (+70°..+90°). Drill-link test imports the real Screen objects, so a renamed route fails tests. Screen registered first in `main.ts` at `#learn` (instructional entry point).

### Task 16: Progress dashboard [P2]

**Files:**
- Create: `src/modules/dashboard.ts`, `src/modules/dashboard.test.ts`
- Modify: `src/app/router.ts`, `src/main.ts`

- [ ] per-module readiness vs benchmarks (entry accuracy/time, exam-sim score, oral ACS coverage); written/oral/flight mapping to ACS Task III.B; tests for benchmark computation
- [ ] run tests - must pass before next task

### Required closing tasks (always run, after whatever tier you stop at)

### Task 17: Content verification pass

**Files:**
- Modify: `src/content/*.ts` (fixes only)
- Create: `docs/content-audit.md`

- [ ] cross-check every content string **against the FAA primary sources directly (AIM, ACS, 14 CFR, JO 7110.65) plus reputable internet cross-checks** — numbers, rule statements, phraseology; record each check pass/fixed in `docs/content-audit.md`
- [ ] verify every entry answer is engine-generated (no hand-keyed entry answers anywhere)
- [ ] verify caveat-flagged content renders its caveat (triple-vs-double drift, G1000 software-version features, ±5° boundary)
- [ ] fix discrepancies; add regression tests for each fix
- [ ] run tests - must pass before task 18

### Task 18: Verify acceptance criteria
- [ ] all implemented-tier requirements from Overview verified (nonstandard mirrors, boundary dual-correct grading, standard-turns trap, TO/FROM, realistic phraseology)
- [ ] run full test suite: `npm test`
- [ ] manual smoke test at 320/768/1280 px: implemented modules usable, touch targets adequate
- [ ] engine test coverage: every exported function has golden + edge tests

### Task 19: [Final] Update documentation
- [ ] README.md: what it trains, module → exam-phase map, how to run, Anki import, source policy
- [ ] CLAUDE.md: engine-is-the-oracle rule, FAA-source citation convention, TDD policy, priority tiers, no-new-dependencies bias
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion
*No checkboxes — manual/external items*

**Manual verification:**
- Drill each module; report anything contradicting your CFII's teaching or current Jeppesen charts
- Verify KTCY RNAV (GPS) RWY 12 and KLVK hold details against current charts before relying on those scenarios (procedures amend frequently)
- Cross-check a sample of app entry answers against holdingpattern.com's Holding Pattern Computer as an independent oracle
- Import both Anki decks into your Anki; confirm formatting
- Phone/tablet ergonomics on your real devices; confirm the club C172's avionics (G1000 or not) and adjust G1000-related oral content if needed

**External:**
- Hosting/deploy deliberately out of scope; decide after the app proves useful locally
