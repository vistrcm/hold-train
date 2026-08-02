# Holding Patterns for the FAA Instrument Rating — A Complete Study, Teaching, and Build Reference (KHAF / G1000 C182 / Jeppesen)

## TL;DR
- **Master three things and you pass the checkride and fly holds safely:** (1) stay inside protected airspace by crossing the fix at or below max holding speed (200 KIAS at/below 6,000 ft MSL, 230 KIAS 6,001–14,000, 265 KIAS above 14,000) and turning at 3°/sec or 30° bank (25° with a flight director), whichever is least; (2) determine the correct entry from your heading using the 70° line / thumb method; (3) fly one-minute inbound legs (1½ above 14,000) with proper wind correction (triple the inbound drift outbound). The ACS tolerances are ±10 kt, ±100 ft, ±10° heading, and within ¾-scale CDI.
- **Entry-procedure perfection matters far less than remaining on the holding side.** The FAA calls direct/parallel/teardrop "recommended," with ±5° tolerance at the boundaries; DPEs care that you correctly identify the entry, state it, and fly what you stated while staying in protected airspace.
- **In your G1000 C182 the navigator will fly published holds and HILPTs (fly-by, auto-suspend with SUSP), but you must be able to build an ATC-assigned uncharted hold using OBS mode and demonstrate you understand the geometry the box is drawing** — the checkride commonly includes a hold the database does NOT contain.

## Key Findings

**Primary regulatory sources (verified against the current FAA AIM, dated 1/22/26, and 14 CFR):**
- **AIM 5-3-8, "Holding"** — the master reference: clearance elements (para i), abbreviated "as published" clearances (para b), the 3-minutes/speed-reduction rule (para d), the 5-minute ATC advance-clearance guidance (para e), report-reaching/leaving the clearance limit (para f), the VOR outbound-turn timing note (para g), descriptive terms and standard/nonstandard patterns (j1), airspeeds (j2), entry procedures (j3), timing (j4), DME/GPS along-track distance holding (j5), RNAV distance substitution (j6), RNAV guidance and holding (j7), and recommended pilot actions including bank angle (j8).
- **AIM 5-3-3, "Additional Reports"** — subparagraph a.1(f): report "the time and altitude or flight level upon reaching a holding fix or point to which cleared"; subparagraph a.1(g): report "when leaving any assigned holding fix or point." Required at ALL times, radar or non-radar.
- **14 CFR 91.185, "IFR operations: Two-way radio communications failure"** — clearance-limit logic in (c)(3).
- **14 CFR 91.167 / 91.169** — IFR fuel requirements (destination + alternate when required + 45 minutes at normal cruise), the regulatory backdrop for holding fuel decisions.
- **FAA-H-8083-15B, Instrument Flying Handbook, Chapter 10** — holding technique, Figure 10-5 (triple-drift wind correction).
- **FAA-H-8083-16B, Instrument Procedures Handbook** — holding in the NAS, HILPT, RNAV holding.
- **FAA-S-ACS-8C, Instrument Rating–Airplane ACS (current revision; November 2023 per cover, FAA web listing April 2024 / effective May 31, 2024), Area of Operation III, Task B, "Holding Procedures."**

## Details

### 1. Purpose and concept (why holds exist)
A holding pattern is, per the Pilot/Controller Glossary, "a predetermined maneuver which keeps aircraft within a specified airspace while awaiting further clearance from air traffic control." It is a way for ATC to park an aircraft on known geometry. GA IFR pilots actually get holds for:
- **Traffic sequencing / flow control / delays** (the classic "expect holding" for arrival spacing).
- **Weather** at the destination (waiting for a ceiling to lift — very real at KHAF, where the marine layer routinely forces holding/approaches).
- **Awaiting an Expect-Further-Clearance (EFC) time.**
- **Hold-in-lieu-of-procedure-turn (HILPT)** — a course reversal to get established inbound on an approach.
- **Missed-approach holds** — nearly every IAP terminates in a hold at a missed-approach holding fix.
- **Lost communications** (91.185) — holding at a clearance limit.
- **Climb-in-hold** to gain altitude within protected airspace before proceeding on course (exactly the KHAF Runway 12 obstacle departure — see §16).

**Safety-critical framing:** the archetypal holding accident is **Avianca Flight 052** (Boeing 707, N nr Cove Neck, NY, January 25, 1990), which crashed from fuel exhaustion after being placed in holding three times and failing to clearly declare a fuel emergency. Per NTSB AAR-91/04 the flight held at ORF 1904–1923 (19 min), at BOTON intersection near Atlantic City 1943–2012 (29 min), and at CAMRN intersection (39 NM south of JFK) 2018–2047 (29 min) — about **1 hour 17 minutes** total; it entered the CAMRN hold at 14,000 ft MSL, and of 158 aboard, **73 were fatally injured**. Lesson: EFC times and holding fuel must be actively managed, and "minimum fuel" vs. "emergency/mayday fuel" must be declared unambiguously.

