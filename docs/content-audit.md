# Content audit — Task 17 (2026-07-22)

Every user-visible aviation fact in `src/content/` was cross-checked against the FAA
primary sources fetched directly from faa.gov / ecfr.gov on 2026-07-22, plus reputable
cross-checks where noted. Verdicts: **pass** (content matched source verbatim or in
meaning) or **fixed** (discrepancy found and corrected in this audit; each fix has a
regression test in the matching `*.test.ts`).

## Sources and editions fetched

| Source | Edition / as-of | How fetched |
|---|---|---|
| AIM 5-3-8, 5-3-3 | Current AIM HTML, faa.gov `aim_html/chap5_section_3.html` | direct fetch |
| AIM 5-4-9, 5-5-15, 8-1-5, P/CG | Current AIM/P/CG HTML on faa.gov | direct fetch |
| 14 CFR 91.185, 91.167 | eCFR, current as of 2026-07-21 | eCFR versioner API |
| FAA JO 7110.65 | **JO 7110.65BB, Change 3, effective 7/9/2026** | faa.gov `atc_html/chap4_section_6.html` |
| FAA-S-ACS-8C | Current PDF on faa.gov (instrument_rating_airplane_acs_8.pdf) | direct fetch |
| Avianca 052 | FAA Lessons Learned (AVA052) citing NTSB AAR-91/04 | direct fetch + cross-check |
| G1000 behavior | Garmin G1000 (Nav III) & G1000 NXi Pilot's Guides | Garmin PDFs (non-FAA, caveat-flagged) |
| KTCY/KLVK charts | dTPP cycle 2607 (eff. 9 Jul–6 Aug 2026) + same-cycle CIFP | verified in Task 8; cycle still current on audit date |

## Fixes made in this audit

1. **Turn-direction conditional (4 files).** Content said ATC states turn direction
   "only when left turns are required". AIM 5-3-8 i5 and JO 7110.65BB 4-6-4 a5 both read:
   direction of turn *"if left turns are to be made, the pilot requests, or the controller
   considers it necessary."* The trap teaching (silence → right turns) is unchanged and
   confirmed. Fixed in `questions.ts` (pattern-omitted-direction), `oral.ts`
   (clearance-elements, standard-vs-nonstandard), `anki-deck.ts` (trap card),
   `lessons.ts` (anatomy). Regression tests in all four test files.
2. **±5° rule reframed to the AIM's actual wording.** AIM 5-3-8 j8(d) verbatim: *"+/- 5
   degrees in heading is considered to be within allowable good operating limits for
   determining entry."* The AIM frames it as a heading tolerance, not literally "either
   adjacent entry is acceptable" — the either-entry consequence is the standard (and
   engine-modeled) interpretation, now stated *as* a consequence of the quoted rule.
   Fixed in `questions.ts` (entryExplanation), `oral.ts` (entries caveat), `anki-deck.ts`
   (boundary card), `lessons.ts` (entries). Regression tests in all four test files.
3. **Bank-limiting card was missing an AIM exception.** AIM 5-3-8 j8(b)(4) allows
   bank-limiting below 25° when not pilot-selectable, required by aircraft limitations,
   **or necessary for minimum maneuvering speed margins**; third exception added to the
   safety card. Regression test in `anki-deck.test.ts`.
4. **5-minute advance-notice card citation.** The AIM statement (5-3-8 e) covers only a
   clearance *beyond* the fix when **no** delay is expected, "whenever possible"; the
   holding-instructions 5-minute target when delay *is* expected is JO 7110.65BB 4-6-1 b.
   Card back and source now say so. Regression test in `anki-deck.test.ts`.
5. **Chart-currency caveat added to `chart-klvk-altam-speed`.** Its explanation makes a
   chart-dependent claim ("no special restriction is depicted") but was the only
   chart-topic question without the "procedures amend frequently" caveat. Regression
   test: every `topic: 'chart'` question carries the caveat.
6. **Report-card citations simplified to the verified source.** Two Anki cards cited
   "AIM 5-3-8 (reports at the clearance limit)" alongside AIM 5-3-3 a1(f), (g); the
   5-3-8 half was not independently verified, and 5-3-3 a1(f)/(g) fully supports both
   cards, so the unverified half was dropped. Regression test in `anki-deck.test.ts`.
7. **Citation precision pass.** Sub-paragraph designators verified against the fetched
   AIM and applied throughout: speeds table **j2** (icons/parens j2(b)), inbound timing
   **j4** (outbound-start j4(b)), DME/ATD **j5**, triple drift **j8(c)**, ±5° **j8(d)**,
   bank angle **j8(b)**, RNAV ground-track/fly-by **j7**, RNAV intervene **j8(f)**,
   descriptive terms **j1**, speed reduction **d**, clearance beyond fix **e**, VOR
   TO/FROM reversal **g**, clearance elements **i** (EFC = i6). G1000 published-hold
   caveat enriched: early non-WAAS units guide only the inbound course.

8. **"As published" entry-drill scenarios were unanswerable.** A charted clearance
   states neither inbound course nor turn direction (JO 7110.65 4-6-4 — the pilot reads
   them off the plate), but the drill keyed the answer from the hidden published turn
   direction and cockpit mode shows no thumb overlay. Two of the four fixtures are
   left-turn, so a student applying "silence means right turns" was graded wrong on
   roughly 5% of items: negative training on a rule that must be reflexive. The drill
   now prints the plate line (`chartNote`) alongside the clearance, and the miss
   snapshot and Anki card carry it. Regression tests in `entry-drill.test.ts`
   ("every scenario is answerable from what the pilot is shown") and `anki-export.test.ts`.
9. **`HAIRE` practice fixture contradicted the real charted hold.** `PUBLISHED_HOLDS`
   in `clearance.ts` invented 210°/left/1-min for HAIRE while `CHART_HOLDS` carries the
   dTPP 2607 values (231°/right/4 NM) for the KTCY RNAV (GPS) RWY 12 missed hold the
   student actually flies. The fixture is renamed `BRIXO`. Regression test in
   `clearance.test.ts`: fixture names are disjoint from `CHART_HOLDS`.
10. **Citation precision gaps left by item 7.** `entry.ts` still rendered
    `AIM 5-3-8 j8` for the ±5° tolerance (now `j8(d)`) and `wind.ts` rendered
    `AIM 5-3-8 j8` for triple drift (now `j8(c)`), both user-visible.

## Verification: every content string, by file

### src/content/questions.ts

