// Holding clearance model: realistic controller phraseology, seeded scenario
// generation with an engine-derived answer key, and field-by-field grading of
// a copied clearance.
//
// Phraseology verified against the current order, fetched from faa.gov:
//   FAA JO 7110.65BB 4-6-4 (Holding Instructions) — specify: direction of
//   holding from the fix; the fix; the radial/course/bearing to hold on; leg
//   length in miles if DME or RNAV is used; turn direction only if left turns
//   are to be made.
//   FAA JO 7110.65BB 4-6-1 (Clearance to Holding Fix) — charted patterns may
//   be abbreviated to holding direction plus "as published"; EFC.
//   AIM 5-3-8 i — the pilot-facing element order matches the above.

import {
  type Cardinal,
  cardinalFromCourse,
  normalizeDeg,
  radialToInboundCourse,
  reciprocal,
} from './geometry'
import type { TurnDirection } from './entry'

export type FixKind = 'VOR' | 'VOR/DME' | 'NDB' | 'charted'
export type CourseKind = 'radial' | 'bearing' | 'published'

export interface LegSpec {
  unit: 'min' | 'nm'
  value: number
}

/**
 * A holding clearance as spoken: only what the controller actually says.
 * 'unstated' fields are the ones the pilot must resolve by rule.
 */
export interface ClearanceFields {
  direction: Cardinal
  fix: string
  fixKind: FixKind
  courseKind: CourseKind
  courseDegrees?: number
  leg: LegSpec | 'unstated' | 'published'
  turnDirection: 'left' | 'unstated'
  efc: string
}

/** The fully resolved hold — every unstated field decided by rule or chart. */
export interface HoldSpec {
  fix: string
  fixKind: FixKind
  /** Inbound holding course TO the fix, degrees magnetic. */
  inboundCourse: number
  turnDirection: TurnDirection
  leg: LegSpec
  efc: string
}

export interface Clearance {
  text: string
  source: string
}

export interface GeneratedClearance {
  clearance: Clearance
  holdSpec: HoldSpec
  expectedFields: ClearanceFields
}

/** What the pilot wrote down and resolved — no 'unstated' allowed here. */
export interface CopiedClearance {
  direction: Cardinal
  fix: string
  courseKind: CourseKind
  courseDegrees?: number
  leg: LegSpec | 'published'
  // 'published' is the affirmative "per chart" copy for a charted hold, mirroring
  // leg. A charted hold's turns come from the plate, not from ATC's omission rule.
  turnDirection: TurnDirection | 'published'
  efc: string
}

export type GradedField =
  | 'direction'
  | 'fix'
  | 'holdingCourse'
  | 'legLength'
  | 'turnDirection'
  | 'efc'

export interface FieldGrade {
  field: GradedField
  correct: boolean
  note?: string
  /** Marks the omitted-turn-direction trap (silence means right turns). */
  trap?: boolean
}

export interface ClearanceGrade {
  allCorrect: boolean
  fields: FieldGrade[]
}

const CLEARANCE_SOURCE =
  'FAA JO 7110.65BB 4-6-4 (holding instructions), 4-6-1 (as published, EFC); AIM 5-3-8 i'

// --- spoken phraseology -----------------------------------------------------

const DIGIT_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'niner',
] as const

const CARDINAL_WORDS: Record<Cardinal, string> = {
  N: 'north',
  NE: 'northeast',
  E: 'east',
  SE: 'southeast',
  S: 'south',
  SW: 'southwest',
  W: 'west',
  NW: 'northwest',
}

function speakDigits(digits: string): string {
  return [...digits]
    .map((ch) => {
      const word = DIGIT_WORDS[Number(ch)]
      if (!/^\d$/.test(ch) || word === undefined) {
        throw new RangeError(`expected digits, got ${JSON.stringify(digits)}`)
      }
      return word
    })
    .join(' ')
}

/** Courses are always three digits: 050 → "zero five zero", 360 stays 360. */
function speakCourse(degrees: number | undefined): string {
  if (degrees === undefined || !Number.isInteger(degrees) || degrees < 0 || degrees > 360) {
    throw new RangeError(`course must be an integer in [0, 360], got ${degrees}`)
  }
  return speakDigits(String(degrees).padStart(3, '0'))
}