### 2. Anatomy and terminology (verified against AIM FIG 5-3-3, "Holding Pattern Descriptive Terms")
- **Holding fix:** the reference point (VOR, NDB, VOR/DME fix, intersection, or RNAV waypoint) where the pattern is anchored.
- **Inbound leg:** flown toward the fix on the **holding course** (the assigned radial/course/bearing/airway).
- **Outbound leg:** flown away from the fix, parallel to and offset from the inbound course.
- **Fix end** and **outbound end:** the two turning ends of the racetrack.
- **Abeam point:** the point on the outbound leg abeam the fix; where outbound timing normally starts.
- **Holding side:** the side of the holding course on which the racetrack lies (contains the turns). **Non-holding side:** the opposite side.
- **Standard pattern:** **right turns.** **Nonstandard pattern:** **left turns** (must be stated in the clearance).
- **Protected airspace (TERPS, pilot-relevant only):** the hold is surrounded by protected airspace sized around the max holding speed and a 25°-bank turn radius. Per Jason Miller (The Finer Points), the correct framing is **holding side (~8 NM protected) vs. non-holding side (~4 NM protected)** — NOT "protected vs. unprotected." Staying inside this airspace is why speed limits, entry procedures, and bank angles exist. **This is the safety keystone: entries are recommended aids to staying inside protected airspace, not ends in themselves.**

### 3. ATC holding clearances — required elements (AIM 5-3-8 i, verified verbatim)
For a hold at a fix where the pattern is **not** charted, the clearance includes, in order:
1. **Direction** of holding from the fix (one of the eight cardinal compass points: N, NE, E, SE, S, SW, W, NW).
2. **Holding fix** (may be omitted if it was already stated as the clearance limit).
3. **Radial, course, bearing, airway, or route** on which to hold.
4. **Leg length in miles** if DME/RNAV is to be used (leg length is given in minutes only on pilot request or if the controller deems it necessary).
5. **Direction of turn** — stated **only if left turns**, if the pilot requests, or if the controller deems it necessary. (Trap: if turn direction is NOT stated, it is a **standard, right-turn** pattern.)
6. **Time to expect further clearance (EFC)** and any additional delay info.

**Abbreviated / "as published" clearances (AIM 5-3-8 a, b):** if the pattern is charted on the assigned procedure or route, ATC may omit everything except the holding direction and "AS PUBLISHED" — e.g., **"HOLD EAST AS PUBLISHED."** ATC must always issue full instructions if the pilot requests them.

**"Expect Further Clearance" (EFC):** the time you can expect to be released or re-cleared. Its main safety function is **lost communications** — under 91.185 the EFC governs when you leave the clearance limit. Write it down.

**Approaching the clearance limit without further clearance (AIM 5-3-8 c):** ask ATC for holding instructions **before** reaching the fix. If you can't get them (frequency congestion, stuck mic), **enter a standard pattern on the course on which you approached the fix** and request clearance ASAP; your altitude at the clearance limit is protected. (This mirrors, but is distinct from, the 91.185 lost-comm case — AC 90-46 historically warned the two should not be conflated.)

**Speed reduction (AIM 5-3-8 d):** when 3 minutes or less from the clearance limit without further clearance, begin slowing so you cross the fix at or below max holding speed.

**No-delay case (AIM 5-3-8 e):** when no delay is expected, ATC issues the onward clearance as soon as possible and, whenever possible, at least **5 minutes** before the aircraft reaches the clearance limit.

### 4. Charted holds and Jeppesen depiction
Holds are charted on low/high en route, area, SID/ODP, STAR, and approach charts. Per AIM 5-3-8 h, only holds depicted on U.S. Government or FAA-compliant commercial charts should be used, and pilots hold in the depicted pattern unless advised otherwise.

**Line-weight semantics (verified — applies to BOTH FAA/AeroNav and Jeppesen charts):**
- **HILPT (hold-in-lieu-of-procedure-turn):** drawn as a **solid, bold (heavy) racetrack** at an IAF. The heavy line signals a required course reversal (must be flown unless being vectored, "NoPT," cleared straight-in, or timed approaches in use).
- **A thin-line racetrack at an IAF/fix** = a common holding fix or an **arrival hold**, not a HILPT (not a mandatory course reversal).
- **Missed-approach hold:** the racetrack at the missed-approach holding fix.
- Per the Aeronautical Chart Users' Guide: if two holds coincide at one point, the procedural (HILPT) pattern is shown in preference to arrival/missed patterns.

**Jeppesen specifics for your training:** Jeppesen depicts the HILPT the same way (bold line) and additionally draws a clean **45°/45° procedure-turn barb** where a PT (rather than a hold) is charted. A trap: Jeppesen's clear 45/45 depiction leads students to believe they must fly turns a specific distance away from the airport — you are NOT restricted to tracing Jepp's black lines; you may turn back toward the airport to stay inside the 10 NM PT limit. **"Hold as published" means fly exactly the charted racetrack** (direction, turns, leg length/speed).

### 5. Entry procedures — exact geometry (AIM 5-3-8 j3, verified verbatim)
The FAA explicitly states the entries are **recommended**: "the parallel, teardrop and direct entries are the procedures for entry and holding recommended by the FAA, and were derived as part of the development of the size and shape of the obstacle protection areas for holding" (5-3-8 j3(d)).

**The 70° line and sector sizes (for programming a trainer):**
Define the **holding course** as the inbound course TO the fix, and the **outbound bearing** = reciprocal of the inbound course. Draw a single dividing line through the fix oriented **70° from the holding course**, tilted onto the **holding side**. This produces three sectors:
- **Direct entry sector: 180°** — the entire holding side plus part of the non-holding side.
- **Teardrop entry sector: 70°** — on the holding side, adjacent to the outbound leg.
- **Parallel entry sector: 110°** — on the non-holding side.
Teardrop (70°) + Parallel (110°) = 180°; Direct = the other 180°.