| Item(s) | Fact | Source verified | Verdict |
|---|---|---|---|
| 11 entry questions | keyed answer, options, sector explanation | engine-generated (`determineEntry` → `entryOptionSet`); AIM 5-3-8 j3, FIG 5-3-4 | pass (framing of ±5° **fixed**, item 2) |
| CHART_HOLDS (HAIRE, OYOSO, UHHUT, ALTAM) | courses, turns, legs, altitudes | dTPP 2607 + CIFP 2607 (Task 8); cycle current through 6 Aug 2026 | pass — re-verify after 6 Aug (Post-Completion) |
| speed-5000 / 9000 / 15000 | 200 / 230 / 265 KIAS bands | AIM j2(a) table: "MHA - 6,000' 200; 6,001' - 14,000' 230; 14,001' and above 265" | pass |
| speed-parens-175 | (175) restriction; comply before initially crossing; notify ATC | AIM j2(b)(2) | pass |
| speed-icon-210 | 210 KIAS icon, 6,001–14,000 ft | AIM j2(b)(1) | pass |
| timing-inbound-low / high | 1 min ≤14,000; 1½ above | AIM j4(a) | pass |
| timing-outbound-start | over/abeam whichever later; else wings-level | AIM j4(b) | pass |
| timing-adjust-outbound | adjust outbound to fix inbound | AIM j4(a) NOTE | pass |
| timing-dme-away / toward | 10+5→15; 28−8→20; distances from station | AIM j5, FIG 5-3-6/7 | pass |
| report-reaching-fix / leaving-fix | time & altitude reaching; report leaving | AIM 5-3-3 a1(f), (g) verbatim | pass |
| report-slow-3min | slow within 3 min of limit | AIM 5-3-8 d | pass |
| report-efc-purpose | EFC = lost-comm departure time + fuel basis | AIM i6; JO 4-6-1a3; 91.185(c)(3) | pass |
| lostcomm-* (4) | 91.185(c)(3)(i)/(ii), (c)(2) highest-of | eCFR verbatim | pass |
| pattern-standard-turns | standard = right | AIM j1 | pass |
| pattern-omitted-direction | omitted → right | JO 4-6-4 a5; AIM i5 | **fixed** (item 1) |
| pattern-vor-reversal | first complete TO/FROM reversal | AIM 5-3-8 g | pass |
| pattern-acs-tolerances | ±10 kt / ±100 ft / ±10° / ¾-scale CDI | FAA-S-ACS-8C IR.III.B.S4 | pass |
| chart-* (7) | chart-derived facts + HILPT/NoPT rule | Task 8 charts; AIM 5-4-9 a/b/e (NoPT: "not permitted... must first receive an amended clearance") | pass (caveat gap **fixed**, item 5) |

### src/content/oral.ts

| Item | Fact | Source verified | Verdict |
|---|---|---|---|
| ACS_ELEMENTS (14 codes) | K1, R1–R4, S1–S8 + S3a, texts | FAA-S-ACS-8C Task III.B PDF — exact code set and meaning | pass |
| what-and-why | racetrack in protected airspace; ATC uses | AIM 5-3-8; P/CG HOLD PROCEDURE | pass |
| clearance-elements | element order incl. eight cardinal points, EFC | AIM 5-3-8 i (verbatim list quoted in audit); JO 4-6-4/4-6-1 | **fixed** (item 1 wording) |
| standard-vs-nonstandard | right/left; omitted → right | AIM j1, i5; JO 4-6-4 a5 | **fixed** (item 1) |
| max-speeds | bands + protected-airspace rationale + (175) | AIM j2 | pass |
| slow-to-holding-speed | 3-min rule; fuel-conservation power | AIM d; ACS S2 ("set appropriate power as needed for fuel conservation") | pass |
| entries | sectors, teardrop 30°/1 min, parallel >180° | AIM j3 verbatim; sector sizes 180/70/110 depicted in FIG 5-3-4 (figure, not body text) | ⚠️ verdict predates the 2026-08-02 rejoin-direction correction. The sector, teardrop and >180° facts still pass; the **rejoin turn direction** this row silently blessed was wrong and is **fixed 2026-08-02** (see the entry at the end of this file). The ">180°" fact is true of both turn directions and must never be used to derive which one is correct |
| fix-arrival | TO/FROM reversal, DME, GPS sequencing; five Ts | AIM g; ACS S3; five Ts labeled technique | pass |
| leg-lengths | 1 min / 1½ min; DME distance legs | AIM j4(a), j5 | pass |
| outbound-timing | over/abeam later; adjust subsequent | AIM j4 | pass |
| wind-correction | triple drift, constant-rate-turn rationale | AIM j8(c) verbatim (8°→24°) | pass (caveat notes double-drift as field technique — kept) |
| acs-tolerances | S4 numbers | ACS PDF | pass |
| required-reports | reaching + leaving, at all times | AIM 5-3-3 a1(f), (g); NOTE exception applies only to instrument training at military terminal facilities — immaterial for civil ops | pass |
| efc | EFC definition + dual role | P/CG (definition only) + 91.185(c)(3) (lost-comm role) — composite citation is correctly split | pass |
| lost-comm | 91.185(c)(3) both branches | eCFR verbatim | pass |
| fuel-adm | min fuel ≠ emergency; 91.167 reserves; Avianca 77 min / 73 of 158 | AIM 5-5-15; eCFR 91.167; FAA Lessons Learned AVA052 ("holding three times for a total of 1 hour and 17 minutes") | pass |
| anticipate-holding | weather/traffic/flow → fuel planning | ACS R3; 91.167 | pass |
| protected-side | protection designed around pattern + entries | AIM j3 intro: "protected airspace is designed based in part on pilot compliance with the three recommended... entry procedures"; j3(4) | pass |
| g1000-published-hold / g1000-obs-hold | SUSP, HILPT auto-resume, OBS, NXi hold options | Garmin G1000 Nav III + NXi Pilot's Guides (non-FAA, caveat-flagged) | pass (caveat enriched, item 7) |
| automation-intervene | monitor; clearance outranks the box | ACS S6/S8; AIM j8(f) | pass |
| srm-in-hold | SRM, scan, disorientation risk | ACS S8; AIM 8-1-5 (leans) | pass |

### src/content/anki-deck.ts (25 cards)