function speakLeg(leg: LegSpec): string {
  if (!Number.isInteger(leg.value) || leg.value <= 0) {
    throw new RangeError(`leg value must be a positive integer, got ${leg.value}`)
  }
  const value = leg.value < 10 ? DIGIT_WORDS[leg.value]! : speakDigits(String(leg.value))
  const unit = leg.unit === 'nm' ? 'mile' : 'minute'
  return `${value} ${unit} legs`
}

/** Renders a clearance exactly as spoken, in JO 7110.65BB 4-6-4 element order. */
export function clearanceText(fields: ClearanceFields): string {
  const direction = CARDINAL_WORDS[fields.direction]
  if (!/^\d{4}$/.test(fields.efc)) {
    throw new RangeError(`EFC must be a 4-digit zulu time, got ${JSON.stringify(fields.efc)}`)
  }

  const parts: string[] = []
  if (fields.courseKind === 'published') {
    parts.push(`Hold ${direction} of ${fields.fix} as published`)
  } else {
    const station = fields.fixKind === 'NDB' ? 'NDB' : 'VOR'
    const course =
      fields.courseKind === 'radial'
        ? `the ${speakCourse(fields.courseDegrees)} radial`
        : `the ${speakCourse(fields.courseDegrees)} bearing to the station`
    parts.push(`Hold ${direction} of the ${fields.fix} ${station} on ${course}`)
  }
  if (typeof fields.leg === 'object') {
    parts.push(speakLeg(fields.leg))
  }
  if (fields.turnDirection === 'left') {
    parts.push('left turns')
  }
  parts.push(`expect further clearance at ${speakDigits(fields.efc)}`)
  return `${parts.join(', ')}.`
}

// --- seeded scenario generation ---------------------------------------------

// Station names for the ad-hoc ATC branch. The VORs are real NorCal navaids and
// always have been: an ATC-assigned hold at a real station claims nothing
// published, because the radial, turn direction and leg are drawn per scenario
// rather than presented as the station's own geometry. That is why this list
// survived every audit the 5-letter fixtures did not.
//
// What a name here DOES claim is that there is a station to tune, so every one
// is checked against the navaid table in docs/bay-area-holds.md — presence in
// CIFP 2608, which is what "still commissioned" means for a navaid. The eleven
// added alongside the original five are every current station that table
// records; a bigger pool is more seed variety at no cost, since none of them
// carries geometry.
//
// Manteca (ECA) is KEPT KNOWINGLY though it is gone: decommissioned 2018-03-29
// under VOR MON, absent from CIFP 2608, and shipped here long before the pool
// went mixed. A hold at a station that closed in 2018 still teaches the right
// entry, and dropping it would be the one deletion in an otherwise additive
// change — so it stays, recorded rather than rediscovered a third time. It is
// also the only name in the dossier's table marked that way, and
// clearance.test.ts requires the row to still say so.
//
// There is no "Stockton" VOR to add, though the airport is on the list this
// pool serves: no such VHF navaid exists in CIFP 2608, and the station that
// served KSCK was Manteca.
//
// The NDB names stay INVENTED, deliberately. No NDB remains anywhere in the Bay
// Area or the Central Valley (docs/bay-area-holds.md), so there is no current
// name to adopt; the alternative was a historical one, rejected because
// ADOPTING a defunct station is a new claim where an obviously invented name
// already works — which is not the same act as keeping one that predates the
// rule, above. The drill needs these names only to carry an NDB scenario, which
// exists to exercise the bearing-vs-radial distinction. clearance.test.ts
// checks them against the same navaid table from the other side: none of them
// may be a real station.
export const VOR_NAMES = [
  'Manteca',
  'Linden',
  'Sacramento',
  'Modesto',
  'Panoche',
  'Woodside',
  'Sausalito',
  'Point Reyes',
  'Salinas',
  'Oakland',
  'Avenal',
  'Scaggs Island',
  'San Francisco',
  'San Jose',
  'Concord',
  'El Nido',
] as const
export const NDB_NAMES = ['Amber', 'Delta', 'Cooper'] as const

interface PracticeHold {
  fix: string
  inboundCourse: number
  turnDirection: TurnDirection
  leg: LegSpec
}