**Precise sector boundaries:**
- **Standard/right turns:** the parallel sector spans the 110° arc on the **non-holding (left) side** of the inbound course; the teardrop sector spans the 70° arc on the **holding (right) side** measured from the outbound leg; **direct** is everything else (the remaining 180°). Algorithmically (KL Aviation / Boldmethod formulation): parallel sector = 110° measured from the fix in the direction of the holding turn; teardrop sector = 70° measured from the fix opposite the direction of the holding turn.
- **Nonstandard/left turns:** the pattern is mirrored. Per AIM 5-3-8 j3(e): "Entry procedures to a nonstandard pattern are oriented in relation to the 70 degree line on the holding side just as in the standard pattern." So flip left/right: parallel sector on the (now right) non-holding side, teardrop on the (now left) holding side.

**±5° boundary tolerance (verified verbatim, AIM 5-3-8 j8):** "Determine entry turn from aircraft heading upon arrival at the holding fix; +/- 5 degrees in heading is considered to be within allowable good operating limits for determining entry." (Many instructors teach a looser ~10° "buffer zone" in which either adjacent entry is acceptable — this is a teaching simplification, not the AIM number. The AIM number is **±5°**.)

**Step-by-step execution:**
- **Direct:** cross the fix, turn in the direction of the pattern to fly the outbound leg, fly the racetrack. Simplest; "everyone hopes for direct."
- **Teardrop:** cross the fix, turn to a heading **30° from the outbound course toward the holding side** (standard/right ≈ outbound course − 30°; equivalently inbound course + 150°), fly ~1 minute, then turn in the direction of the pattern to intercept the inbound holding course.
- **Parallel:** cross the fix, turn to **parallel the holding course outbound on the NON-holding side** (fly the outbound heading, no offset), fly 1 minute, then **turn in the direction of the holding pattern through MORE than 180°** and return to the fix or intercept the inbound course (AIM 5-3-8 j3(a), verified against faa.gov 2026-07-22). **"In the direction of the holding pattern" here is *spatial* — toward the racetrack — not *rotational*.** The rejoin turn rotates **opposite** the pattern's turns and crosses back over the holding course onto the holding side: standard/right-turn hold → **left** rejoin; nonstandard/left-turn hold → **right** rejoin. Both of a parallel entry's first two turns (onto outbound, then the rejoin) oppose the pattern; only the final turn on reaching the fix follows it.
  - **RE-CORRECTED 2026-08-02 — and this line's own 2026-07-22 "correction", quoted below, was the defect.** The evidence is **two** FAA figures, rendered at high resolution and visually inspected: AIM **FIG 5-3-4** and AIP **FIG ENR 1.5-3**. Both draw the parallel rejoin crossing the course onto the holding side. **FIG 5-3-4 is decisive** because it draws the *teardrop* rejoin clockwise and the *parallel* rejoin counter-clockwise **in one standard-pattern figure** — the AIM uses the same phrase for both, so the phrase cannot be carrying rotational sense. ICAO Doc 8168 Vol I, Part II, Section 6, Chapter 2 (Sixth Edition 2018) says in words what the AIM says only in a picture: 2.2.4 Sector 1 (parallel) "the aircraft is **turned toward the holding side**"; 2.2.5 Sector 2 (offset/teardrop) "the aircraft is **turned right**" — spatial for one, rotational for the other, deliberately different wording in the same document. IFH FAA-H-8083-15B **Fig 10-6** is reported by the discovery dossier to show the same thing, but was **not re-fetched or rendered in this pass** and is therefore second-hand — *unverified* by this project, and deliberately not load-bearing. ⚠️ This line is in the file whose previous confidently-worded, under-verified note WAS the defect; do not let it acquire another. **Full dossier with URLs, byte sizes, render commands and what was seen: `docs/parallel-entry-evidence.md`. Read that instead of re-deriving the answer from the AIM sentence.**
  - **⚠️ The ">180°" derivation quoted here is invalid and must never be reasoned from again — it is the root cause of the 2026-07-22 flip.** It measures the bearing to the fix at the *instant the rejoin turn begins* and never updates it for the aircraft's motion *during* the turn — but the aircraft translates along the whole arc, so the rollout heading that points back at the fix moves with it. Computed correctly across the parallel sector: right turn **212.6°–222.1°**, left turn **189.3°–215.3°** — **both exceed 180°**, and at zero lateral offset they are exactly equal (215.3°) by symmetry. AIM j3(a)'s "more than 180 degrees" clause therefore **does not discriminate between the two readings at all**, and any argument leaning on it is void regardless of which answer it reaches. The genuinely counterintuitive part, and why the error is easy to make in either direction, is that the correct rejoin first carries the aircraft *further from* the fix before it crosses the course back toward the holding side.
  - **The superseded 2026-07-22 text, quoted verbatim and kept, because the failed reasoning is the useful part** — a silently rewritten line invites a third flip. Note the layering: the text it calls "previously read" was the *original and correct* wording, which this note talked the repo out of.

    > **CORRECTED 2026-07-22.** This line previously read "turn toward the holding side through MORE than 180°… the reintercept turn is made in the **opposite** direction of the holding turns," which is wrong and is what the engine was built from. The two halves of that sentence cannot both be true: parallelling outbound on the nonholding side leaves the fix bearing back *across* the course, so the turn **opposite** the pattern is always **less** than 180° and the turn **with** the pattern is always **more**. Worked example (inbound 270, right turns, outbound 090): the aircraft ends south-east of the fix, which then bears ~285. Right turn 090→285 = 195°; left turn = 165°. Only the pattern direction satisfies the AIM. The counterintuitive part — and why the error is easy to make — is that the correct turn initially goes *away* from the holding side.

    Where it fails: "the aircraft ends south-east of the fix, which then bears ~285" fixes the target bearing at the *start* of the turn. Fly the arc and that bearing rotates with the aircraft; redone with the bearing updated through the turn, the left (correct) rejoin lands in **189.3°–215.3°**, not 165°. The clause is satisfied either way, so it settles nothing.