All rote/trap/safety card facts re-verified against the same paragraphs as above:
speeds j2 · timing j4 · sectors j3 + FIG 5-3-4 · teardrop/parallel j3 · triple drift
j8(c) · bank angle j8(b) ("whichever requires the least bank angle" — NOTE verbatim) ·
±5° j8(d) · slow-down d · 5-minute e + JO 4-6-1 b · ACS S4 · reports 5-3-3 a1(f)/(g) ·
omitted-direction JO 4-6-4 a5 · 14,000-ft boundary j4(a) · radar-still-report 5-3-3
(military-training NOTE immaterial) · as-published JO 4-6-1a2 ("may omit all holding
instructions except the charted holding direction and the statement 'as published'") ·
RNAV ground-track/fly-by j7(a) · protected-side j3 · cross-fix-speed d + j2 ·
EFC/Avianca 5-5-15 + 91.167 + AVA052 · bank-limiting j8(b)(4) · intervene j8(f) ·
leans 8-1-5. Verdict: pass, with **fixed** items 1, 3, 4, 6, 7 above — and ⚠️ this verdict
predates the 2026-08-02 rejoin-direction correction. The sector, teardrop and >180° facts
still pass; the parallel **rejoin turn direction** the "teardrop/parallel j3" row silently
blessed was wrong and is **fixed 2026-08-02** (see the correction entry at the end of this
file). ">180°" is true of both turn directions and must never be used to derive which one
is correct.

### src/content/lessons.ts (5 lessons, 16 paragraphs)

Each paragraph re-verified against the paragraphs listed above (why-hold: AIM 5-3-8 +
P/CG + 91.167 + ACS; anatomy: j1/i5, j4/j5, j2/d, i; entries: j3/FIG 5-3-4, j8(d)/j3,
thumb method explicitly labeled a field technique with AIM cited only for sector
geometry; timing-wind: j4, j8(c), j5; reports: 5-3-3 a1(f)/(g), i6 + P/CG + 91.167,
91.185(c)(3)). Verdict: pass, with **fixed** items 1, 2, 7 above — and ⚠️ this verdict
predates the 2026-08-02 rejoin-direction correction, on the same terms as the
`anki-deck.ts` verdict above: the "entries: j3/FIG 5-3-4" row blessed the wrong parallel
**rejoin turn direction**, **fixed 2026-08-02**.

## Engine is the oracle — verified

- `questions.ts`: all 11 entry questions are built by `buildEntryQuestion` →
  `determineEntry` + `entryOptionSet`; no hand-keyed entry answer exists in the file.
  Enforced by tests: "keyed answer always equals the determineEntry output",
  dual-keying exactly when near-boundary, no engine-acceptable distractors.
- `entry-drill.ts`: grading and sector overlays come from `determineEntry` directly.
- `wind-lab.ts` / `sim.ts`: entry decision is user input; turn geometry from the engine.
- `oral.ts`, `lessons.ts`, `anki-deck.ts`: state sector *facts* (sizes, offsets) **and**
  the parallel rejoin's turn-direction rule in prose — engine-owned geometry restated in
  words, which is exactly how the inverted rejoin came to ship in three content files at
  once while every content test passed. "Checked by review" was the reasoning that left it
  unguarded. Still no scenario→entry mappings. The prose is now pinned against the
  engine's rule by the globbed `?raw` scan in `src/parallel-entry.invariants.test.ts`,
  which sweeps `src/content/*.ts` rather than a hand-written file list.
- `ALTAM` inbound course and radial-question courses are computed via
  `radialToInboundCourse`, not hand-keyed (test-enforced).

## Caveat rendering — verified

- `oral-prep.ts` renders `item.caveat` next to the revealed answer
  (`.oral-caveat`); test "renders the source citation and caveat with the revealed
  answer" in `oral-prep.test.ts`.
- Caveat-flagged content present and rendered: triple-vs-double drift (oral
  wind-correction caveat + anki card back + lessons paragraph — content-level tests in
  all three test files), G1000 software-version (both G1000 items, test-enforced),
  ±5° boundary (oral entries caveat — regression test added this audit), chart currency
  (all chart-topic question explanations — regression test added this audit; rendered
  via the written-test explanation panel with citation).
- `written-test.ts` renders explanation + `<cite>` source in practice mode;
  `learn.ts` renders per-paragraph `<cite>`; `entry-drill.ts` renders the citation.

## Notes / open items

- Chart-derived holds are verified for dTPP cycle 2607 only (through 6 Aug 2026);
  re-verify against current plates after the cycle turns (listed in Post-Completion).
- AIM FIG 5-3-4 sector sizes (180/70/110) are depicted in the figure image, not the body
  text; content cites the figure accordingly.
- JO 7110.65 4-6-4 also lists "track, azimuth" among holdable references; the
  pilot-facing content follows the AIM 5-3-8 i list (radial, course, bearing, airway,
  route), which is what a pilot copies.

## Post-completion review fix — 2026-07-22 (code review iteration 1)

- **Fixed: HSI thumb-band placement** (`src/ui/hsi.ts`). The screen-fixed band was
  drawn at +90°..+110° (mirrored 250°..270°); the direct/parallel boundary — the
  AIM 70° line, `d = −70` in `entry.ts` — sits at course − heading = **+70°** on a
  heading-up card, so the band belongs at **+70°..+90°** (mirrored 270°..290°), edge
  ON the line, exactly as the plan specified (Task 15 note, "+70°..+90°"). As drawn,
  the aid taught the direct sector as extending to 3 o'clock, misclassifying 20° of
  parallel headings as direct. Derived from the engine's sector math (the oracle);
  regression test: "standard hold: 20° band from the 70° line to the 3 o'clock index"
  and the mirrored case in `src/ui/hsi.test.ts`.
- **Fixed: thumb-method lesson prose** (`src/content/lessons.ts`, "entries" lesson).
  "lay a thumb just behind the 3 o'clock point … leading edge marks the 70° line" was
  internally inconsistent with the geometry above; now reads "just ahead of the
  3 o'clock point", covering the 20° toward the nose, leading edge on the 70° line.
  Sector-reading instructions in the paragraph were already correct and unchanged.
  Covered by the lesson-content tests in `src/content/lessons.test.ts`.

## Post-completion review fix — 2026-07-22 (code review iteration 2)

- **Fixed: `hidden` never hid the clearance-copy form** (`src/styles.css`).
  `.copy-form { display: flex }` is an author declaration, and author origin beats
  the UA stylesheet's `[hidden] { display: none }` regardless of specificity — so in
  a real browser the copy form rendered *while the clearance was still on screen*,
  defeating the drill's premise (copy from memory, as off a radio). jsdom models a
  simplified cascade and reported `display: none`, and the tests asserted the
  `hidden` property, so 450 tests passed over it. Added an explicit
  `[hidden] { display: none !important }`. Regression tests: "forces [hidden] to win
  over author display declarations" in `src/styles.test.ts`, plus "a second grade
  click after review cannot throw" in `src/modules/clearance-copy.test.ts` (the
  visible form left the graded scenario re-submittable, throwing out of the click
  handler and wedging the drill).
- **Fixed: dashboard claimed bank coverage it cannot measure**
  (`src/modules/dashboard.ts`). `fullPass` compared cumulative oral *attempts* to the
  bank size, so answering one item 21 times displayed "full pass through the bank:
  yes". Renamed to `bankWorthAnswered` and the card now states that which items were
  seen is not tracked. A readiness signal that overstates preparation is the same
  negative-training failure mode as a wrong sector. Regression test: "never claims
  bank coverage it cannot measure" in `src/modules/dashboard.test.ts`.
- **Fixed: one drill's misses evicted another's** (`src/app/store.ts`). `MAX_MISSES`
  was a single 200-entry FIFO across all drills, but only `entry`, `entry-learn`,
  `written`, `written-exam` and `oral` misses become Anki cards. A long
  clearance-copy or wind-lab session silently pushed out exactly the misses the
  personalized deck exists for. Now `MAX_MISSES_PER_DRILL`, capped per drill id.
  Regression test: "does not let one drill evict another drill's misses" in
  `src/app/store.test.ts`.
- **Fixed: README exam-phase table contradicted the in-app map** (`README.md`).
  Four of eight rows disagreed with `PHASE_PREP` (Learn, Entry Drill, Wind Lab, Anki
  Export), giving the doc and the dashboard two different study plans. README now
  matches the app. Regression test: "matches PHASE_PREP row for row" in
  `src/modules/dashboard.test.ts` parses the table and diffs it against `PHASE_PREP`.
- **Fixed: undefined CSS custom properties** (`src/styles.css`). `var(--border, #ccc)`
  and `var(--ok, #2e7d32)` always resolved to their fallbacks; `#2e7d32` on `--bg`
  is ~3.6:1, below WCAG AA 4.5:1, making the dashboard "Ready ✓" the least legible
  text on the screen while every other module signals correct with `#3fbf6f`. Added
  `--ok` and `--border` to `:root`. Regression test: "defines every custom property
  it references" in `src/styles.test.ts` (catches the whole class, not these two).
- **⚠️ SUPERSEDED 2026-08-02 — this entry's reasoning was wrong and its "fix" introduced
  a safety-of-flight training defect.** It is kept in full, unedited below, because the
  failed reasoning is the useful part: the derivation it rests on is invalid (it never
  updates the bearing to the fix for the aircraft's motion *during* the turn, so both
  turn directions in fact exceed 180° and the AIM clause discriminates nothing), and a
  future session reading AIM 5-3-8 j3(a) alone will re-derive the same wrong answer.
  The turn direction was inverted back on 2026-08-02 against rendered FAA figures — see
  **"Fixed: the parallel entry's rejoin turn rotated with the pattern instead of against
  it"** in the 2026-08-02 section at the end of this file, and the evidence dossier at
  `docs/parallel-entry-evidence.md`. Note also that the regression tests this entry
  lists were themselves pinning the defect and have been rewritten.