// The "hold as published" pool is MIXED by design, and the split below is what
// lets each guard scope itself — chosen over a `real: boolean` per hold, which
// would add a field, a branch and a distinction the student cannot act on
// (neither kind may be flown).
//
// The old rule was "a fixture name may never be a real waypoint" and it is gone,
// not weakened. It was a proxy for the invariant that matters: the defect in
// every audit entry it was patched for (HAIRE, CEDES, WINDY/DRIFT/TIMBR) was
// inventing facts ABOUT a real place, never naming one — and a name ban checks
// no geometry at all, while forbidding exactly the realism this drill wants.
// Three rules replace it, all asserted in clearance.test.ts:
//
//   1. A fixture sharing a name with CHART_HOLDS (src/content/questions.ts) must
//      match it on inboundCourse, turnDirection, leg.unit AND leg.value. Two
//      screens teaching different holds under one fix name is the app
//      contradicting itself, which is worse than approximate data and invisible
//      to any amount of caveating. OYOSO, HAIRE and UHHUT are that overlap.
//   2. A researched fixture's geometry must match its row in
//      docs/bay-area-holds.md, the record of where the numbers came from.
//   3. An invented name must still return no waypoint record
//      (opennav.com/waypoint/US/<NAME>) before it is added — the original
//      defect, unchanged, over the half the ban was ever right about.
//
// None of this makes the data current. The rendered line hedges it as practice
// data and names no procedure, amendment or cycle — see holdNote in
// src/modules/entry-drill.ts.
export const INVENTED_HOLDS: readonly PracticeHold[] = [
  { fix: 'ZORVU', inboundCourse: 300, turnDirection: 'right', leg: { unit: 'min', value: 1 } },
  { fix: 'QUIBO', inboundCourse: 120, turnDirection: 'left', leg: { unit: 'nm', value: 4 } },
  { fix: 'VAXNU', inboundCourse: 45, turnDirection: 'right', leg: { unit: 'min', value: 1 } },
  { fix: 'BRIXO', inboundCourse: 210, turnDirection: 'left', leg: { unit: 'min', value: 1 } },
]

/**
 * Real Bay Area / Central Valley holds. Geometry researched from FAA CIFP cycle
 * 2608 and cross-checked on the same cycle's d-TPP plates — every entry here is
 * `researched` confidence in docs/bay-area-holds.md, which is the provenance
 * record and not current chart data.
 *
 * Held back, by mechanism rather than by list — the dossier records 22 real
 * fixes and 13 ship, so the next name someone reaches for is probably one of
 * the nine, and a bare enumeration answers only the ones already thought of:
 *  - CONFIDENCE below `researched` — WHYEE, IPDEW, ORANG and DECOT. All four
 *    have a CIFP record and no plate witness of a field this array carries;
 *    DECOT was shipped on 2026-08-17 and withdrawn on 2026-08-18 when its
 *    plate quotation turned out to name the hold's altitude and nothing else
 *    (docs/content-audit.md). The dossier's confidence column is the gate, and
 *    `RESEARCHED_HOLDS agrees with docs/bay-area-holds.md` enforces it.
 *  - FIX SHAPE — LIN, OAK, SAU and MOD are holds AT a navaid, so their fix is a
 *    3-letter ident where this pool speaks a 5-letter fix name; promoting one
 *    reds `every fixture carries geometry the clearance engine can speak`.
 *  - SEED VALUE — ALTAM alone: its 1-minute geometry duplicates ZELAT's shape,
 *    so it buys a CHART_HOLDS constraint without buying variety. This is the
 *    only judgement call of the three; the other two are asserted.
 */
