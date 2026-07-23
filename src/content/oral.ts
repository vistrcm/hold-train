// Oral-exam prep content for ACS Task III.B (Holding Procedures).
//
// Correctness rules:
// - Every item cites its FAA primary source; AIM 5-3-8 / JO 7110.65BB /
//   91.185 wording follows the text verified against faa.gov in Tasks 3, 4,
//   and 8. The ACS element list (incl. S3a) matches FAA-S-ACS-8C's own
//   change list; AIM 5-5-15 (minimum fuel advisory) verified against the
//   faa.gov chapter listing.
// - Content whose applicability depends on technique choice or avionics
//   software carries a `caveat`, rendered next to the answer (triple-vs-double
//   drift, G1000 software-version features, ±5° entry tolerance).
// - Garmin-sourced items describe G1000 behavior from the Garmin pilot's
//   guide, not an FAA source, and are flagged software-version dependent.

export const ACS_SOURCE =
  'FAA-S-ACS-8C, Area of Operation III, Task B (Holding Procedures)'

export type AcsKind = 'knowledge' | 'risk' | 'skill'

export interface AcsElement {
  code: string
  kind: AcsKind
  /** Condensed element text for the browse view. */
  text: string
}

/** All Task III.B elements; the oral bank must cover every one. */
export const ACS_ELEMENTS: readonly AcsElement[] = [
  {
    code: 'IR.III.B.K1',
    kind: 'knowledge',
    text: 'Elements of holding procedures: reporting criteria, appropriate speeds, and recommended entries for standard, nonstandard, published, and non-published patterns.',
  },
  {
    code: 'IR.III.B.R1',
    kind: 'risk',
    text: 'Recalculating fuel reserves if assigned an unanticipated expect further clearance (EFC) time.',
  },
  {
    code: 'IR.III.B.R2',
    kind: 'risk',
    text: 'Scenarios that could result in minimum fuel or the need to declare an emergency.',
  },
  {
    code: 'IR.III.B.R3',
    kind: 'risk',
    text: 'Scenarios that could lead to holding, including deteriorating weather at the destination.',
  },
  {
    code: 'IR.III.B.R4',
    kind: 'risk',
    text: 'Holding entry and wind correction while holding.',
  },
  {
    code: 'IR.III.B.S1',
    kind: 'skill',
    text: 'Use an entry procedure appropriate for a standard, nonstandard, published, or non-published holding pattern.',
  },
  {
    code: 'IR.III.B.S2',
    kind: 'skill',
    text: 'Change to holding airspeed appropriate for the altitude when 3 minutes or less from the fix, and set power for fuel conservation.',
  },
  {
    code: 'IR.III.B.S3',
    kind: 'skill',
    text: 'Recognize arrival at the holding fix and promptly initiate entry into the pattern.',
  },
  {
    code: 'IR.III.B.S3a',
    kind: 'skill',
    text: 'Comply with holding pattern leg length and other restrictions, if applicable.',
  },
  {
    code: 'IR.III.B.S4',
    kind: 'skill',
    text: 'Maintain airspeed ±10 knots, altitude ±100 feet, selected headings ±10°, and track within ¾-scale CDI deflection.',
  },
  {
    code: 'IR.III.B.S5',
    kind: 'skill',
    text: 'Use proper wind correction to maintain the pattern and arrive over the fix as close as possible to a specified time.',
  },
  {
    code: 'IR.III.B.S6',
    kind: 'skill',
    text: 'Use the MFD or other graphical navigation displays, if installed, to monitor position in the pattern.',
  },
  {
    code: 'IR.III.B.S7',
    kind: 'skill',
    text: 'Comply with ATC reporting requirements and restrictions.',
  },
  {
    code: 'IR.III.B.S8',
    kind: 'skill',
    text: 'Use single-pilot resource management (SRM) or crew resource management (CRM), as appropriate.',
  },
]

export interface OralItem {
  id: string
  question: string
  /** Model answer to self-grade against. */
  answer: string
  /** ACS element codes this item covers (all from ACS_ELEMENTS). */
  acs: readonly string[]
  source: string
  /** Rendered next to the answer when applicability depends on technique or equipment. */
  caveat?: string
}