- **Fixed: the parallel entry's reintercept turn was inverted app-wide**
  (`src/engine/entry.ts`, `src/engine/sim.ts`, `src/ui/mapview.ts`,
  `src/modules/entry-drill.ts`, `src/content/lessons.ts`, `src/content/oral.ts`,
  `src/content/anki-deck.ts`). `entryGuidance('parallel')` returned
  `turnToInbound: opposite`, so a standard right-turn hold was taught as a LEFT
  reintercept, and the lesson/oral/Anki prose said "turn toward the holding side".
  AIM 5-3-8 j3(a), fetched from faa.gov: "turn to a heading to parallel the holding
  course outbound on the nonholding side for one minute, **turn in the direction of
  the holding pattern through more than 180 degrees**, and return to the holding fix
  or intercept the holding course inbound." Drawn out (inbound 270, right turns,
  outbound 090) the aircraft ends south-east of the fix, which bears ~285: a right
  turn is 195°, a left turn 165° — only the pattern direction can be the AIM's "more
  than 180 degrees", so both clauses agree. The source of the error was
  `docs/research-claude.md`, a secondary note whose own sentence was self-
  contradictory; that line is now corrected in place with the derivation.
  `sim.ts` needed more than a sign flip — one `turnSign` drove both the turn onto
  outbound (which genuinely opposes the pattern; that is what puts the aircraft on
  the nonholding side) and the reintercept, and turning to the inbound heading is
  exactly 180° either way, rolling out 2R off course and never intercepting. The
  two signs are now separate and parallel rolls out on a 30° intercept.
  Regression tests: "parallel: outbound course on the nonholding side, reintercept
  WITH the pattern" and "every entry reintercepts in the pattern direction" in
  `src/engine/entry.test.ts`; "parallel: outbound turn opposes the pattern,
  reintercept turn follows it" and "parallel reintercept sweeps more than 180°" in
  `src/engine/sim.test.ts`; the large-arc and sweep assertions in
  `src/ui/mapview.test.ts`.
- **Fixed: invented hold data was presented as a chart for real local fixes**
  (`src/engine/clearance.ts`, `src/modules/entry-drill.ts`). `PUBLISHED_HOLDS` used
  "plausible NorCal names", three of which are real waypoints — CEDES (Livermore),
  SUNOL, and TRACY, which sits beside KTCY — and `chartNote` rendered the invented
  course, turns and leg length as `Chart: TRACY — inbound course 120°, left turns,
  4 NM legs.` The existing guard only required disjointness from the app's own
  `CHART_HOLDS`, not from real charts. Fixtures renamed to ZORVU/QUIBO/VAXNU
  (verified to return no waypoint record on opennav.com, the same check that
  correctly rejects JEMKO), and the line now reads "Practice plate (fictitious
  fix) — …" so the label holds even if a future name collides. Regression tests:
  "marks the plate line as a practice plate, never as a real chart" and "no fixture
  reuses a real NorCal fix name the student might fly" in
  `src/modules/entry-drill.test.ts`.
- **Fixed: the TO/FROM drill printed a 0° course** (`src/modules/clearance-copy.ts`).
  The radial explanation interpolated `${inbound}°` raw instead of `courseText`, so
  the 180° radial — 73 of the first 5000 seeds — read "inbound course 0°" in the one
  drill dedicated to course conventions. Regression tests: "speaks a reciprocal of 0
  as 360, never as 0" and "never prints a bare 0° course in any explanation" in
  `src/modules/clearance-copy.test.ts`.
- **Fixed: the exam score report inherited the last question's HSI**
  (`src/modules/written-test.ts`). `showReport` cleared the progress, question and
  option elements but not `figureEl`, which only `showQuestion` resets — so
  finishing on an entry question left a heading rose above the score. Regression
  test: "clears the HSI figure when the score report replaces the question" in
  `src/modules/written-test.test.ts`.
- **Fixed: a question stem named a holding direction the app's own rule contradicts**
  (`src/content/questions.ts`). `entry-radial-classic` quoted ATC as "Hold *southeast*
  of the Modesto VOR on the 160 radial", but every other module derives the side with
  `cardinalFromCourse`, which rounds the 160 radial to the nearest eight-point cardinal
  — S, not SE. The TO/FROM micro-drill generates radials in 10° steps, so it can ask
  this exact case and mark "SE" wrong. The stem now reads "south"; the entry answer was
  unaffected (it comes from `determineEntry`). Regression test: "every 'hold <direction>
  … on the NNN radial' stem agrees with the engine cardinal" in
  `src/content/questions.test.ts`, which checks all six radial stems, not just this one.
- **Fixed: the TO/FROM drill printed un-padded bearings beside padded ones**
  (`src/modules/clearance-copy.ts`). The prompt and both explanation branches
  interpolated `${degrees}°` raw while the derived course went through `courseText`,
  so one sentence read "the hold sits out along the 20° radial … inbound course 200°".
  Same root cause as the 0°-course entry above; `expectedText`'s holding-course row had
  it too. Regression test: "prints every bearing three-digit, prompt and explanation
  alike" in `src/modules/clearance-copy.test.ts` (500 seeds).
- **Fixed: the wind lab suggested an outbound time the sim refuses to fly**
  (`src/modules/wind-lab.ts`). `nextOutboundSeconds` clamped at ≥1 s but not at the
  ≤600 s bound `flyCircuit` enforces, so a long leg flown with a large crab — which can
  roll out already past the abeam line, reading `inboundSeconds` ≈ 0 and driving the AIM
  j4 correction term maximally positive — produced advice of 706 s that the engine then
  rejected with a `RangeError`. `MAX_OUTBOUND_SECONDS` is now exported from `sim.ts` and
  the suggestion is clamped to it. Regression test: "never suggests an outbound time the
  sim would reject" in `src/modules/wind-lab.test.ts`.
- **Fixed: the wind lab called the ground-speed-ratio time "the rule", contradicting
  the app's own written bank** (`src/modules/wind-lab.ts`). The lab grades the pilot's
  *first-circuit* outbound time against `outboundTimeSeconds` ±10 s and labelled that
  number "rule" in both the verdict line and the debrief row. But AIM 5-3-8 j4 — which
  `timing-adjust-outbound` in `src/content/questions.ts` teaches, and which `wind.ts:11-13`
  already flagged in a source comment as *not* an AIM rule — has you fly the **initial**
  outbound leg at 1 minute and adjust only the subsequent ones. Nothing on screen stated
  that the lab was instead asking for the ratio that yields a 60 s inbound, so a student
  entering 60 s (the correct written-test answer) was told "yours 60 s, rule 34 s". Measured:
  21 of the first 40 seeds put the ratio more than 10 s from 60 — seed 1 (course 000, wind
  350@25) targets 34.2 s, seed 7 targets 74.5 s — because wind speeds are drawn 5–25 kt and
  any along-course component over ~8 kt does it. The screen now states the ask in the input
  label and a `.lab-ask` paragraph carrying the j4 caveat, and both the verdict and the
  debrief row say "ground-speed ratio" rather than "rule". Grading is unchanged: with the
  question stated, the ratio is the right answer to it. Regression tests: "states what
  outbound time it asks for and carries the AIM j4 caveat", "never presents the
  ground-speed-ratio time as \"the rule\"", and "grades 60 s as a miss only against a stated
  ratio ask, and says so" in `src/modules/wind-lab.test.ts`.