export const RESEARCHED_HOLDS: readonly PracticeHold[] = [
  // KTCY — Tracy Municipal. OMWAP is the strongest single find: its plate
  // states the turn direction in words, so it needs no racetrack read off a
  // drawing.
  { fix: 'OYOSO', inboundCourse: 116, turnDirection: 'left', leg: { unit: 'nm', value: 4 } },
  { fix: 'HAIRE', inboundCourse: 231, turnDirection: 'right', leg: { unit: 'nm', value: 4 } },
  { fix: 'OMWAP', inboundCourse: 255, turnDirection: 'right', leg: { unit: 'nm', value: 4 } },
  { fix: 'NAPYI', inboundCourse: 297, turnDirection: 'right', leg: { unit: 'nm', value: 4 } },
  // KLVK — Livermore Municipal
  { fix: 'UHHUT', inboundCourse: 255, turnDirection: 'right', leg: { unit: 'nm', value: 4 } },
  // KSQL — San Carlos
  { fix: 'AMEBY', inboundCourse: 297, turnDirection: 'left', leg: { unit: 'nm', value: 5 } },
  // KOAK — Oakland International
  { fix: 'REBAS', inboundCourse: 344, turnDirection: 'right', leg: { unit: 'nm', value: 4 } },
  { fix: 'HAYZE', inboundCourse: 275, turnDirection: 'right', leg: { unit: 'nm', value: 5 } },
  // KHWD — Hayward Executive
  { fix: 'JOBUS', inboundCourse: 285, turnDirection: 'right', leg: { unit: 'nm', value: 5 } },
  // KSCK — Stockton Metropolitan. HAXEK is 113.5° in CIFP and the plates depict
  // 113°; where the two disagree the chart wins, because the chart is what a
  // student reads. It is the only such case in the dossier.
  { fix: 'OXJEF', inboundCourse: 294, turnDirection: 'right', leg: { unit: 'nm', value: 4 } },
  { fix: 'HAXEK', inboundCourse: 113, turnDirection: 'right', leg: { unit: 'nm', value: 4 } },
  // KMOD — Modesto City-County. SHELI (148°) and ZELAT's 1-minute leg are the
  // useful outliers: Bay Area finals point west, so their missed-approach holds
  // cluster hard in the 270°-300° band.
  { fix: 'ZELAT', inboundCourse: 288, turnDirection: 'left', leg: { unit: 'min', value: 1 } },
  { fix: 'SHELI', inboundCourse: 148, turnDirection: 'right', leg: { unit: 'nm', value: 4 } },
]

export const PUBLISHED_HOLDS: readonly PracticeHold[] = [
  ...INVENTED_HOLDS,
  ...RESEARCHED_HOLDS,
]

const FIX_KINDS: readonly FixKind[] = ['VOR', 'VOR/DME', 'NDB', 'charted']
const DME_LEG_MILES = [4, 5, 8, 10] as const

