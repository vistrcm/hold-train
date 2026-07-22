# Holding-Pattern Trainer — Web Research: Pedagogy, App Landscape, Exam Formats

Date: 2026-07-21. Method: deep-research workflow (5 search angles → 26 source fetches → 25 top claims × 3-vote adversarial verification → synthesis; 102 agents total). Every finding below survived verification with source quotes confirmed by live fetch on 2026-07-21. Complements `docs/research-claude.md` (FAA-source holding rules); this report covers teaching methods, competing trainer apps, and exam/checkride practice formats.

## Summary

Teaching converges on the **thumb method** (right/left thumb at 3/9 o'clock on the HSI; the ~20° thumb width reproduces the 70° sector line) plus **EFB draw-it-out** as the two mainstream entry techniques. Instructors report **entry choice, wind-correction angle, and outbound-leg timing** as the dominant student difficulties. **No reviewed product applies learning-science methods** (spaced repetition, interleaving) explicitly.

The competitive field has a clear **web gap**: PilotsCafe Holding Trainer Pro (iOS/Android), FlyGo IFR Holding Pattern Trainer ($5.99, Apple-only), and Holding Pattern Computer ($11.99, Apple-only calculator, no drills) are all native apps, and Sheppard Air's dominant test-prep approach is pure rote answer-lookup — leaving concept-based, browser-based drilling unserved.

On the IRA written, holding questions are overwhelmingly **figure-based entry-determination** items (~33 tracked questions across standalone hold diagrams and real approach-chart missed-approach holds), including boundary cases keyed **"parallel or teardrop"** — drill grading must accept dual-correct entries near sector boundaries. Physical entry aids are FAA-permitted in the test room per Order 8080.6H. For the checkride, AIM entries are non-regulatory but explicitly evaluated ("explain and use") under ACS Task III.B with ±10 kt / ±100 ft / ±10° / ¾-scale CDI tolerances; a recommended drill is terminating every practiced missed approach with the published hold.

## Verified findings

### Teaching methods

1. **Thumb method is the most widely taught entry technique** (HIGH confidence, 3-0×3 votes). Right thumb at the 3 o'clock position of the HSI for right-turn (standard) holds, left thumb at 9 o'clock for left-turn holds, placed ~15–20° above the 90° point (Jason Miller variant); the ~20° thumb width reproduces the 70° line and carves the direct/parallel/teardrop sectors with no mental math. Taught independently by Boldmethod, Pilot Institute, and The Finer Points; AOPA coverage dates to 1998. Geometry is consistent with the AIM 70° line (90 − 70 = 20° above the 3/9 o'clock point). *Design: the tutorial's primary technique, visualized as a thumb overlay on the HSI.*
   - https://www.boldmethod.com/learn-to-fly/regulations/how-to-determine-your-holding-entry-procedures/
   - https://pilotinstitute.com/holding-patterns-explained/
   - https://www.learnthefinerpoints.com/articles/the-thumb-method-for-holding

2. **Draw-the-hold-on-the-EFB is the second mainstream technique** (MEDIUM, 3-0, single source). Boldmethod: "Another simple strategy is to draw out the hold on your EFB in relation to the fix you've been instructed to hold at" (ForeFlight parallel-entry example). *Design: validates a map-view/sketch-based drill mode; fits the user's Jeppesen/G1000 EFB workflow.*

3. **CFII lesson plans include a wind-distortion prediction exercise and grade against ACS numbers** (MEDIUM, 3-0×2). CFI Notebook's instrument holding lesson: "Have student: Predict wind effect on hold shape and explain how to adjust timing and heading" (incl. triple-drift outbound), with completion standards mapped verbatim to IR.III.B.S4 (±10 kt, ±100 ft, ±10°, ¾-scale CDI). *Design: include a wind-distortion drill; tag every drill with ACS element codes; grade sim runs against the actual ACS tolerances.*
   - https://www.cfinotebook.net/lesson-plans/instrument-rating/air-traffic-control-clearances-and-procedures/instrument-rating-holding-procedures-lesson-plan

4. **Dominant student difficulties: entry choice, wind-correction angle, outbound-leg length** (MEDIUM, 3-0). Pilot Institute (verbatim): "The most difficult areas of holding for pilots are the few minutes of uncertainty when they're figuring out which entry to use, what the wind correction angle is, and how long the outbound leg needs to be"; "The wind correction angle is often forgotten, leading to the aircraft drifting off course." Corroborated by CFI lesson plans and instructor forums. *Design: these three difficulties define the core drill categories.*

5. **Every practiced missed approach should end in the hold** (MEDIUM, 3-0). AOPA Pilot (Thomas A. Horne, Sept 2020): "When you practice missed approaches, do they always end with a missed approach hold? They should." *Design: chart-based missed-approach hold scenarios belong in the drill rotation, not just standalone diagrams.*
   - https://www.aopa.org/news-and-media/all-news/2020/september/pilot/on-instruments-holding-patterns

### Existing trainer apps

6. **PilotsCafe Holding Trainer Pro — the closest competitor** (HIGH, 3-0×2). Exactly three components: an Entry Trainer rapid-fire drill ("Practice until choosing holding entries becomes second nature"), a Holding Calculator using a minimal two-input model (bearing to fix + holding radial), and a Holding Tutorial. iOS/Android stores only — **no web version**. *Design: its drill-to-automaticity framing and two-input calculator are the baseline to match; mobile-only distribution is the gap to fill.*
   - https://www.pilotscafe.com/hold-trainer/

7. **TO/FROM bearing confusion is a documented trap — even for CFIIs** (HIGH, 3-0). A CFII one-starred the PilotsCafe app claiming "their clearances are just totally wrong"; the developer's aeronautically correct rebuttal: "You are confusing a bearing TO a station with a bearing FROM a station" (a 331° bearing TO the fix places the aircraft SE of it). *Design: use explicit AIM-style clearance phraseology; teach radial (FROM) vs bearing (TO) as its own micro-drill.*
   - https://apps.apple.com/us/app/holding-pattern-trainer/id456327713

8. **FlyGo IFR Holding Pattern Trainer: $5.99 one-time, Apple-only** (HIGH, 3-0×2). No Android or web version; actively maintained (v4.11, 2025–2026). NOTE: a claim detailing its four drill modes (learn/test/quick-finder/game) was REFUTED 1-2 — feature inventory beyond price/platform is unverified.
   - https://apps.apple.com/us/app/ifr-holding-pattern-trainer/id674946112

9. **Holding Pattern Computer (holdingpattern.com, $11.99) is a calculator, not a trainer** (MEDIUM; 3-0 characterization, 2-1 distribution). Computes wind correction, headings, leg timings, and shows entry solutions — but contains no drills, quizzes, scoring, or randomized scenarios. Apple-ecosystem only. *Design: wind-correction DRILLING (not just solving) is an open niche.*
   - https://holdingpattern.com/

10. **Sheppard Air teaches pure rote answer-lookup for hold entries** (HIGH, 3-0). Its IRA memory aid (v53, July 2025) has students imagine the figure as a VOR surrounded by letters D/P/T; the answer is whichever letter the holding radial strikes — zero conceptual entry teaching (no 70° line, sectors, or abeam logic anywhere). *Design: a concept-based trainer is directly positioned against this.*
    - https://www.sheppardair.com/acs/IRAwINFO%20ver02ZYX.pdf

### Exam coverage

11. **IRA written hold questions: figure-based entry determination in two formats** (HIGH, 3-0×2). (a) Standalone hold diagrams (testing-supplement Figs 87, 112–116); (b) missed-approach holds on real approach charts (GJT ILS 11, DRO ILS/DME 3, EUG ILS 16L, DUC LOC 35, LNK ILS 18, LIT RNAV 36; Figs 157–242). Sheppard tracks ~33 distinct holding question IDs, all entry-determination. Caveat: Sheppard's IDs are a commercial reconstruction of the unpublished, rotating FAA/PSI bank. *Design: include both diagram-based and chart-based missed-approach entry drills.*

12. **Boundary questions keyed "parallel or teardrop" exist on the written** (MEDIUM, 2-1). Three tracked dual-entry answers (Figs 218 DSM, 230 Baldwin Muni, 240 Buck Davis Field missed holds). Some boundary questions have historically been keyed to a single entry. *Design: free-response drills accept dual-correct entries near the 70° boundaries; exam-simulation mode mirrors literal option text.*

13. **Physical entry aids are permitted in the FAA test room** (HIGH, 3-0). FAA Order 8080.6H (verbatim): applicants may use "…holding pattern entry aids, and electronic or mechanical calculators…". Category-level authorization; handwritten notes prohibited, only manufacturer-inscribed aids qualify. *Design: offer both no-aid mental drills (cockpit/checkride) and aid-assisted practice (legitimate for the written).*
    - https://www.faa.gov/documentlibrary/media/order/faa_order_8080.6h.pdf

14. **Checkride: entries are non-regulatory but explicitly evaluated in both oral and flight** (HIGH, 3-0). ACS Task III.B: "explain and use an entry procedure that ensures the aircraft remains within the holding pattern airspace" for standard/nonstandard/published/nonpublished holds. DPEs report they cannot fail a non-AIM entry that stays within protected airspace. *Design: teach AIM entries as the graded default; frame protected airspace as the pass/fail criterion; map entry drills to IR.III.B skills and oral prep to the "explain" elements.*

## Caveats (verbatim from verification)

1. **Written-test specifics are time-sensitive and reconstructed** — the FAA stopped publishing its bank (~2008) and PSI rotates questions; Sheppard's ~33 IDs and dual-keyed answers are a commercial reconstruction (v53, July 2025), high-fidelity by reputation but unverifiable against FAA sources.
2. **App feature inventories beyond confirmed claims are unreliable** — FlyGo's drill-mode inventory was refuted 1-2; a claim about PilotsCafe's exact UX was refuted 0-3. Deeper competitive comparison requires hands-on app testing. Pricing verified as of July 2026 only.
3. **Pedagogy sources are secondary** (training publications, not peer-reviewed), and **no claim surfaced documenting learning-science-backed hold training** (spaced repetition, interleaving, deliberate practice) — that focus area came back empty, which is itself a finding: the learning-science design must be imported from general literature rather than aviation precedent.
4. holdingpattern.com "iOS-only" should strictly read "Apple-ecosystem-only" (2-1 split vote). ASA's aid "FAA approval" is category-level under Order 8080.6H, not product-specific.

## Open questions

- Do any existing hold trainers implement spaced repetition, interleaving, or adaptive difficulty? No evidence either way — hands-on testing would confirm the learning-science angle is genuinely unexploited.
- What do DPEs actually ask in the Task III.B oral beyond the ACS element list (lost-comm scenarios, EFC usage, holding-report contents, G1000 SUSP/OBS behavior)? Checkride debrief reports were not captured by surviving claims. (Partially covered by `research-claude.md` §15 model answers.)
- FlyGo's real drill-mode structure and user-pain data.
- Whether the current PSI bank still includes the specific dual-keyed boundary questions, and how the October 2025 AKT Matrix change affects permitted test-room materials.

## Design implications distilled (for the trainer build)

1. Thumb-method overlay on an interactive HSI is the flagship teaching visual (right thumb standard / left thumb nonstandard).
2. Map-view "sketch the hold" drills mirror the EFB technique.
3. Three core drill categories = entry choice, wind-correction angle, outbound timing — exactly the documented difficulty ranking.
4. Every drill tagged with ACS element codes; sim runs graded against real ACS tolerances (±10 kt / ±100 ft / ±10° / ¾-scale CDI).
5. Two written-prep formats: standalone diagram questions AND missed-approach holds on chart excerpts; exam-sim mode uses literal option formats including "parallel or teardrop."
6. Free-response entry grading accepts dual-correct near ±5°/boundary zones.
7. Explicit radial-vs-bearing phraseology everywhere + a dedicated TO/FROM micro-drill.
8. Wind-correction drilling (predict → compute → fly → debrief), not just a calculator.
9. Missed-approach hold scenarios including the user's local KHAF RNAV 30 → SEEMS hold and OSI climb-in-hold (from `research-claude.md` §16).
10. Anki TSV export instead of an in-app SRS — including an "export my misses" personalized deck; no competitor does any of this.
11. Printable/on-screen entry aid mode (legal in the test room) alongside no-aid timed drills for cockpit readiness.