**Common errors by entry type:**
- Direct: over-banking/overshooting the outbound rollout; starting timing too early.
- Teardrop: using the wrong sign on the 30° offset (turning to the non-holding side); not turning far enough back.
- Parallel: turning the wrong way on the reintercept — rolling *with* the pattern, which carries the aircraft further onto the non-holding side, instead of *against* it back through the course toward the holding side (see the corrected rule above and `docs/parallel-entry-evidence.md`; this line describes the **error**, not the procedure); "S-ing" across the course.

### 6. Entry-determination methods for teaching (core deliverable)
**(a) Thumb method (The Finer Points / Jason Miller; also Boldmethod).** Set the outbound course under the appropriate reference. **Use the RIGHT thumb for standard (right-turn) patterns, LEFT thumb for nonstandard (left-turn) patterns** — the thumb approximates the ~70° teardrop wedge on the holding side, and the holding side is the turn side. Place the thumb at 3 o'clock (right) or 9 o'clock (left) on the HSI/heading indicator, tilted ~15–20° up; the wedge under the thumb is the teardrop sector, opposite is parallel, below is direct. A thumb is ~20° wide against the HSI, which brackets the sectors adequately.
**(b) 70° line visualization.** Mentally draw the holding course across the HSI, then a second line 70° off it on the holding side; read which sector your inbound heading falls in.
**(c) Draw-the-hold-on-paper.** Sketch the fix, inbound course, and racetrack on the correct side; plot your arrival heading; pick the entry visually. Best for chair-flying and building the mental model.
**(d) HSI/CDI "twist" trick (G1000-friendly, single-pilot robust).** Twist the holding course onto the CDI/course pointer; the needle tail and compass rose then directly show your sector. Because you'll twist the course anyway (the "T" in the 5 Ts), this integrates with your workflow.
**(e) Relative-bearing arithmetic.** Add/subtract 70° and 110° to the holding radial to compute boundaries (classic Jeppesen question: hold on the 160 radial → 160 + 70 = 230 radial is the direct/parallel divider). Robust for the written; slow in the cockpit.

