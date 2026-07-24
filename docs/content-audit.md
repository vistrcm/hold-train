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
| entries | sectors, teardrop 30°/1 min, parallel >180° | AIM j3 verbatim; sector sizes 180/70/110 depicted in FIG 5-3-4 (figure, not body text) | pass (caveat **fixed**, item 2) |
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
leans 8-1-5. Verdict: pass, with **fixed** items 1, 3, 4, 6, 7 above.

### src/content/lessons.ts (5 lessons, 16 paragraphs)

Each paragraph re-verified against the paragraphs listed above (why-hold: AIM 5-3-8 +
P/CG + 91.167 + ACS; anatomy: j1/i5, j4/j5, j2/d, i; entries: j3/FIG 5-3-4, j8(d)/j3,
thumb method explicitly labeled a field technique with AIM cited only for sector
geometry; timing-wind: j4, j8(c), j5; reports: 5-3-3 a1(f)/(g), i6 + P/CG + 91.167,
91.185(c)(3)). Verdict: pass, with **fixed** items 1, 2, 7 above.

## Engine is the oracle — verified

- `questions.ts`: all 11 entry questions are built by `buildEntryQuestion` →
  `determineEntry` + `entryOptionSet`; no hand-keyed entry answer exists in the file.
  Enforced by tests: "keyed answer always equals the determineEntry output",
  dual-keying exactly when near-boundary, no engine-acceptable distractors.
- `entry-drill.ts`: grading and sector overlays come from `determineEntry` directly.
- `wind-lab.ts` / `sim.ts`: entry decision is user input; turn geometry from the engine.
- `oral.ts`, `lessons.ts`, `anki-deck.ts`: state sector *facts* (sizes, offsets) only —
  no scenario→entry mappings anywhere (checked by review; lessons file states the rule
  in its header comment).
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