/** mulberry32 — tiny deterministic PRNG so every seed replays exactly. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateClearance(seed: number): GeneratedClearance {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`seed must be finite, got ${seed}`)
  }
  const rng = mulberry32(Math.trunc(seed))
  const int = (n: number): number => Math.floor(rng() * n)
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!

  const fixKind = pick(FIX_KINDS)
  const efc = `${String(int(24)).padStart(2, '0')}${String(int(12) * 5).padStart(2, '0')}`

  let holdSpec: HoldSpec
  let expectedFields: ClearanceFields
  if (fixKind === 'charted') {
    const published = pick(PUBLISHED_HOLDS)
    holdSpec = { ...published, fixKind, efc }
    expectedFields = {
      direction: cardinalFromCourse(reciprocal(published.inboundCourse)),
      fix: published.fix,
      fixKind,
      courseKind: 'published',
      leg: 'published',
      turnDirection: 'unstated',
      efc,
    }
  } else {
    // Courses in 10° steps read naturally on the radio; 360 spoken, not 000.
    const statedDegrees = 10 + 10 * int(36)
    const courseKind: CourseKind = fixKind === 'NDB' ? 'bearing' : 'radial'
    // A radial points FROM the station; a bearing points TO it (P/CG).
    const inboundCourse =
      courseKind === 'radial'
        ? radialToInboundCourse(normalizeDeg(statedDegrees))
        : normalizeDeg(statedDegrees)
    const turnDirection: TurnDirection = rng() < 0.35 ? 'left' : 'right'
    const leg: LegSpec =
      fixKind === 'VOR/DME' ? { unit: 'nm', value: pick(DME_LEG_MILES) } : { unit: 'min', value: 1 }
    holdSpec = {
      fix: pick(fixKind === 'NDB' ? NDB_NAMES : VOR_NAMES),
      fixKind,
      inboundCourse,
      turnDirection,
      leg,
      efc,
    }
    expectedFields = {
      direction: cardinalFromCourse(reciprocal(inboundCourse)),
      fix: holdSpec.fix,
      fixKind,
      courseKind,
      courseDegrees: statedDegrees,
      leg: fixKind === 'VOR/DME' ? leg : 'unstated',
      turnDirection: turnDirection === 'left' ? 'left' : 'unstated',
      efc,
    }
  }

  return {
    clearance: { text: clearanceText(expectedFields), source: CLEARANCE_SOURCE },
    holdSpec,
    expectedFields,
  }
}

// --- grading ----------------------------------------------------------------

function gradeHoldingCourse(user: CopiedClearance, expected: ClearanceFields): FieldGrade {
  const field: GradedField = 'holdingCourse'
  if (expected.courseKind === 'published') {
    if (user.courseKind === 'published') {
      return { field, correct: true }
    }
    return {
      field,
      correct: false,
      note: 'The controller said "as published" — the holding course comes from the chart.',
    }
  }
  if (user.courseKind === 'published') {
    return {
      field,
      correct: false,
      note: 'A specific course was stated; this hold is not "as published".',
    }
  }
  if (user.courseKind !== expected.courseKind) {
    let note = 'A radial points FROM the station; a bearing points TO the station.'
    if (user.courseDegrees !== undefined && expected.courseDegrees !== undefined) {
      const reversed =
        normalizeDeg(user.courseDegrees) === reciprocal(normalizeDeg(expected.courseDegrees))
      if (reversed) {
        note += ' Your numbers are geometrically equivalent, but copy what was actually said.'
      }
    }
    return { field, correct: false, note }
  }
  const correct =
    user.courseDegrees !== undefined &&
    expected.courseDegrees !== undefined &&
    normalizeDeg(user.courseDegrees) === normalizeDeg(expected.courseDegrees)
  return { field, correct }
}

function gradeLegLength(user: CopiedClearance, expected: ClearanceFields): FieldGrade {
  const field: GradedField = 'legLength'
  if (expected.leg === 'published') {
    return { field, correct: user.leg === 'published' }
  }
  const target: LegSpec = expected.leg === 'unstated' ? { unit: 'min', value: 1 } : expected.leg
  const correct =
    typeof user.leg === 'object' && user.leg.unit === target.unit && user.leg.value === target.value
  if (expected.leg === 'unstated') {
    return {
      field,
      correct,
      note: 'No leg length stated — standard 1 minute inbound legs (AIM 5-3-8 j4).',
    }
  }
  return { field, correct }
}

function gradeTurnDirection(user: CopiedClearance, expected: ClearanceFields): FieldGrade {
  const field: GradedField = 'turnDirection'
  if (expected.fixKind === 'charted') {
    // Symmetry with the leg field: a charted hold's turns are on the plate, so
    // the correct copy is "per chart", not a guessed left/right.
    return {
      field,
      correct: user.turnDirection === 'published',
      note: 'Turn direction comes from the published pattern on the chart — copy it as "per chart".',
    }
  }
  if (expected.turnDirection === 'unstated') {
    return {
      field,
      correct: user.turnDirection === 'right',
      trap: true,
      note:
        'No turn direction stated — that means standard right turns; ' +
        'controllers state turns only when they are left (JO 7110.65BB 4-6-4).',
    }
  }
  return { field, correct: user.turnDirection === expected.turnDirection }
}

// A copied EFC is the same clearance whether or not the pilot wrote the zulu
// suffix — "EFC 1745Z" is how it goes on the kneeboard, and how the copy
// drill's own review panel prints the expected value. Grading the bare form
// only would mark back exactly what the app displayed.
function normalizeEfc(text: string): string {
  return text.trim().toUpperCase().replace(/Z$/, '')
}

/**
 * A fix as typed, for comparison: case-folded, and internal runs of whitespace
 * collapsed to one space.
 *
 * The collapse is not decoration. VOR_NAMES went mixed and five of its entries
 * are now two words — `Point Reyes`, `Scaggs Island`, `San Francisco`,
 * `San Jose`, `El Nido` — so a double space between them is a plausible typo in
 * a free-text field, and grading a correctly copied fix wrong is exactly the
 * negative training this drill exists to prevent. What is NOT normalised away
 * is the space itself: `PointReyes` stays wrong, because a student who cannot
 * hear the word boundary has not copied the fix.
 */
function normalizeFix(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Grades a copied clearance field by field against what was actually said. */
export function gradeCopiedClearance(
  user: CopiedClearance,
  expected: ClearanceFields,
): ClearanceGrade {
  const fields: FieldGrade[] = [
    { field: 'direction', correct: user.direction === expected.direction },
    {
      field: 'fix',
      correct: normalizeFix(user.fix) === normalizeFix(expected.fix),
    },
    gradeHoldingCourse(user, expected),
    gradeLegLength(user, expected),
    gradeTurnDirection(user, expected),
    { field: 'efc', correct: normalizeEfc(user.efc) === normalizeEfc(expected.efc) },
  ]
  return { allCorrect: fields.every((f) => f.correct), fields }
}