export const ORAL_ITEMS: readonly OralItem[] = [
  {
    id: 'what-and-why',
    question: 'What is a holding pattern, and why would ATC assign one?',
    answer:
      'A racetrack maneuver that keeps the aircraft within specified protected airspace while awaiting further clearance. ATC assigns holds for traffic sequencing and delays, when you reach a clearance limit without further clearance, and procedures use them as course reversals (hold-in-lieu of procedure turn), missed-approach holds, and climb-in-hold.',
    acs: ['IR.III.B.K1'],
    source: 'AIM 5-3-8 (holding)',
  },
  {
    id: 'clearance-elements',
    question: 'What are the elements of a holding clearance, in order?',
    answer:
      'Direction of holding from the fix (one of the eight cardinal compass points); the holding fix; the radial, course, bearing, airway, or route on which to hold; leg length in miles if DME or RNAV is used; direction of turn if left turns are to be made (also stated on pilot request or when the controller considers it necessary); and the EFC time plus any pertinent additional delay information. For a charted hold, ATC may abbreviate to direction and "as published" — you fly the charted pattern.',
    acs: ['IR.III.B.K1'],
    source: 'FAA JO 7110.65BB 4-6-4 (holding instructions), 4-6-1 (as published, EFC); AIM 5-3-8 i',
  },
  {
    id: 'standard-vs-nonstandard',
    question:
      'Standard versus nonstandard holding pattern — and what if the controller states no turn direction?',
    answer:
      'Standard holding uses right turns; nonstandard uses left turns. Turn direction is stated if left turns are to be made, the pilot requests it, or the controller considers it necessary — so a clearance with no turn direction means a standard pattern: make right turns. Assuming left turns from an omitted direction is the classic trap.',
    acs: ['IR.III.B.K1'],
    source: 'FAA JO 7110.65BB 4-6-4; AIM 5-3-8 i5, j1',
  },
  {
    id: 'max-speeds',
    question: 'What are the maximum holding speeds, and why do they exist?',
    answer:
      'At or below 6,000 ft MSL: 200 KIAS. From 6,001 through 14,000 ft: 230 KIAS. Above 14,000 ft: 265 KIAS. The protected airspace around a holding pattern is sized for these speeds — exceeding them risks flying out of protected (obstacle- and traffic-protected) airspace. Charted holds may restrict speed further with a number in a parenthetical icon, e.g. (175); if you cannot comply, notify ATC.',
    acs: ['IR.III.B.K1'],
    source: 'AIM 5-3-8 j2 (maximum holding airspeeds table; icon restrictions)',
  },
  {
    id: 'slow-to-holding-speed',
    question: 'When do you slow to holding speed, and what else changes at that point?',
    answer:
      'Start the speed reduction when 3 minutes or less from the holding fix, so you cross the fix at or below maximum holding speed. In the 172 that means slowing toward ~90 KIAS and setting power for fuel conservation — endurance, not speed, is what matters in a hold.',
    acs: ['IR.III.B.S2'],
    source: 'AIM 5-3-8 d (speed reduction approaching a clearance limit); FAA-S-ACS-8C IR.III.B.S2',
  },
  {
    id: 'entries',
    question: 'Describe the three recommended entry procedures and their sectors.',
    answer:
      'Sectors are set by a line 70° to the inbound course through the fix. Direct (≈180° sector): cross the fix and turn to the outbound heading. Teardrop (≈70° sector): at the fix turn to a heading 30° off the outbound course toward the holding side, fly about 1 minute, then turn toward the inbound course. Parallel (≈110° sector): parallel the course outbound on the non-holding side for about 1 minute, then turn in the direction of the holding pattern through more than 180° and return to the fix or intercept the inbound course. Note the parallel reintercept turns the same way the pattern does — a right-turn hold reintercepts right — because only that direction is the "more than 180°" turn the AIM specifies. The entries are FAA-recommended, derived from the design of the obstacle-protection areas.',
    acs: ['IR.III.B.K1', 'IR.III.B.S1'],
    source: 'AIM 5-3-8 j3 (entry procedures), FIG 5-3-4, j8(d) (±5° heading tolerance)',
    caveat:
      'AIM 5-3-8 j8(d) treats ±5° in heading as within good operating limits for determining entry — within 5° of a sector boundary, either adjacent entry is acceptable; test answers keyed "parallel or teardrop" come from this tolerance.',
  },
  {
    id: 'fix-arrival',
    question: 'How do you recognize arrival at the holding fix, and what do you do there?',
    answer:
      'Fix passage shows as the VOR TO/FROM indication reversing, reaching the DME distance, or the GPS sequencing/alerting the waypoint. At the fix, promptly initiate the entry turn — a common flow is the five Ts: Turn, Time, Twist (set the inbound course), Throttle, Talk (report), then Track wind correction.',
    acs: ['IR.III.B.S3'],
    source: 'FAA-S-ACS-8C IR.III.B.S3; AIM 5-3-8',
  },
  {
    id: 'leg-lengths',
    question: 'What are the holding leg lengths, and what restrictions can apply?',
    answer:
      'The inbound leg is 1 minute at or below 14,000 ft MSL and 1½ minutes above 14,000. DME/RNAV holds use distance legs instead: the outbound leg ends when the limit distance is reached. Published holds may chart specific leg lengths or speed restrictions — comply with them.',
    acs: ['IR.III.B.K1', 'IR.III.B.S3a'],
    source: 'AIM 5-3-8 j4 (inbound leg timing); j5 (DME/GPS ATD holding)',
  },
  {
    id: 'outbound-timing',
    question: 'When does outbound timing start, and how do you adjust it?',
    answer:
      'Start timing outbound over or abeam the fix, whichever occurs later; if the abeam position cannot be determined, start when the turn to outbound is completed. Then adjust the outbound time on later circuits so the inbound leg comes out at 1 minute (1½ above 14,000 ft).',
    acs: ['IR.III.B.K1', 'IR.III.B.S5'],
    source: 'AIM 5-3-8 j4 (outbound timing)',
  },
  {
    id: 'wind-correction',
    question: 'How do you correct for wind in a holding pattern?',
    answer:
      'Compensate for drift on the straight legs: establish the crab that holds the inbound course, then apply roughly triple that inbound drift correction on the outbound leg — the turns are flown at a constant rate, so the outbound leg must pre-correct for the drift accumulated through both turns.',
    acs: ['IR.III.B.R4', 'IR.III.B.S5'],
    source: 'AIM 5-3-8 j8(c) (wind compensation: triple the inbound drift correction outbound)',
    caveat:
      'Triple drift is the AIM reference technique (and the written-test answer); many CFIs teach double drift in the field. Both converge — fly what your CFII briefs, answer the AIM on the test.',
  },
  {
    id: 'acs-tolerances',
    question: 'What tolerances does the ACS require while holding?',
    answer:
      'Airspeed ±10 knots, altitude ±100 feet, selected headings within ±10°, and track the course, radial, or bearing within ¾-scale CDI deflection.',
    acs: ['IR.III.B.S4'],
    source: 'FAA-S-ACS-8C, Task III.B, element IR.III.B.S4',
  },
  {
    id: 'required-reports',
    question: 'What holding-related reports are required to ATC?',
    answer:
      'Report the time and altitude reaching a holding fix or the point to which cleared, and report when leaving any assigned holding fix or point. These are required at all times, radar or not.',
    acs: ['IR.III.B.K1', 'IR.III.B.S7'],
    source: 'AIM 5-3-3 a1(f), (g)',
  },
  {
    id: 'efc',
    question: 'What is an EFC time, and why does it matter?',
    answer:
      'The expect further clearance time is when you can expect onward clearance from the holding fix. It matters twice: it is your lost-communications departure time from the clearance limit under 91.185(c)(3), and an unanticipated EFC is a fuel event — recalculate reserves the moment you get one.',
    acs: ['IR.III.B.K1', 'IR.III.B.R1'],
    source: 'P/CG "Expect Further Clearance (Time)"; 14 CFR 91.185(c)(3); AIM 5-3-8 i',
  },
  {
    id: 'lost-comm',
    question:
      'You lose two-way communications while holding at your clearance limit. What do you do?',
    answer:
      'Under 91.185(c)(3): if the clearance limit is a fix from which an approach begins, commence descent or descent and approach as close as possible to the EFC time if you received one, otherwise as close as possible to your flight-plan ETA. If it is not a fix from which an approach begins, leave the clearance limit at the EFC time — or, with no EFC, upon arriving over it — then proceed to a fix from which an approach begins and start descent and approach as close as possible to the ETA.',
    acs: ['IR.III.B.K1'],
    source: '14 CFR 91.185(c)(3)',
  },
  {
    id: 'fuel-adm',
    question:
      'While holding you realize delays are stretching. Explain minimum fuel versus emergency fuel, and the lesson of Avianca 052.',
    answer:
      '"Minimum fuel" is an advisory that, on reaching the destination, you cannot accept undue delay — it is not an emergency and gives no priority. If you need priority, declare a fuel emergency explicitly (MAYDAY). Plan with the 91.167 IFR reserves (destination, alternate when required, plus 45 minutes) and set a bingo fuel/EFC at which you divert instead of continuing to hold. Avianca 052 (1990) held about 77 minutes across three holds, never unambiguously declared an emergency, and crashed from fuel exhaustion — 73 of 158 aboard died.',
    acs: ['IR.III.B.R1', 'IR.III.B.R2'],
    source: 'AIM 5-5-15 (minimum fuel advisory); 14 CFR 91.167; NTSB AAR-91/04 (Avianca 052)',
  },
  {
    id: 'anticipate-holding',
    question: 'What situations should make you plan for holding before you ever take off?',
    answer:
      'Deteriorating or marginal weather at the destination, traffic saturation (approach stacking, single-runway flow), and expected flow delays. If holding is plausible, it is a fuel-planning input: carry more than the bare 91.167 reserves and brief where you would hold and where you would divert.',
    acs: ['IR.III.B.R3'],
    source: 'FAA-S-ACS-8C IR.III.B.R3; 14 CFR 91.167',
  },
  {
    id: 'protected-side',
    question: 'Holding side versus non-holding side — where is the protected airspace?',
    answer:
      'The racetrack is flown on the holding side of the holding course. Protected airspace was designed around the pattern and its recommended entries at the maximum holding speeds, so fly the recommended entries, keep maneuvering tight to the pattern, and favor the holding side. The parallel entry is the only maneuvering on the non-holding side, and it stays inside the designed protection only when flown as recommended.',
    acs: ['IR.III.B.K1', 'IR.III.B.R4'],
    source: 'AIM 5-3-8 j3 (entries derived from the obstacle-protection area design)',
  },
  {
    id: 'g1000-published-hold',
    question: 'What does the G1000 do when you fly a published hold (missed-approach hold or HILPT)?',
    answer:
      'Database holds draw the racetrack on the map. Crossing the hold fix, the unit suspends automatic waypoint sequencing — the SUSP annunciation appears — and provides guidance for the entry and the racetrack, which the autopilot flies in NAV mode. For a hold-in-lieu it un-suspends after the course reversal and sequences onward; to keep holding, press SUSP again before recrossing the fix. In a missed-approach hold, press SUSP to resume sequencing when cleared onward.',
    acs: ['IR.III.B.S6'],
    source: "Garmin G1000 Pilot's Guide (hold sequencing and SUSP)",
    caveat:
      'Software-version dependent — early non-WAAS units guide only the inbound course and prompt the entry as text; verify the behavior on the actual aircraft before relying on it. Not an FAA source.',
  },
  {
    id: 'g1000-obs-hold',
    question:
      'ATC assigns a hold at a fix with no database hold. How do you set it up on the G1000?',
    answer:
      'Press the OBS softkey at or approaching the fix — the unit stops sequencing and holds guidance at that waypoint — then twist the course knob to the inbound holding course with the CDI in GPS mode. You fly the entry and the racetrack yourself off that course. Newer NXi software adds "Hold at Waypoint" and "Hold at Present Position" flight-plan options that build the pattern for you.',
    acs: ['IR.III.B.S6'],
    source: "Garmin G1000 Pilot's Guide (OBS mode; NXi hold options)",
    caveat:
      'Hold-at-Waypoint / Hold-at-Present-Position are software-version dependent — confirm what the installed unit actually has; do not assume NXi features.',
  },
  {
    id: 'automation-intervene',
    question: 'When would you intervene rather than let the automation fly the hold?',
    answer:
      'Monitor the MFD against the clearance every circuit. Intervene when the picture and the clearance disagree: pattern on the wrong side or wrong turn direction, outbound leg stretching beyond the leg length or protected airspace in strong wind, a charted restriction about to be busted, or the unit sequencing onward when ATC has not cleared you. The clearance outranks the box — be ready to fly the hold by hand off the CDI.',
    acs: ['IR.III.B.S6', 'IR.III.B.R4', 'IR.III.B.S8'],
    source: 'FAA-S-ACS-8C IR.III.B.S6, S8; AIM 5-3-8',
  },
  {
    id: 'srm-in-hold',
    question: 'How do you manage workload and risk during multiple circuits in IMC?',
    answer:
      'Use SRM deliberately: let the autopilot fly circuits while you manage fuel, the EFC, weather, and the next clearance; keep a disciplined instrument scan — prolonged turning in IMC is a classic spatial-disorientation setup; re-brief your divert decision each time the EFC changes; and use the five Ts at every fix crossing so nothing is dropped.',
    acs: ['IR.III.B.S8'],
    source: 'FAA-S-ACS-8C IR.III.B.S8; AIM 5-3-8',
  },
]
