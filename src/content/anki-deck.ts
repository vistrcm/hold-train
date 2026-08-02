// Fixed Anki core deck, authored from the ROTE/TRAP/SAFETY call-outs in
// docs/research-claude.md §Anki. Every card's fact was verified against the
// cited FAA primary source: AIM 5-3-8 / 5-3-3 / 8-1-5 text fetched from
// faa.gov (Tasks 3, 8–10), JO 7110.65BB 4-6-1/4-6-4 (Task 4), and
// FAA-S-ACS-8C Task III.B (Task 9). Citations render on the card backs.
//
// Tags: one group tag (rote | trap | safety) + ≥1 ACS Task III.B element
// code. Tags must never contain whitespace — Anki splits tags on spaces.

export interface AnkiCard {
  front: string
  back: string
  /** FAA primary source citation, appended to the back on export. */
  source: string
  tags: string[]
}

export const CORE_DECK: readonly AnkiCard[] = [
  // ── ROTE: memorize verbatim ────────────────────────────────────────────
  {
    front: 'Maximum holding airspeeds by altitude band?',
    back: 'MHA–6,000 ft: 200 KIAS. 6,001–14,000 ft: 230 KIAS. Above 14,000 ft: 265 KIAS. A charted icon may restrict further, e.g. (175).',
    source: 'AIM 5-3-8 j2 (maximum holding airspeeds table; icon restrictions)',
    tags: ['rote', 'speeds', 'IR.III.B.K1'],
  },
  {
    front: 'Inbound leg timing at and below 14,000 ft MSL — and above?',
    back: '1 minute at or below 14,000 ft MSL; 1½ minutes above 14,000 ft MSL.',
    source: 'AIM 5-3-8 j4 (inbound leg timing)',
    tags: ['rote', 'timing', 'IR.III.B.K1'],
  },
  {
    front: 'Entry sector sizes for direct, teardrop, and parallel?',
    back: 'Direct ≈180°, teardrop ≈70°, parallel ≈110°. The 70° line lies on the holding side of the pattern.',
    source: 'AIM 5-3-8 j3, FIG 5-3-4',
    tags: ['rote', 'entry', 'IR.III.B.K1', 'IR.III.B.S1'],
  },
  {
    front: 'Teardrop entry: what heading after crossing the fix?',
    back: 'Fly outbound on a heading offset 30° from the outbound course, on the holding side, then turn to intercept the inbound course.',
    source: 'AIM 5-3-8 j3 (entry procedures)',
    tags: ['rote', 'entry', 'IR.III.B.S1'],
  },
  {
    front: 'Parallel entry: which side of the course do you reintercept from?',
    back: 'Parallel the holding course outbound on the non-holding side for one minute, then turn IN THE DIRECTION OF THE HOLDING PATTERN through more than 180°, and return to the fix or intercept the inbound course. The reintercept turn is rotationally opposite the pattern (left in a standard right-turn hold) and crosses back over the holding course onto the holding side — "in the direction of the holding pattern" means toward the racetrack, not the way it turns.',
    source: 'AIM 5-3-8 j3 (entry procedures)',
    tags: ['rote', 'entry', 'IR.III.B.S1'],
  },
  {
    front: 'Wind correction outbound relative to the inbound crab?',
    back: 'Triple the inbound drift correction outbound (8° inbound crab → 24° opposite outbound). FAA reference answer is triple; many CFIs teach double drift in slow trainers as a field technique.',
    source: 'AIM 5-3-8 j8(c) (wind compensation: triple the inbound drift correction outbound)',
    tags: ['rote', 'wind', 'IR.III.B.R4', 'IR.III.B.S5'],
  },
  {
    front: 'Bank angle rules for non-RNAV holding turns?',
    back: '3° per second, or 30° bank, or 25° bank with a flight director — whichever requires the least bank angle.',
    source: 'AIM 5-3-8 j8(b) (bank angle)',
    tags: ['rote', 'pattern', 'IR.III.B.K1'],
  },
  {
    front: 'How exact must your heading be at an entry-sector boundary?',
    back: 'The AIM treats ±5° in heading as within good operating limits for determining entry — within 5° of a boundary, either adjacent entry is acceptable.',
    source: 'AIM 5-3-8 j8(d) (±5° heading tolerance)',
    tags: ['rote', 'entry', 'IR.III.B.S1'],
  },
  {
    front: 'When do you slow to holding speed?',
    back: 'Start the speed reduction when 3 minutes or less from the holding fix, so you cross the fix initially at or below the maximum holding airspeed.',
    source: 'AIM 5-3-8 d (speed reduction approaching a clearance limit)',
    tags: ['rote', 'speeds', 'IR.III.B.S2'],
  },
  {
    front: 'How far in advance does ATC issue holding instructions or a clearance beyond the fix?',
    back: 'At least 5 minutes before the aircraft reaches the clearance limit — holding instructions when delay is expected; "whenever possible" for a clearance beyond the fix when none is. Nothing received approaching the limit? Ask.',
    source: 'AIM 5-3-8 e (clearance beyond the fix); FAA JO 7110.65BB 4-6-1 b (holding instructions)',
    tags: ['rote', 'reports', 'IR.III.B.K1'],
  },
  {
    front: 'ACS holding tolerances (checkride standard)?',
    back: 'Airspeed ±10 knots, altitude ±100 feet, selected headings ±10°, track within ¾-scale CDI deflection.',
    source: 'FAA-S-ACS-8C, Task III.B, element IR.III.B.S4',
    tags: ['rote', 'pattern', 'IR.III.B.S4'],
  },
  {
    front: 'Which holding reports are required to ATC?',
    back: 'Report the time and altitude/flight level reaching the holding fix or clearance limit, and report leaving it.',
    source: 'AIM 5-3-3 a1(f), (g)',
    tags: ['rote', 'reports', 'IR.III.B.S7'],
  },
  // ── TRAPS: where the test and real world bite ──────────────────────────
  {
    front: 'Clearance omits the turn direction — which way do you turn?',
    back: 'Right turns (standard pattern). Direction is stated if left turns are to be made, the pilot requests it, or the controller considers it necessary — silence means standard.',
    source: 'FAA JO 7110.65BB 4-6-4; AIM 5-3-8 i5, j1',
    tags: ['trap', 'pattern', 'IR.III.B.K1'],
  },
  {
    front: 'Holding at exactly 14,000 ft MSL — inbound leg 1 or 1½ minutes?',
    back: '1 minute. The 1½-minute leg applies ABOVE 14,000 ft MSL, not at it.',
    source: 'AIM 5-3-8 j4 (inbound leg timing)',
    tags: ['trap', 'timing', 'IR.III.B.K1'],
  },
  {
    front: 'In radar contact — do you still report reaching and leaving the holding fix?',
    back: 'Yes. Reaching/leaving the clearance limit reports are required regardless of radar contact.',
    source: 'AIM 5-3-3 a1(f), (g)',
    tags: ['trap', 'reports', 'IR.III.B.S7'],
  },
  {
    front: 'When does outbound timing start?',
    back: 'Over or abeam the fix, whichever occurs LATER. If the abeam position cannot be determined, start timing when the turn to outbound is completed.',
    source: 'AIM 5-3-8 j4(b) (outbound timing)',
    tags: ['trap', 'timing', 'IR.III.B.S3a'],
  },
  {
    front: 'Inbound leg came out at 45 seconds — what do you adjust?',
    back: 'Adjust the OUTBOUND leg (lengthen it) to make the INBOUND leg come out at the target time. Never chase the inbound leg directly.',
    source: 'AIM 5-3-8 j4 (outbound timing adjustment)',
    tags: ['trap', 'timing', 'IR.III.B.S5'],
  },
  {
    front: '"Hold northeast of ABC as published" — what does ATC still owe you?',
    back: 'Only direction and "as published" (plus EFC): the charted pattern supplies course, turns, and leg length. Look it up on the chart.',
    source: 'FAA JO 7110.65BB 4-6-1 (charted holding patterns)',
    tags: ['trap', 'chart', 'IR.III.B.K1'],
  },
  {
    front: 'How does an RNAV/GPS system pick your hold entry — and why can it surprise you?',
    back: 'Many systems select the entry from ground track, not heading — strong drift can produce an unexpected entry. RNAV guidance may also execute a fly-by turn starting well before the fix.',
    source: 'AIM 5-3-8 j7 (RNAV holding: ground-track entry, fly-by turns)',
    tags: ['trap', 'entry', 'IR.III.B.S1', 'IR.III.B.S6'],
  },
  // ── SAFETY-CRITICAL ────────────────────────────────────────────────────
  {
    front: 'Unsure of the entry crossing the fix — what is the safe default?',
    back: 'Stay on the holding (protected) side. The entry sectors exist because obstacle protection is built around the holding side; a sloppy entry on the protected side beats a tidy one outside it.',
    source: 'AIM 5-3-8 j3 (entries derived from the obstacle-protection area design)',
    tags: ['safety', 'entry', 'IR.III.B.S1'],
  },
  {
    front: 'Why must you cross the holding fix at or below maximum holding airspeed?',
    back: 'Protected airspace is designed around the maximum holding speeds; crossing faster can take the turn outside protected airspace.',
    source: 'AIM 5-3-8 d (speed reduction approaching a clearance limit); j2 (maximum holding airspeeds table)',
    tags: ['safety', 'speeds', 'IR.III.B.S2'],
  },
  {
    front: 'ATC assigns an unanticipated EFC — what must you do before accepting the hold?',
    back: 'Recalculate fuel reserves. If holding to that EFC eats your planned reserve, declare minimum fuel (or an emergency) and divert instead — the Avianca 052 lesson.',
    source: 'AIM 5-5-15 (minimum fuel advisory); 14 CFR 91.167; NTSB AAR-91/04 (Avianca 052)',
    tags: ['safety', 'fuel', 'IR.III.B.R1', 'IR.III.B.R2'],
  },
  {
    front: 'Your flight guidance system limits bank in holding — what is the rule?',
    back: 'Do not use bank-limiting below 25° unless it is not pilot-selectable, aircraft limitations require it, or minimum maneuvering speed margins demand it; if bank must stay below 25°, advise ATC that additional area for holding is required.',
    source: 'AIM 5-3-8 j8(b)(4) (RNAV bank-angle limiting)',
    tags: ['safety', 'pattern', 'IR.III.B.S6'],
  },
  {
    front: 'The GPS keeps flying outbound past the charted leg length — do you wait?',
    back: 'No — be prepared to intervene if the outbound-to-inbound turn does not begin within a reasonable distance of the charted leg, especially when the hold is a course reversal.',
    source: 'AIM 5-3-8 j8(f) (RNAV holding: be prepared to intervene)',
    tags: ['safety', 'pattern', 'IR.III.B.S6'],
  },
  {
    front: 'Physiological risk of circuit after circuit of holding turns?',
    back: 'Spatial disorientation — prolonged, repeated banked turns invite illusions like the leans. Counter it by referencing the flight instruments, not sensation.',
    source: 'AIM 8-1-5 (illusions in flight leading to spatial disorientation)',
    tags: ['safety', 'pattern', 'IR.III.B.S8'],
  },
]