**Recommendation:** For **single-pilot G1000 workload**, the **CDI-twist + thumb cross-check** is fastest and most robust (uses instruments you're already manipulating, gives a redundant visual check). **Drawing the hold** is best for *learning* the geometry; **relative-bearing arithmetic** is best for the *written test*. Teach geometry first (draw-it), then transition to thumb/CDI for the airplane.

### 7. Timing and leg lengths (AIM 5-3-8 j4, verified verbatim)
- **Inbound leg:** **1 minute at or below 14,000 ft MSL; 1½ minutes above 14,000 ft MSL.** (Trap: the break is MSL, and the longer time is ABOVE 14,000, not at.)
- **Outbound timing start (verbatim):** "Outbound leg timing begins over/abeam the fix, whichever occurs later. If the abeam position cannot be determined, start timing when turn to outbound is completed."
- **Initial vs. subsequent legs (verbatim note):** "The initial outbound leg should be flown for 1 minute or 1½ minutes (appropriate to altitude). Timing for subsequent outbound legs should be adjusted, as necessary, to achieve proper inbound leg time." You adjust the OUTBOUND leg to make the INBOUND leg come out to 1 minute.
- **VOR station-passage nuance (AIM 5-3-8 g):** when holding at a VOR, begin the outbound turn at the first complete reversal of the TO/FROM indicator.

### 8. DME / GPS along-track distance legs (AIM 5-3-8 j5, verified)
DME/GPS holding uses **distances in NM instead of times.** The controller or chart specifies the outbound leg length; the end of the outbound leg is read off DME or ATD. Two verified worked examples from the AIM figures:
- **Inbound TOWARD the NAVAID**, fix at 10 NM, leg 5 NM → the outbound leg ends when DME reads **15 NM**.
- **Inbound AWAY from the NAVAID**, fix at 28 NM, leg 8 NM → the outbound leg ends when DME reads **20 NM**.
For published GPS procedures the fix is a database waypoint and the outbound end is set by ATD. RNAV distance may substitute for DME (AIM 5-3-8 j6), but the pattern flies slightly farther from the NAVAID due to lack of slant range.

### 9. Wind correction (AIM 5-3-8 j8 and IFH Fig 10-5, verified)
- **Inbound:** apply a normal single-drift crab to track the holding course to the fix.
- **Outbound (verbatim AIM):** "When outbound, triple the inbound drift correction to avoid major turning adjustments; for example, if correcting left by 8 degrees when inbound, correct right by 24 degrees when outbound." "Triple drift" compensates for drift on the outbound leg AND during both ~1-minute turns.
- **CONFLICT TO FLAG:** the AIM and IFH (Fig 10-5) prescribe **triple** the inbound correction outbound. A large CFI community teaches **double** as adequate in slower trainers and warns triple can be excessive when inbound corrections are large (e.g., a 20–30° inbound crab). Both are field techniques; the **FAA reference answer is triple**. For a slow C182, triple is a good starting point but may need reduction in strong wind (one worked technique caps the outbound heading so it never points within ~30° of the wind, reverting to double).
- **Timing effect:** headwind outbound → lengthen outbound time; tailwind outbound → shorten it (~1 second per knot of head/tailwind component). The goal is always a 1-minute *inbound* leg.
- **Teaching the wind triangle in the racetrack:** first circuit is the "no-wind orbit," flown as precisely as possible to reveal the inbound crab; subsequent "correction orbits" apply triple that crab outbound and adjust outbound timing.

### 10. Maximum holding airspeeds (AIM 5-3-8 j2, verified verbatim, TBL 5-3-24)
| Altitude (MSL) | Max KIAS |
|---|---|
| MHA – 6,000 ft | **200** |
| 6,001 – 14,000 ft | **230** |
| 14,001 ft and above | **265** |

**Exceptions (verified verbatim):**
- Holds from 6,001–14,000 ft may be restricted to **210 KIAS**, depicted by an icon.
- Holds may be restricted to a specific max speed shown in **parentheses inside the pattern**, e.g., **(175)**; be at/below it before crossing the fix. (175-KIAS holds use the 200-KIAS template ≤6,000 and the 230-KIAS template >6,000 for climb-in-holds.)
- **USAF airfields: 310 KIAS** max unless depicted; **Navy fields: 230 KIAS** max unless depicted.
- **COPTER** procedures: 90 KIAS minimum unless charted.
- **Climb-in-hold: 310 KIAS** permitted unless a max is published; extra obstacle protection is provided.
- 14 CFR 91.117 speed limits still apply throughout.
- **Speed-reduction rule (AIM 5-3-8 j8/para d):** with advance notice, slow to at/below max holding speed **at least 3 minutes prior to crossing the holding fix**; without advance notice, slow as expeditiously as practical.
- **Turbulence:** advise ATC immediately if you must exceed max holding speed; notify when able to slow again.
- **WHY (safety-critical):** exceeding max speed enlarges the turn radius and can push you outside protected airspace into terrain or other traffic. For a C182 this is largely academic (you'll hold well under 120 KIAS), but the exam tests it heavily.

### 11. Flying the hold — bank angle, tolerances, climb/descent, fuel, workflow
- **Bank angle (verified verbatim, AIM 5-3-8 j8):** "Make all turns during entry and while holding at: (1) 3 degrees per second; or (2) 30 degree bank angle; or (3) 25 degree bank provided a flight director system is used. NOTE- Use whichever requires the least bank angle." (Trap: many secondary sources say a flat "25° or 3°/sec" — that is the ICAO/USAF wording; the FAA AIM specifically says **30°, or 25° with a flight director, or 3°/sec, least of the three.**) The AIM also recommends selecting a **minimum 25° bank** if an RNAV/flight-guidance bank limiter is pilot-selectable, to avoid airspace excursions.
- **ACS tolerances (FAA-S-ACS-8C, Task III.B, element IR.III.B.S4, verified verbatim):** airspeed **±10 kt**, altitude **±100 ft**, selected headings within **±10°**, track a course/radial/bearing within **¾-scale deflection of the CDI.**
- **Climb/descent in the hold:** permitted; climb-in-holds have extra obstacle protection. Maintain last assigned altitude until leaving the hold on approach clearance.
- **Fuel and diversion (91.167; ACS risk elements):** recalculate reserves whenever you get an unanticipated EFC; know your **minimum fuel** advisory vs. **emergency (mayday) fuel** declaration triggers. Decide a "bingo" fuel/EFC at which you divert rather than continue holding — the Avianca lesson.
- **The 5 Ts / 6 Ts (single-pilot flow):** the traditional Peter Dogan/PIC sequence is **Turn – Time – Twist – Throttle – Talk**; American Flyers' 6 Ts add **Track** (Turn, Time, Twist, Throttle, Talk, Track). Some substitute "Tune." Run them at each fix crossing:
  - **Turn** to the entry/outbound heading; **Time** (start the clock over/abeam the fix); **Twist** the course/OBS; **Throttle** (set holding speed/power); **Talk** (report as required); **Track** (apply wind correction). Not every T applies every time. Jason Miller reframes the 5 Ts as a tool to "think in front of the airplane."

### 12. Reporting and phraseology (AIM 5-3-3 verified + 5-3-8 f)
Required reports (no ATC request needed, at all times):
- **Reaching the holding fix:** report **time and altitude/flight level** upon reaching the clearance limit/holding fix (5-3-3 a.1(f); 5-3-8 f).
- **Leaving the holding fix/clearance limit** (5-3-3 a.1(g); 5-3-8 f).

(Trap: these ARE required in radar contact; only military instrument-training aircraft in radar contact may omit them per 5-3-3.)

Example calls:
- Entering: *"NorCal Approach, Skylane 12345, GOBBS at 4,000, time 47."* (satisfies the reaching-the-fix report).
- Established: (not separately required, but common) *"345 established in the hold at GOBBS, 4,000."*
- Leaving: *"NorCal, Skylane 345 leaving GOBBS, established inbound, RNAV 30."*
- Requesting delay info: *"NorCal, 345 requesting an updated EFC and any delay information at GOBBS."*

### 13. RNAV/GPS holding and G1000 specifics (verified against Garmin G1000 pilot's guide and CFI sources)
- **Published holds / HILPT / missed-approach holds** are in the database. Load the approach; the racetrack appears on the MFD. Crossing the hold fix, the G1000 **auto-suspends waypoint sequencing (annunciates SUSP)** and flies the entry and racetrack (autopilot in NAV mode will fly it, entry included). To make additional turns, press **SUSP** again before recrossing the fix (after the first automatic circuit it un-suspends and would sequence onward). To exit and continue (e.g., the missed approach), press SUSP to resume sequencing.
- **ATC-assigned, uncharted holds** — the checkride staple: press the **OBS** softkey at/after the fix, then twist the **course knob** to set the holding radial/course (confirm CDI is in GPS mode). This "holds at the waypoint" without a database pattern. Newer G1000 NXi software adds **"Hold at Waypoint"** and **"Hold at Present Position"** flight-plan menu options (capability is software-version dependent — verify your unit; do not assume).
- **GPS vs. raw-data VOR holds:** GPS gives a magenta racetrack and can compute the entry — but AIM 5-3-8 j7 warns the box may fly a **fly-by** turn (not the fly-over the protected airspace assumes), may pick the entry off **ground track** rather than heading (causing an unexpected entry in wind), and may fly the outbound leg too far (especially into a headwind), potentially reaching protected-airspace limits. **You must be prepared to intervene**, especially on a HILPT.
- **DME/GPS distance legs:** as in §8; the box ends the outbound leg by ATD.
- **Checkride expectation (verified via DPE/CFI discussion):** expect at least one hold, often **an ATC-assigned hold NOT in the database**, so you must demonstrate manual setup and entry determination — not just reading the magenta line. A DPE red flag is answering "teardrop" merely because the moving map said so without understanding why.
- **NO ADF (your aircraft):** NDB holding is **knowledge-test-only** for you. Still know: an NDB hold uses magnetic bearings; on an RMI/ADF you'd hold using relative bearings; the FAA written and figure supplement (FAA-CT-8080-3, and the IRA test bank e.g. Quizlet figures 87/112/113) still ask NDB and intersection-hold entry questions.

### 14. Holding and lost communications (14 CFR 91.185(c)(3), verified)
Route: (c)(1) assigned/vectored→expected→filed. Altitude: (c)(2) highest of assigned/MEA/expected. **Leaving the clearance limit (c)(3):**
- **(i) If the clearance limit is a fix FROM WHICH AN APPROACH BEGINS:** commence descent/approach as close as possible to the **EFC time** if received; if no EFC, as close as possible to the **ETA** computed from the filed/amended flight plan.
- **(ii) If the clearance limit is NOT a fix from which an approach begins:** leave the clearance limit at the **EFC** (if received) or **upon arrival** (if no EFC), proceed to a fix from which an approach begins, then commence descent/approach as close as possible to the ETA.
- **Classic exam scenarios:** (a) Cleared to a VOR that is an IAF with EFC 1830 — hold, then start the approach at 1830. (b) Cleared to the destination airport (not a fix, no approach begins there) with no EFC — the (c)(3)(ii) path applies; proceed to an approach fix and begin the approach at your ETA. (Real-world nuance/flag: nearly all modern clearances are to the destination airport, which is not a "fix from which an approach begins," so (c)(3)(ii) usually governs — a point the FAA itself acknowledges is awkwardly worded.)

### 15. Knowledge test & checkride angle
**Classic written-test question patterns (IRA, FAA-CT-8080-3F figure supplement):**
- **Entry selection given a heading and hold description** (most common): e.g., "At STRUT intersection eastbound, hold west on the 10 DME fix on V306, standard turns — what entry?" Work it with the 70°/thumb method.
- **Left-turn (nonstandard) entries** with a stated radial and "left turns."
- **Timing:** inbound leg 1 min ≤14,000, 1½ >14,000; where outbound timing starts.
- **Max speed by altitude** (200/230/265) and the (175) restriction icon.
- **Required reports** (reaching/leaving the fix).
- **EFC / lost-comm** clearance-limit logic.
- **Standard vs nonstandard identification** and interpreting charted holds.
**Test-prep emphases:** Sheppard Air (rote memorization of the current figures and bank rule) and ASA/Gleim (concept + figures). You may bring a **holding-pattern entry aid/protractor** into the FAA test — verified in the testing procedures.
**Model DPE oral answers:** be ready to (1) define holding and why used; (2) list clearance elements; (3) explain holding vs non-holding side and protected airspace; (4) state max speeds and why; (5) determine an entry live on a chart; (6) explain what your G1000 will and won't do and when you'd intervene; (7) walk the 91.185 lost-comm logic; (8) recalculate fuel on an unanticipated EFC.

**Current ACS content (FAA-S-ACS-8C, Area of Operation III, Task B "Holding Procedures," verified verbatim):**
- *Objective:* "To determine the applicant exhibits satisfactory knowledge, risk management, and skills associated with holding procedures solely by reference to instruments."
- *Knowledge* **IR.III.B.K1:** elements of holding procedures, including reporting criteria, appropriate speeds, and recommended entry procedures for standard, nonstandard, published, and non-published holding patterns. (K1 is the only knowledge element.)
- *Risk Management* **R1** recalculating fuel reserves if assigned an unanticipated EFC; **R2** scenarios that could result in minimum fuel or the need to declare an emergency; **R3** scenarios that could lead to holding, including deteriorating weather at the destination; **R4** holding entry and wind correction while holding.
- *Skills:* **S1** use an entry procedure appropriate for a standard, nonstandard, published, or non-published pattern; **S2** change to holding airspeed appropriate for the altitude when 3 minutes or less from — but prior to arriving at — the fix, and set appropriate power for fuel conservation; **S3** recognize arrival at the fix and promptly initiate entry; **S3a** comply with holding pattern leg length and other restrictions, if applicable; **S4** maintain airspeed ±10 kt, altitude ±100 ft, selected headings within ±10°, and track within ¾-scale CDI deflection; **S5** use proper wind-correction procedures to maintain the pattern and arrive over the fix as close as possible to a specified time; **S6** use the MFD/graphical displays, if installed, to monitor position; **S7** comply with ATC reporting requirements and restrictions; **S8** use SRM/CRM as appropriate.

### 16. Teaching & learning methods (core deliverable) + local KHAF scenarios
**Best instructional sequence:** concept (why) → anatomy/geometry (draw it) → entry determination (thumb/CDI) → timing & wind → radio work/reports → simulator/chair-fly → aircraft. Use **whiteboard drills** (instructor calls a fix/radial/turns + your heading; you draw and name the entry in <10 sec) and **chair-fly the exact G1000 button presses** (OBS, course knob, SUSP). CFII consensus on what makes holds "click": stop memorizing entries and instead **draw the picture** and reason from the holding side.

**Verified local (NorCal / SF Bay Area) practice holds for a KHAF/KSQL-based student:**
- **OSI (Woodside) VOR/DME** — the KHAF Runway 12 ODP is a **climb-in-hold**: "climb on heading 122° to 3000, then climbing left turn direct OSI VOR/DME; continue climb in OSI holding pattern (**hold southeast, left turns, 321° inbound**) to cross OSI at or above 5100 on V25-87 before proceeding on course." A real, charted, **nonstandard (left-turn)** climb-in-hold on your home field's departure — an ideal teaching example.
- **KHAF RNAV (GPS) RWY 30** — the missed approach (chart Amdt 1A, 18JUL19) reads: "Climb to 4000 direct **LAYKI** and on track 267° to **SEEMS** and hold, continue climb-in-hold to 4000." Good G1000 published-hold practice. (Chart context: LPV DA 381-1 / 327 HAT vs LNAV MDA 620-1 / 566 HAT, with a 2,020-ft step-down at MAVKC for LNAV — your WAAS/LPV eligibility is aircraft-specific and must be verified.)
- **GOBBS** — NorCal has been observed assigning uncharted holds at GOBBS ("hold at GOBBS, stay within 5 NM, your choice of radial") during marine-layer approach stacking at KHAF — a realistic **uncharted-hold** drill exactly like the checkride.
- Verify all of the above on **current Jeppesen charts** before flying; procedures amend frequently.

**Existing trainer apps/sites worth studying or emulating for your build:**
- **PilotsCafe Holding Trainer / Holding Pattern Trainer (iOS/Android/web):** drills entry selection from a bearing-to-fix + radial; includes a holding calculator and tutorial. Strength: fast, gamified repetition — model your "entry drill" mode on it.
- **FlyGo IFR Holding Pattern Trainer / IFR Flight Trainer Simulator:** interactive learning + test module + a color-coded map "Quick Finder"; also full-motion HSI practice. (A reviewer noted left/right patterns were swapped in an early Quick Finder — a QA lesson.)
- **Holdings (iOS):** visualizes entry, wind, and timing from both the HSI view and an overview map — a good UX model for showing aircraft position.
- **Holding Pattern Computer (holdingpattern.com, Les Glatt):** goes beyond entry type to **turn-by-turn** guidance with bank/turn-rate and wind — useful as a "reference solution" oracle to validate your app's geometry engine.
- **Boldmethod** interactive articles and **The Finer Points** thumb-method video: best pedagogy models.

### 17. Safety dimension (verified themes)
- **Fuel exhaustion while holding:** Avianca 052 (§1) is the archetype. NTSB Safety Alert **SA-067, "Flying on Empty" (August 2017)** states verbatim: "From 2011 to 2015, an average of more than 50 accidents per year occurred due to fuel management issues. Fuel exhaustion accounted for 56% of fuel-related accidents while fuel starvation was responsible for 35%." NTSB adds that fuel management is "the sixth leading cause of general aviation accidents," pilot error "contributed to 95 percent," and that pilots holding commercial/ATP certificates were involved in 48% of fuel accidents (private/sport 50%, student 2%) — even experienced pilots are not immune. **Manage EFC and bingo fuel actively.**
- **Wrong-turn / wrong-side / protected-airspace excursions:** caused by exceeding max speed, shallow bank (RNAV bank limiters), over-long outbound legs in wind, or a fly-by direct entry — all flagged in AIM 5-3-8 j7. Mitigations: speed control, ≥25° bank, and staying on the holding side.
- **Spatial disorientation:** prolonged turning flight in IMC (multiple hold circuits) is a leading SD scenario; keep a disciplined instrument scan, use the autopilot when workload spikes, and cross-check the backup attitude source. (Your G1000 has a backup attitude/airspeed/altitude source — know it; partial-panel holding is an ACS-adjacent skill.)
- **Entry perfection vs. protected side:** every CFII source agrees — a "wrong" but reasonably flown entry still keeps a slow airplane inside protected airspace; wandering onto the non-holding side or overspeeding does not. **Prioritize the protected side over entry aesthetics.**

## Recommendations
**Stage 1 — Ground / self-teach (now):** read AIM 5-3-8 in full and 5-3-3 a.1(f)/(g); make Anki cards from the ROTE and TRAP call-outs below. Draw 20 holds on paper (mix standard/nonstandard, toward/away NAVAID) and name the entry. **Benchmark to advance:** name the correct entry in <10 seconds on 18/20.
**Stage 2 — Entry fluency:** adopt the **CDI-twist + right/left thumb** method; drill with PilotsCafe/FlyGo apps daily. **Benchmark:** 95% correct entries under a 15-second timer, including nonstandard.
**Stage 3 — Sim / chair-fly the G1000:** practice (a) loading a published hold/HILPT and using SUSP; (b) setting an OBS hold at an uncharted fix (e.g., GOBBS). **Benchmark:** set up an uncharted hold and correct entry in one pass without prompting.
**Stage 4 — Aircraft:** fly the OSI climb-in-hold and the KHAF RNAV 30 missed-approach hold at SEEMS; then have your CFII assign uncharted holds. **Benchmark = ACS:** ±10 kt, ±100 ft, ±10° heading, ¾-scale CDI, correct entry, 1-minute inbound legs with wind correction.
**Stage 5 — Checkride polish:** rehearse the oral answers in §15 and the 91.185 logic; pre-brief that you'll state your entry aloud and fly what you state.
**Fuel/ADM threshold that changes the plan:** predetermine a divert fuel/EFC; if an unanticipated EFC pushes you below planned reserves, declare minimum fuel and divert rather than accept further holding.

### Anki-ready call-outs
- **ROTE (memorize verbatim):** speeds 200/230/265; inbound leg 1 min ≤14,000 / 1½ min >14,000 MSL; sectors 180° direct / 70° teardrop / 110° parallel; 70° line on holding side; teardrop offset 30°; triple drift outbound; bank = least of 3°/sec, 30°, or 25° with a flight director; ±5° entry tolerance; slow to holding speed 3 min prior; ATC advance clearance ~5 min; ACS ±10 kt / ±100 ft / ±10° / ¾-scale CDI; reports reaching & leaving the fix.
- **TRAPS:** turn direction stated ONLY for left turns (silence = right/standard); 1½ min is ABOVE 14,000 (not at); reaching/leaving-fix reports ARE required in radar contact; outbound timing starts over/abeam whichever is LATER; adjust the OUTBOUND leg to fix the INBOUND time; FAA bank wording is 30°/25°-with-FD/3°-per-sec (not ICAO's 25°); GPS picks entry off ground track and may fly-by; "hold as published" needs only direction + "as published."
- **SAFETY-CRITICAL:** stay on the holding/protected side over perfect entries; cross the fix at/below max speed; manage EFC/fuel (Avianca 052, SA-067); use ≥25° bank with an RNAV limiter; intervene if the box flies the outbound leg long; watch spatial disorientation over multiple circuits.

## Caveats
- **Entry sector sign conventions** (e.g., teardrop = outbound − 30° for a standard pattern) are stated by multiple reputable sources but should be validated by drawing before coding a trainer; §5 flags the one spot where the sign is easy to invert. The AIM gives the geometry in prose, not formulas, so any formula is a derived interpretation.
- **Double vs. triple drift** is a genuine source conflict: FAA (AIM/IFH) says triple; much of the CFI community says double is enough in slow trainers and triple can overcorrect in strong wind. Flagged in §9. FAA reference answer = triple.
- **±5° vs. ~10° boundary buffer:** AIM says ±5°; the wider "buffer zone" is a common teaching simplification. Use ±5° for the written test.
- **G1000 hold features (Hold at Waypoint / Present Position, auto-entry)** are **software-version dependent** — this report does not assume your specific unit's capability; verify on your airplane's actual software.
- **WAAS/LPV status** of your specific C182 is aircraft-specific and was not assumed; the KHAF RNAV 30 LPV vs LNAV minima are given only as chart context.
- **Local procedures amend frequently** — verify OSI, SEEMS/LAYKI, and GOBBS holds on current Jeppesen charts before use.
- The ACS publication-date discrepancy (Nov 2023 cover vs. April 2024 / effective May 31, 2024 web listing) is noted; Task B content is identical across sources and current as of July 2026.