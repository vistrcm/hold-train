// Concise lesson pages in instructional order:
//   why holds exist → pattern anatomy → entries/thumb method → timing & wind
//   → reports, EFC, lost comm.
//
// Correctness rules:
// - Every factual paragraph carries its FAA primary source, rendered in the
//   UI. Wording follows the AIM 5-3-8 / AIM 5-3-3 / JO 7110.65BB /
//   91.185(c)(3) text verified against faa.gov in Tasks 3, 4, 8, 9, and 11.
// - No entry answers live here — sector facts only; the engine
//   (determineEntry) remains the sole oracle for entries.
// - The thumb method is a field technique, not FAA doctrine; its paragraph
//   says so and cites the AIM only for the sector geometry it visualizes.

export interface LessonParagraph {
  text: string
  /** FAA primary-source citation, rendered next to the paragraph. */
  source: string
}

export interface Lesson {
  id: string
  title: string
  /** Route path (registered in main.ts) of the drill practicing this lesson. */
  drillPath: string
  drillLabel: string
  paragraphs: readonly LessonParagraph[]
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'why-hold',
    title: 'Why holding exists',
    drillPath: 'written-test',
    drillLabel: 'Practice with written-test questions',
    paragraphs: [
      {
        text: 'A holding pattern is a racetrack maneuver that keeps the aircraft within specified protected airspace while awaiting further clearance. ATC assigns holds for traffic sequencing and delays, and holding is what you do on reaching a clearance limit without further clearance.',
        source: 'AIM 5-3-8 (holding); P/CG "Holding Procedure"',
      },
      {
        text: 'Procedures also build holds in: a hold-in-lieu of procedure turn (HILPT) is a charted course reversal, and missed approaches end at a charted hold. On the instrument checkride the missed-approach hold is the one you will almost certainly fly.',
        source: 'AIM 5-3-8 (holding); FAA-S-ACS-8C Task III.B',
      },
      {
        text: 'Holding is also a fuel event: every circuit burns reserves, and the moment a hold or an unanticipated EFC appears you recalculate whether you can still land with the 14 CFR 91.167 IFR reserves intact — or divert instead.',
        source: '14 CFR 91.167; FAA-S-ACS-8C IR.III.B.R1',
      },
    ],
  },
  {
    id: 'anatomy',
    title: 'Anatomy of the pattern',
    drillPath: 'clearance-copy',
    drillLabel: 'Drill copying holding clearances',
    paragraphs: [
      {
        text: 'The pattern hangs on the holding fix: the inbound leg flies the holding course to the fix, the turns and outbound leg stay on the holding side. Standard holding uses right turns; nonstandard uses left. Turn direction is stated if left turns are to be made, the pilot requests it, or the controller considers it necessary — a clearance with no stated direction means right turns. Assuming left from silence is the classic trap.',
        source: 'AIM 5-3-8 i5, j1; FAA JO 7110.65BB 4-6-4',
      },
      {
        text: 'Leg length: the inbound leg is 1 minute at or below 14,000 ft MSL and 1½ minutes above 14,000. DME/RNAV holds use distance legs instead — the outbound leg ends when the limit distance is reached.',
        source: 'AIM 5-3-8 j4 (inbound leg timing); j5 (DME/GPS ATD holding)',
      },
      {
        text: 'Maximum holding speeds — the protected airspace is sized for them: 200 KIAS at or below 6,000 ft MSL, 230 KIAS from 6,001 through 14,000 ft, 265 KIAS above 14,000 ft. Charted holds may restrict further with an icon like (175). Start slowing when 3 minutes or less from the fix so you cross it at or below holding speed.',
        source: 'AIM 5-3-8 j2 (maximum holding airspeeds); d (speed reduction)',
      },
      {
        text: 'A holding clearance comes in a fixed element order: direction of holding from the fix (one of the eight cardinal compass points); the fix; the radial, course, bearing, airway, or route to hold on; leg length in miles if DME or RNAV is used; direction of turn if left turns are to be made (also stated on pilot request or when the controller considers it necessary); and the EFC time. For a charted hold ATC may abbreviate to direction and "as published".',
        source: 'FAA JO 7110.65BB 4-6-4, 4-6-1; AIM 5-3-8 i',
      },
    ],
  },
  {
    id: 'entries',
    title: 'Entries and the thumb method',
    drillPath: 'entry-drill',
    drillLabel: 'Drill entry determination',
    paragraphs: [
      {
        text: 'Entry sectors are set by a line 70° to the inbound course through the fix. Direct (≈180° sector): cross the fix and turn to the outbound heading. Teardrop (≈70° sector): at the fix turn to a heading 30° off the outbound course toward the holding side, fly about 1 minute, then turn to intercept inbound. Parallel (≈110° sector): parallel the course outbound on the non-holding side for about 1 minute, then turn in the direction of the holding pattern through more than 180° and return to the fix or intercept the inbound course. The parallel reintercept catches people out: "in the direction of the holding pattern" means toward the racetrack, not the way the pattern turns. The rejoin is rotationally opposite the pattern (left in a standard right-turn hold) and crosses back over the holding course onto the holding side. FIG 5-3-4 shows it: the same figure draws the teardrop rejoin clockwise and the parallel rejoin counter-clockwise. That makes parallel the one entry whose first two turns — off the course outbound, then the rejoin — both oppose the pattern; only the turn on reaching the fix again follows it.',
        source: 'AIM 5-3-8 j3 (entry procedures), FIG 5-3-4',
      },
      {
        text: 'The AIM treats ±5° in heading as within good operating limits for determining entry, so within 5° of a sector boundary either adjacent entry is acceptable — this tolerance is why test answers are sometimes keyed "parallel or teardrop". Nonstandard (left-turn) patterns mirror everything: same sectors, reflected across the holding course.',
        source: 'AIM 5-3-8 j8(d) (±5° heading tolerance), j3 (nonstandard mirroring)',
      },
      {
        text: 'The thumb method visualizes the sectors on the heading indicator. With heading up, set the course pointer to the inbound holding course and lay a thumb on the rose just ahead of the 3 o\'clock point for a standard hold (9 o\'clock for nonstandard), covering the 20° between there and the nose side — the thumb\'s leading (nose-side) edge marks the 70° line. Read where the head of the course pointer sits: in the 180° arc from that line up over the nose, enter direct; behind the line on the thumb side, back to the tail, parallel; in the remaining 70° wedge behind the tail on the far side, teardrop. This is a field technique, not FAA doctrine — the sectors it shows are the AIM\'s.',
        source: 'Technique (not an FAA procedure); sector geometry per AIM 5-3-8 j3',
      },
    ],
  },
  {
    id: 'timing-wind',
    title: 'Timing and wind correction',
    drillPath: 'wind-lab',
    drillLabel: 'Fly the wind & timing lab',
    paragraphs: [
      {
        text: 'Start timing the outbound leg over or abeam the fix, whichever occurs later; if the abeam position cannot be determined, start when the turn to outbound is completed. Then adjust the outbound time on later circuits so the inbound leg comes out at 1 minute (1½ above 14,000 ft).',
        source: 'AIM 5-3-8 j4 (outbound timing and adjustment)',
      },
      {
        text: 'Wind correction: establish the crab that holds the inbound course, then apply roughly triple that inbound drift correction on the outbound leg — the constant-rate turns accumulate drift that the outbound leg must pre-correct. Example: 8° of inbound correction → about 24° outbound, applied opposite. Many CFIs teach double drift in the field; both converge — the AIM (and the written test) answer is triple.',
        source: 'AIM 5-3-8 j8(c) (triple the inbound drift correction outbound)',
      },
      {
        text: 'DME/ATD legs end on distance, not time. Read the AIM figures by the inbound course: inbound toward the NAVAID with the fix at 10 DME and 5 NM legs, the outbound leg runs away from the station and ends at 15 DME; inbound away from the NAVAID with the fix at 28 DME and 8 NM legs, the outbound leg runs back toward the station and ends at 20 DME.',
        source: 'AIM 5-3-8 j5 (DME/ATD holding, worked examples)',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Reports, EFC, and lost comm',
    drillPath: 'written-test',
    drillLabel: 'Practice with written-test questions',
    paragraphs: [
      {
        text: 'Two holding reports are required at all times, radar or not: report the time and altitude reaching a holding fix or the point to which cleared, and report when leaving any assigned holding fix or point.',
        source: 'AIM 5-3-3 a1(f), (g)',
      },
      {
        text: 'The EFC (expect further clearance time) is when you can expect onward clearance. It is your lost-communications departure time from the clearance limit, and an unanticipated EFC is a fuel decision point — recalculate reserves when you get one.',
        source: 'AIM 5-3-8 i; P/CG "Expect Further Clearance (Time)"; 14 CFR 91.167',
      },
      {
        text: 'Lost comm at the clearance limit under 91.185(c)(3): if the limit is a fix from which an approach begins, commence descent or descent and approach as close as possible to the EFC if you received one, otherwise as close as possible to your flight-plan ETA. If it is not such a fix, leave the limit at the EFC — or, with no EFC, upon arriving over it — then proceed to a fix from which an approach begins and start descent and approach as close as possible to the ETA.',
        source: '14 CFR 91.185(c)(3)',
      },
    ],
  },
]
