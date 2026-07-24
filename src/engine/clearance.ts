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

// Practice fixtures only: invented names for drilling phraseology. Task 8
// introduces holds derived from current FAA dTPP charts; nothing here claims to
// match a real chart. Names must stay disjoint from CHART_HOLDS in
// src/content/questions.ts — a fixture sharing a charted fix's name would
// teach invented course and turn data for a hold the student actually flies
// (see the disjointness test in clearance.test.ts).
//
// They must also stay disjoint from REAL waypoints, which is the trap the
// original "plausible NorCal names" wording walked into: CEDES (Livermore),
// SUNOL and TRACY are all real fixes, and TRACY sits beside KTCY. Verify a new
// fixture name returns no waypoint record (opennav.com/waypoint/US/<NAME>)
// before adding it. The rendered plate line is labelled fictitious regardless —
// see chartNote in src/modules/entry-drill.ts.
const VOR_NAMES = ['Manteca', 'Linden', 'Sacramento', 'Modesto', 'Panoche'] as const
const NDB_NAMES = ['Amber', 'Delta', 'Cooper'] as const

export const PUBLISHED_HOLDS: ReadonlyArray<{
  fix: string
  inboundCourse: number
  turnDirection: TurnDirection
  leg: LegSpec
}> = [
  { fix: 'ZORVU', inboundCourse: 300, turnDirection: 'right', leg: { unit: 'min', value: 1 } },
  { fix: 'QUIBO', inboundCourse: 120, turnDirection: 'left', leg: { unit: 'nm', value: 4 } },
  { fix: 'VAXNU', inboundCourse: 45, turnDirection: 'right', leg: { unit: 'min', value: 1 } },
  { fix: 'BRIXO', inboundCourse: 210, turnDirection: 'left', leg: { unit: 'min', value: 1 } },
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

/** Grades a copied clearance field by field against what was actually said. */
export function gradeCopiedClearance(
  user: CopiedClearance,
  expected: ClearanceFields,
): ClearanceGrade {
  const fields: FieldGrade[] = [
    { field: 'direction', correct: user.direction === expected.direction },
    {
      field: 'fix',
      correct: user.fix.trim().toLowerCase() === expected.fix.trim().toLowerCase(),
    },
    gradeHoldingCourse(user, expected),
    gradeLegLength(user, expected),
    gradeTurnDirection(user, expected),
    { field: 'efc', correct: normalizeEfc(user.efc) === normalizeEfc(expected.efc) },
  ]
  return { allCorrect: fields.every((f) => f.correct), fields }
}