- **Fixed: a correct ±5° alternate answer was told to fly the *other* entry**
  (`src/modules/entry-drill.ts`). `gradeEntryAnswer` accepts any near-boundary
  alternate per AIM 5-3-8 j8(d), but both the verdict line and the "Fly it:"
  instructions were hard-wired to `result.primary`. On seed 3 (primary parallel,
  alternate direct) a student who clicked **Direct** read "Correct — Parallel
  entry. Direct also acceptable" and was then handed the parallel's script,
  including "turn through more than 180°" — flying that from a direct-entry
  heading leaves the protected side. The verdict and guidance now name the entry
  actually flown (the pilot's own when accepted, the primary otherwise) and list
  the remaining accepted entries as alternates; wrong answers read exactly as
  before. Grading is unchanged. Regression tests: "guides the chosen entry, not
  the primary, when a ±5° alternate is answered" and "correct ±5° alternate: the
  verdict names what the pilot chose, not the primary" in
  `src/modules/entry-drill.test.ts`.
- **Fixed: the DME lesson labelled the AIM's worked examples backwards**
  (`src/content/lessons.ts`). AIM 5-3-8 j5 captions its two figures by the
  **inbound** course — "Inbound Toward NAVAID" is the 10 NM fix with 5 NM legs
  ending at 15 DME, "Inbound Leg Away from NAVAID" is the 28 NM fix with 8 NM
  legs ending at 20 DME (verified against the AIM HTML on faa.gov). The lesson
  said "holding *away* … 10 DME … ends at 15 DME; holding *toward* … 28 DME …
  20 DME", inverting the labels on the two examples a student memorizes, while
  `dmeOutboundEnd`'s own `inbound: 'toward' | 'away'` parameter and
  `wind.test.ts` use the AIM convention. The numbers were always right; only the
  labels were flipped. The paragraph now states the convention explicitly and
  names both leg directions. (`timing-dme-away`/`timing-dme-toward` in
  `src/content/questions.ts` were already unambiguous — they say "the *outbound*
  leg is flown away/toward" — and are unchanged.) Regression test: "pairs the DME
  worked examples with the AIM inbound-course labels" in
  `src/content/lessons.test.ts`.
- **Fixed: the wind lab drilled invented holds at three real waypoints**
  (`src/modules/wind-lab.ts`). `FIXES` was `WINDY, DRIFT, GUSTO, TIMBR, CRABB`;
  verified against `opennav.com/waypoint/US/<NAME>` on 2026-07-23, **WINDY**
  (Newman, CA — beside KTCY, this student's home field), **DRIFT** and **TIMBR**
  (Timber, OR) are real US waypoints. `generateWindScenario` invents the inbound
  course, turn direction and legs for whichever name it draws, and the scenario
  line rendered them as plain fact — "Hold at WINDY: inbound course 360°, right
  turns, 1-minute legs" — next to a north-up racetrack drawn like a plate, with
  no fictitious label. Same defect class as the CEDES/SUNOL/TRACY fix above, at
  the one fixture list with no guard test: the existing guards cover
  `PUBLISHED_HOLDS` and entry-drill's `chartNote` only. `FIXES` is now
  `ZORVU, QUIBO, GUSTO, VAXNU, CRABB` (each confirmed to return no waypoint
  record) and is exported so it can be tested; the scenario line now opens
  "Practice fixture (fictitious fix) — …", mirroring `chartNote`. Regression
  tests: "no fixture reuses a real waypoint name", "no fixture collides with a
  hold charted in the written bank" and "labels the scenario line as a practice
  fixture, not charted data" in `src/modules/wind-lab.test.ts`.
- **Fixed: the wind lab advised a next-circuit time off a circuit that never
  closed** (`src/modules/wind-lab.ts`). `nextOutboundSeconds` applied the AIM
  5-3-8 j4 ground-speed-ratio adjustment to `sim.inboundSeconds`
  unconditionally, but on `sim.completed === false` that value is the sim's time
  limit minus the turn and outbound legs — an artifact of where the sim gave up,
  not a measured inbound. The debrief printed "the circuit never made it back to
  the fix", "Inbound leg: never reached the fix", and then "Adjust: next circuit
  fly 532 s outbound" from that artifact. The field is now `number | null`, null
  on an incomplete circuit, and the UI says there is no inbound time to correct
  from and to re-fly with a shorter outbound leg. Regression tests: "offers no
  next-circuit time when the circuit never reached the fix" and the extended
  "debriefs a circuit that never made it back to the fix" in
  `src/modules/wind-lab.test.ts`.
- **Fixed: Anki downloads could silently produce no file**
  (`src/app/anki-export.ts`). `downloadTsv` called `URL.revokeObjectURL(url)` in
  the same synchronous task as `a.click()`, on an anchor never inserted into the
  document. `click()` only *queues* the navigation that resolves the blob URL,
  so the revoke can remove the entry before the download starts; a detached
  anchor's activation is also a no-op in some browsers. The anchor is now
  appended before the click and both the removal and the revoke happen in a
  later task. Regression: the `downloadTsv` test now asserts the anchor is
  connected at click time and that the revoke has not fired until timers run.
- **Fixed: the copy drill graded back the EFC exactly as it had displayed it**
  (`src/engine/clearance.ts`). `gradeCopiedClearance` compared the copied EFC by
  exact string (`user.efc.trim() === expected.efc.trim()`) against the bare
  four-digit value, while the review panel printed the expected value as
  `${expected.efc}Z` and the field is labelled "EFC (zulu)". A pilot who wrote
  `1745Z` — the form that goes on a kneeboard, and the form the app itself had
  just shown — was marked wrong on a correctly copied clearance. Grading now
  normalizes an optional trailing Z on both sides. Regression tests: "accepts a
  copied EFC with or without the zulu suffix" and "still flags a wrong EFC that
  carries the zulu suffix" in `src/engine/clearance.test.ts`, plus "accepts the
  EFC written with the zulu suffix the review itself displays" through the real
  DOM in `src/modules/clearance-copy.test.ts`.
- **Fixed: the wind-lab fixture rename collided with the other fixture list**
  (`src/modules/wind-lab.ts`). The previous entry moved `FIXES` off the real
  waypoints WINDY/DRIFT/TIMBR and onto `ZORVU, QUIBO, GUSTO, VAXNU, CRABB` — but
  ZORVU, QUIBO and VAXNU are `PUBLISHED_HOLDS` fixtures in
  `src/engine/clearance.ts`. Both lists invent course, turns and legs
  independently, so ZORVU was a 300°/right 1-minute hold on the entry-drill
  practice plate and some other invented hold in the wind lab, with nothing to
  tell the student which was which. The guard tests checked real waypoints and
  `CHART_HOLDS` but never the app's own other fixture list. `FIXES` is now
  `KELVO, MORVA, GUSTO, PLIXA, CRABB` (each confirmed 2026-07-23 to render the
  bare OpenNav shell rather than a `<NAME> waypoint | OpenNav` record).
  Regression test: "no fixture collides with a practice hold used elsewhere in
  the app" in `src/modules/wind-lab.test.ts`.
- **Fixed: the wind-lab debrief hid which side a wide inbound crossed on**
  (`src/modules/wind-lab.ts`). `sim.ts` signs `inboundCrossTrackNm` so positive
  is the holding side, but the debrief rendered the negative case as "crossing
  0.8 NM off the fix" — dropping the one fact that matters. The non-holding side
  is the side with no protected airspace, so the case the wording softened was
  precisely the safety-relevant one. Now "holding side of the fix" /
  "non-holding (unprotected) side of the fix". Regression tests: "names the
  unprotected side when the inbound crossing is off the holding side" and "names
  the holding side when the inbound crossing is on it" in
  `src/modules/wind-lab.test.ts`.
- **Fixed: the Anki core deck lost its ATC phraseology quotes on import**
  (`src/app/anki-export.ts`). `escapeField` neutralized tabs and newlines but not
  double quotes, and Anki's text importer is an RFC4180 reader: a field that
  *starts* with `"` is parsed as a quoted field, so the quotes are stripped and
  an odd count swallows the following tab. The card
  `'"Hold northeast of ABC as published" — what does ATC still owe you?'` is
  exactly that shape, and the quotes are what mark it as spoken phraseology.
  Quotes are now emitted as `&quot;`, which Anki renders as a plain quote, and
  each tag is escaped individually. Regression tests: "escapes double quotes so
  a quoted field is not eaten by the importer", "emits no raw double quote
  anywhere in the real core deck" and "keeps the tag column free of tabs and
  newlines" in `src/app/anki-export.test.ts`.

## Post-completion review fix — 2026-07-23 (codex review iteration)

- **Fixed: a charted hold's turns had no "per chart" copy and forced an arbitrary
  guess** (`src/engine/clearance.ts`, `src/modules/clearance-copy.ts`).
  `gradeLegLength` requires the student to copy a charted leg as `'published'`
  (`correct: user.leg === 'published'`), but `gradeTurnDirection` returned
  `correct: true` for *any* turn on the same charted hold — the one "as published"
  field with no matching form option and no real answer. The copy form (radios
  Right/Left only) then forced the student to pick a turn to submit at all, and the
  missing-turn error read "silence from ATC still means one of them" — the omitted-
  direction rule, which is exactly *not* how a charted hold's turns are set (they
  come from the plate, JO 7110.65BB 4-6-4 / 4-6-1). `CopiedClearance.turnDirection`
  now carries a `'published'` sentinel mirroring `leg`; the form has a "Per chart"
  turn radio; `gradeTurnDirection` grades a charted hold `correct` only when the
  student copies "per chart"; the error text now names both rules. Regression tests:
  "grades an 'as published' copy, requiring 'per chart' for course, leg, and turns"
  in `src/engine/clearance.test.ts`, and "'as published' requires 'per chart' turns;
  a guessed left/right is wrong" / "'as published' copied with 'per chart' turns
  grades clean" in `src/modules/clearance-copy.test.ts`.
- **Fixed: the leg-value field handed over the unstated-leg rule for free**
  (`src/modules/clearance-copy.ts`). The input pre-filled `value="1"` while the
  engine resolves an unstated leg to the standard 1-minute inbound (AIM 5-3-8 j4),
  so a student who never touched the field scored the omitted-field rule correct
  without applying it — the same free-credit failure the deliberately-unchecked
  turn radios avoid. The default is removed; an untouched leg now grades wrong.
  Regression test: "an untouched leg value grades wrong on an unstated-leg hold"
  in `src/modules/clearance-copy.test.ts`.
- **Fixed: a backward system clock could wedge a drill** (`src/app/store.ts`).
  Controllers set `answered = true`, then compute `timeSeconds` from a `Date.now()`
  delta and call `recordDrillResult`; the store rejected negative times with a
  `RangeError`, which a backward clock adjustment mid-scenario would trip, throwing
  out of the click handler and leaving the screen frozen with no way to advance.
  A non-finite time is still a programming error and throws; a negative time is now
  clamped to 0. Regression tests: "clamps a negative time to 0 rather than throwing
  (backward clock skew)" and "rejects non-finite times as programming errors" in
  `src/app/store.test.ts`.

## Correction — 2026-08-02 (parallel entry rejoin direction)

- **Fixed: the parallel entry's rejoin turn rotated with the pattern instead of against
  it** (`src/engine/entry.ts`, `src/engine/sim.ts`, `src/ui/mapview.ts`,
  `src/modules/entry-drill.ts`, `src/content/lessons.ts`, `src/content/oral.ts`,
  `src/content/anki-deck.ts`). This reverses the 2026-07-22 entry above, which flipped
  the field the wrong way; **that entry is kept, marked superseded, because its failed
  reasoning is what a future session will otherwise repeat.**

  **What was wrong.** `entryGuidance('parallel')` returned `turnToInbound: pattern`, so a
  standard right-turn hold was drawn and taught with a **right** rejoin. The rejoin's arc
  centre then sits on the **nonholding** side and the whole entry track is mirrored about
  the holding course, displacing it roughly two turn diameters onto the nonholding side.
  For the reported case (inbound 140, left turns, heading 251) the drawn rollout was
  misplaced by **1.72 NM** (−1.05 → +0.67 NM perpendicular offset); `sim.ts`'s whole-track
  error was ~1.9 NM at 90 kt, scaling to ~3.2 NM at 150 kt. The nonholding side *is*
  protected airspace, but it is the narrower allowance and is sized for the one-minute
  outbound leg plus drift, not for an extra ~2 turn radii beyond it — **the template widths
  behind that asymmetry are unverified by this project** (`docs/research-claude.md` sources
  the 8/4 NM framing to a CFII, not to the FAA), and both the claim and the "unprotected"
  wording this ledger blessed at the 2026-07 entry above (`src/modules/wind-lab.ts`) are
  pending in `docs/plans/20260802-protected-airspace-terminology.md`. This is a
  safety-of-flight training defect in a drill tool: a pilot who rehearses it here flies it
  that way. ACS IR.III.B.K1 / R4 / S1.

  **The correct rule.** With `C` the inbound course, the rejoin turn opposes the pattern
  and crosses back over the course onto the **holding** side: standard/right-turn hold →
  **left** rejoin rolling out on `C − 45°`; nonstandard → **right** rejoin on `C + 45°`;
  sweep ~225° either way. Both of a parallel entry's first two turns oppose the pattern;
  only the final turn on reaching the fix follows it. The 45° intercept is convention, not
  AIM text (the AIM requires only "more than 180 degrees"), and it is **not** a measurement
  of the figures: the one rollout tangent actually measured in the dossier is ≈31°
  (FIG 5-3-4, `arrow-inner.png`). 45° is a drawing choice for legibility, single-sourced as
  `PARALLEL_INTERCEPT_DEG` in `src/engine/entry.ts` so the map and the sim cannot disagree
  about it. Only the direction is evidence-backed; the angle is house convention.

  **Evidence.** AIM 5-3-8 j3(a)'s "turn in the direction of the holding pattern through
  more than 180 degrees" is **spatial** (toward the racetrack), not rotational, and the
  sentence alone cannot settle it. **Two** FAA figures were fetched and rendered at high
  resolution and inspected visually — AIM **FIG 5-3-4** (900 dpi from the vector PDF plus
  the official faa.gov PNG) and AIP **FIG ENR 1.5-3** (3162×2238) — and both draw the
  parallel rejoin crossing the course onto the holding side. **FIG 5-3-4 is decisive**: in
  one standard-pattern figure the *teardrop* rejoin is clockwise and the *parallel* rejoin
  counter-clockwise (dossier Source 1, observation 5), so the identical AIM phrase cannot
  be carrying rotational sense in both sub-paragraphs; FIG ENR 1.5-3 reproduces the same
  discrimination in an independently drawn figure. IFH FAA-H-8083-15B **Fig 10-6** is
  reported by the discovery dossier to show the same thing but was **not re-fetched or
  rendered in this pass** — it is second-hand and carries no weight here
  (`docs/parallel-entry-evidence.md`, "Sources deliberately not cited"). The correction
  does not rest on it. ICAO Doc 8168 Vol I,
  Part II, §6, Ch.2 (6th ed. 2018) states it in words: 2.2.4 (parallel) "turned **toward
  the holding side**", 2.2.5 (teardrop) "turned **right**". IPH FAA-H-8083-16B contains no
  entry-path figure and cannot discriminate — do not cite it either way. Full dossier with
  URLs, byte sizes, page numbers, render commands and what was seen:
  **`docs/parallel-entry-evidence.md`**.

  **⚠️ The ">180°" clause must never be used to re-derive this.** `docs/research-claude.md`
  argued that only the pattern-direction turn exceeds 180°; that arithmetic measures the
  bearing to the fix at the *start* of the turn and never updates it for the aircraft's
  motion *during* the turn. Computed correctly across the parallel sector: right turn
  212.6°–222.1°, left turn 189.3°–215.3° — **both exceed 180°**, exactly equal (215.3°) at
  zero offset by symmetry. That note is corrected in place, with the superseded derivation
  quoted and its failure named.

  **Why it spread to five modules.** The same geometry was hand-written three times
  (`entry.ts`, `sim.ts`, `mapview.ts`) instead of derived once — against CLAUDE.md's
  "engine is the oracle" rule. What drifted was the rejoin **sign**; the intercept *angle*
  did not — `sim.ts` carried a private `PARALLEL_INTERCEPT_DEG = 30` and `mapview.ts` a bare
  literal 30, the engine defined none, and the two consumers agreed. The angle was raised to
  45 here as a legibility choice and single-sourced at the same time; that is a change, not a
  drift repair. All three now consume the exported
  constant, and `mapview.ts`/`sim.ts` derive the rejoin sign rather than restating it.
  Inverting the engine alone left the full suite green, because nothing cross-checked the
  map or the sim against the oracle; that silence is what
  `src/parallel-entry.invariants.test.ts` now closes.

  **Deliberately unchanged** (verified, not overlooked): sector classification and the 70°
  geometry (`determineEntry(251, {inboundCourse: 140, turnDirection: 'left'}).primary` is
  still `'parallel'`); the outbound leg's nonholding side, which is the defining feature of
  the entry; `racetrack()`; direct and teardrop, which rejoin **with** the pattern;
  `towardHoldingSide`'s ±30°, which is the *teardrop's* AIM 5-3-8 j3(b) offset and a
  different quantity from the parallel intercept angle; and every AIM citation.

  **Known model limitation, documented not fixed.** `sim.ts` starts the aircraft
  established on the inbound course at the fix, so its turn onto outbound is a full 180°
  and leaves the aircraft 2R off course; from there the corrected rejoin is *tangent* to
  the holding course rather than crossing it. The real maneuver arrives at an angle from
  sector (a) and genuinely crosses. `flyCircuit` is only ever called with `entry: 'direct'`
  (`src/modules/wind-lab.ts`), so the parallel branch is unreachable in the shipping app.
  Consequence for tests: the `-2R` bound holds only **through rejoin completion**, not over
  the whole track (whole-track minimum is −1.3022 after the fix vs −1.9099 before), and
  asserting `-2R` whole-track would be a red test that argues a future session back into
  the wrong turn direction.

  **Known drawing limitation, documented not fixed.** The parallel path's trailing `L fix`
  in `mapview.ts` is a *schematic return chord* — the same one the teardrop path uses — not
  a drawn intercept leg. Its bearing is fixed by where the rollout point lands and does not
  track `PARALLEL_INTERCEPT_DEG`, so raising the angle 30 → 45 opened a ~15° kink at rollout
  (~35° on a 4 NM leg): the picture's own intercept angle now disagrees with the constant
  and with the `flyItText` narration beside it. The rollout **point** is at the engine's
  angle and is what `mapview.test.ts`'s golden case and the invariants sweep pin, so the
  *direction* this correction is about is drawn right; only the run home is illustration.
  A real fix means extending the rollout ray to where it meets the holding course and then
  tracking inbound, which needs a case for legs short enough that the meeting point falls
  past the fix — a change to the picture, deferred. Reverting the constant to 30 would also
  close it; 45 was a deliberate legibility choice, not a correctness one.

  Regression tests — "parallel: outbound course on the nonholding side, reintercept AGAINST
  the pattern", "nonstandard mirrors: teardrop offset flips, parallel reintercept is
  right", "direct and teardrop reintercept with the pattern, parallel against it", "the
  golden case: inbound 140, left turns → the rejoin is a RIGHT turn", "the intercept angle
  is 45°, single-sourced in the engine" and "A3: the parallel rejoin sweeps 225°, and an
  inverted rejoin would give 135°" in `src/engine/entry.test.ts`; "parallel: outbound turn opposes
  the pattern, and so does the reintercept" and "left-turn parallel mirrors: flies the east
  (non-holding) side" in `src/engine/sim.test.ts`; "parallel: leg on the non-holding side,
  >180° reintercept turn against the pattern", "parallel mirrors for a nonstandard hold"
  and "parallel golden case: inbound 140, left turns → rollout northeast of the course" in
  `src/ui/mapview.test.ts`; the nine `flyItText` tests in `src/modules/entry-drill.test.ts`
  including "A1: the named fix-crossing turn matches the rejoin across the parallel
  sector"; "entries lesson glosses the parallel rejoin as opposite the pattern" and
  "entries lesson names the two-turns-against structure of the parallel entry" in
  `src/content/lessons.test.ts`; "entries item answers the parallel rejoin as opposite the
  pattern" in `src/content/oral.test.ts`; "parallel-entry card glosses the rejoin as
  opposite the pattern" in `src/content/anki-deck.test.ts`; and the cross-module guard
  `src/parallel-entry.invariants.test.ts` — "sweep flag matches entryGuidance
  turnToInbound for every course × pattern", "A2: the rejoin rolls out on the holding side
  for every course × pattern", "rejoin rotation sense matches entryGuidance turnToInbound
  for every course × pattern" (the sim↔engine guard, and the only assertion that measures
  the ROTATION the integrator actually flies), "rejoin rolls out on the engine intercept
  angle for every course × pattern", "no shipping module calls flyCircuit with an entry
  other than direct", "every parallel-rejoin sentence states the corrected rule"
  and "the negatives cannot match the AIM clause the modules quote verbatim".

  **Post-review, 2026-08-02.** Mutation testing found the sim's rollout angle was
  single-sourced in code but not in assertion: replacing `PARALLEL_INTERCEPT_DEG` in
  `sim.ts` with a literal `30` left all 583 tests green, because the rotation guard checks
  only `Math.sign` and `> 180°` and a 210° sweep satisfies both. The same mutation in
  `mapview.ts` failed, so of the two consumers the branch single-sourced, only one was
  actually held to the oracle. "rejoin rolls out on the engine intercept angle" closes it
  by reading back the heading the integrator flies after rollout; the rejoin sample window
  is now derived from `TURN_RATE_DEG_PER_S`/`SAMPLE_SECONDS`/`PARALLEL_INTERCEPT_DEG`
  rather than the literals 120 and 195, which were only correct at the current constants.
  The caller bound on the model limitation below ("only ever called with `entry: 'direct'`")
  is likewise now asserted rather than merely stated, and the prose scan's anti-vacuity
  guard counts per known carrier instead of one global total.

- **Fixed: the entry drill named no outbound-timing reference, and the familiar per-entry
  split was folk knowledge** (`src/modules/entry-drill.ts`). The drill told the student to
  fly the outbound leg "for one minute" without saying when the minute starts — the exact
  point a parallel entry differs from a direct in practice — and the split students are
  usually taught ("time from the fix on a parallel or teardrop, from abeam on a direct")
  appears nowhere in the AIM. The drill now renders AIM 5-3-8 j4(b) **verbatim**,
  re-verified against the live faa.gov `aim_html/chap5_section_3.html` (second sub-item
  under "Timing"): "Outbound leg timing begins over/abeam the fix, whichever occurs later.
  If the abeam position cannot be determined, start timing when turn to outbound is
  completed." That is `OUTBOUND_TIMING_AIM`, cited as `AIM 5-3-8 j4(b)`. The AIM makes
  **no per-entry distinction**, so the split is rendered separately as
  `OUTBOUND_TIMING_NOTE` and explicitly labelled "a derivation from that sentence, not AIM
  text" — per CLAUDE.md an unverifiable claim is labelled, never asserted, and presenting a
  derivation as a citation is the same failure class this correction exists to fix.
  Regression test: "quotes the AIM outbound-timing sentence verbatim for every entry, with
  its citation" in `src/modules/entry-drill.test.ts`.

## Post-completion review fix — 2026-08-02 (code review iteration)

- **Fixed: IFH FAA-H-8083-15B Fig 10-6 was asserted as rendered first-hand evidence in five
  places while the dossier said it was never fetched** (`CLAUDE.md`, `docs/content-audit.md`
  above, `docs/research-claude.md`, `src/engine/entry.ts`, `src/engine/entry.test.ts`,
  `src/engine/sim.ts`). `docs/parallel-entry-evidence.md` states plainly under "Sources
  deliberately not cited" that Fig 10-6 was **not re-fetched in this pass** and should be
  treated as second-hand; every other artifact said "three FAA figures rendered and visually
  inspected", one adding a "(1000 dpi)" render that never happened, and two attributed the
  decisive same-figure discriminator to Fig 10-6 when the dossier records it as observation 5
  of **FIG 5-3-4**. Per CLAUDE.md an unverifiable claim is labelled, never asserted — and
  `research-claude.md` is precisely the file whose confidently-worded, under-verified note
  caused the original defect, so it had reacquired the failure mode it was being corrected
  for. All sites now read "two figures rendered (FIG 5-3-4, AIP FIG ENR 1.5-3)", name
  FIG 5-3-4 as the discriminator, and label Fig 10-6 second-hand. The conclusion is
  unchanged: two independently drawn figures plus ICAO Doc 8168 2.2.4 already settle it.

- **Fixed: `PARALLEL_INTERCEPT_DEG = 45` was justified by a figure measurement that says
  ≈31°** (`src/engine/entry.ts`, `docs/parallel-entry-evidence.md`, this ledger). Four
  artifacts claimed 45° "matches how the FAA figures draw the rollout"; the only rollout
  tangent actually measured in the dossier is ≈31° (Source 1, observation 4) — nearer the
  30 both consumers already used than to 45, which is why 45 is recorded as a legibility
  choice made here rather than as a correction of the old value. The angle is now stated as a legibility
  convention, and the dossier says explicitly that it establishes the rejoin's **direction**
  only.

- **Fixed: the A3 test could not fail** (`src/engine/entry.test.ts`). It derived the rollout
  heading from `turnToInbound` — `normalizeDeg(c + 45 * rejoinSign)` — and then measured the
  sweep in that same direction. The outer sign cancels the inner one
  (45·rs² − 180·rs = 45 − 180·rs), so the sweep is 225° for **both** senses: the test named
  for the inversion this correction exists to fix passed with the engine inverted, across all
  18 course × pattern combinations. The rollout is now fixed at `C − 45·pattern`, derived
  from a quantity independent of the field under test, and an inverted engine yields 135°.
  Verified by flipping `turnToInbound` in `entry.ts` and confirming the test fails.

- **Fixed: the sim was never compared to the oracle** (`src/engine/sim.ts`,
  `src/parallel-entry.invariants.test.ts`). `sim.ts` hand-derived the turn sign from
  `hold.turnDirection`, aliased it (`reinterceptTurnSign = outboundTurnSign`), then re-derived
  it a third time in `rolloutHeading` as `-PARALLEL_INTERCEPT_DEG * pattern` — three spellings
  of one quantity in eight lines, the same drift class this correction fixes across files,
  reproduced at function scope. Every parallel assertion in `sim.test.ts` is a hardcoded
  golden excursion, so the sim was pinned against itself: substituting 30° for 45° passed
  every one of them. The sign now comes from `entryGuidance(...).turnToInbound`, and a new
  invariant integrates the signed cross product of successive track segments over the rejoin
  window to assert the **rotation the integrator actually flies** matches the engine — which
  is also the faithful trajectory-level >180° sweep that the deleted excursion proxy never
  was. Regression test: "rejoin rotation sense matches entryGuidance turnToInbound for every
  course × pattern" in `src/parallel-entry.invariants.test.ts`.

- **Fixed: `mapview.ts` re-derived the rejoin direction from the pattern** while its own
  header claimed "Nothing about a turn direction is derived here". `entryPathD` already
  receives the engine's guidance, so `const rs = s === 1 ? -1 : 1` was a second hand-written
  copy of the engine's rule; it now reads `g.turnToInbound`. Covered by the existing map
  sweep-flag and A2 rollout-side invariants (verified by substituting the old private copy).

- **Fixed: the drill named a fix-crossing turn the pilot must not make, inside the ±5°
  boundary band** (`src/modules/entry-drill.ts`). `flyItText` read the fix-crossing turn off
  `turnToInbound`, but that turn is taken from the **aircraft's heading**. The two agree
  throughout the parallel sector; inside the ±5° teardrop/parallel band (AIM 5-3-8 j8(d)),
  where parallel is still graded correct, they do not — at heading 177 into a standard hold
  on inbound 000 the turn onto 180° is 3° to the **right**, and the drill said "turn left
  onto 180° … both turns opposite the pattern". Reachable in ~1.7% of generated scenarios.
  `flyItText` now takes the heading, names the turn the pilot actually makes, says "roll out
  on" when the aircraft is already aligned, and claims "both turns opposite the pattern" only
  when it is true of the scenario shown. Regression tests: "at the teardrop/parallel boundary
  the named turn follows the heading, not the pattern" and "exactly aligned with outbound: no
  fix-crossing turn is named at all" in `src/modules/entry-drill.test.ts`; the A1 sweep now
  covers the sector interior (d = 185…285) rather than one heading.

- **Fixed: the prose guard rejected correct nonstandard prose and scanned a hand-listed set**
  (`src/parallel-entry.invariants.test.ts`). `WRONG` contained a bare `reintercepts right`,
  which is the **corrected** rule for a left-turn hold — a guard that fails on correct prose
  gets weakened, and then it guards nothing; the alternatives now carry the pattern with them.
  The three scanned modules were hand-listed, leaving `questions.ts` (which carries entry
  prose) and any module added later unscanned — the same exhaustiveness hole CLAUDE.md
  describes for `TIERS` and `OVERLAY_ALPHA`. Content modules are now globbed with the eager
  `?raw` idiom from `palette.test.ts`, and the non-vacuity check is aggregated across modules
  so one that says nothing about the rejoin is silent rather than failing.

- **Fixed: the protected-airspace asymmetry was asserted without a source** in the correction
  entry above, contradicting both `src/modules/wind-lab.ts`'s shipped "unprotected" wording
  and the 2026-07 ledger entry that blessed it. Now labelled unverified and pointed at
  `docs/plans/20260802-protected-airspace-terminology.md`, so the ledger records an open
  contradiction instead of two entries that quietly disagree.
