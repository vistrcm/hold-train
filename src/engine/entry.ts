// Holding pattern entry determination per AIM 5-3-8 j3 and FIG 5-3-4.
//
// Sector geometry, derived by drawing and verified against the AIM figure:
// classify the aircraft heading H by d = angleDiff(inboundCourse, H) for a
// standard (right-turn) pattern; a nonstandard pattern mirrors the sectors
// about the holding course, so classify with -d.
//   direct   (180° sector):  -70 < d < 110
//   teardrop ( 70° sector):  110 <= d <= 180
//   parallel (110° sector): -180 < d <= -70
// The 70° line lies 70° from the outbound course toward the holding side.

import { angleDiff, normalizeDeg, reciprocal } from './geometry'

export type Entry = 'direct' | 'teardrop' | 'parallel'
export type TurnDirection = 'right' | 'left'

export const ENTRIES: readonly Entry[] = ['direct', 'teardrop', 'parallel']

/** The slice of a hold an entry decision needs; a full HoldSpec satisfies it. */
export interface HoldCourse {
  /** Inbound holding course TO the fix, degrees magnetic. */
  inboundCourse: number
  turnDirection: TurnDirection
}

/** Heading arc, clockwise from `from` to `to`, for HSI sector overlays. */
export interface SectorArc {
  from: number
  to: number
}

export interface EntryResult {
  primary: Entry
  /** Entries also acceptable within ±5° of a sector boundary (AIM 5-3-8 j8(d)). */
  alternates: Entry[]
  sectors: Record<Entry, SectorArc>
  source: string
}

export interface EntryGuidance {
  entry: Entry
  /** Heading to fly after crossing the fix. */
  outboundHeading: number
  /** Which side of the holding course the entry maneuver is flown on. */
  side: 'holding' | 'nonholding'
  /** Direction of the turn back to the inbound course. */
  turnToInbound: TurnDirection
  source: string
}

const SOURCE = 'AIM 5-3-8 j3, FIG 5-3-4; ±5° per AIM 5-3-8 j8(d)'
const GUIDANCE_SOURCE = 'AIM 5-3-8 j3'

/**
 * Angle the parallel entry's rejoin turn rolls out on, measured from the inbound
 * holding course toward the rejoin turn's direction — so the rollout heading is
 * `normalizeDeg(inboundCourse + PARALLEL_INTERCEPT_DEG * rejoinSign)`, giving a
 * 225° sweep from outbound.
 *
 * This is CONVENTION, not AIM text: AIM 5-3-8 j3(a) requires only "more than 180
 * degrees". 45° is chosen because it matches how FIG 5-3-4, AIP FIG ENR 1.5-3 and
 * IFH FAA-H-8083-15B Fig 10-6 draw the rollout. It lives here, in the oracle, so
 * the map (`src/ui/mapview.ts`) and the sim (`src/engine/sim.ts`) cannot drift
 * from it — three hand-written copies of this geometry are how the rejoin
 * direction came to be wrong in five modules at once.
 *
 * Distinct from `towardHoldingSide` (±30°) below, which is the TEARDROP's offset
 * per AIM 5-3-8 j3(b). Different maneuver, different quantity.
 */
export const PARALLEL_INTERCEPT_DEG = 45

/** ±5° in heading is within good operating limits for determining entry. */
const BOUNDARY_TOLERANCE = 5

// Standard-pattern sector boundaries as d = angleDiff(inboundCourse, heading),
// each with the pair of entries acceptable when the heading is near it.
const BOUNDARIES: ReadonlyArray<{ d: number; pair: [Entry, Entry] }> = [
  { d: 110, pair: ['direct', 'teardrop'] },
  { d: -70, pair: ['direct', 'parallel'] },
  { d: 180, pair: ['teardrop', 'parallel'] },
]

function classify(d: number): Entry {
  if (d > -70 && d < 110) {
    return 'direct'
  }
  if (d >= 110) {
    return 'teardrop'
  }
  return 'parallel'
}

function circularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDeg(a - b))
  return Math.min(diff, 360 - diff)
}

function sectorArcs(hold: HoldCourse): Record<Entry, SectorArc> {
  const c = hold.inboundCourse
  // Mirror the standard offsets for a left-turn pattern (AIM 5-3-8 j3:
  // entries stay oriented to the 70° line on the holding side).
  const sign = hold.turnDirection === 'right' ? 1 : -1
  const arc = (fromOffset: number, toOffset: number): SectorArc =>
    sign === 1
      ? { from: normalizeDeg(c + fromOffset), to: normalizeDeg(c + toOffset) }
      : { from: normalizeDeg(c - toOffset), to: normalizeDeg(c - fromOffset) }
  return {
    direct: arc(-70, 110),
    teardrop: arc(110, 180),
    parallel: arc(180, 290),
  }
}

export function determineEntry(heading: number, hold: HoldCourse): EntryResult {
  const d = angleDiff(hold.inboundCourse, heading)
  const m = hold.turnDirection === 'right' ? d : -d

  const primary = classify(m)
  const alternates: Entry[] = []
  for (const boundary of BOUNDARIES) {
    if (circularDistance(m, boundary.d) <= BOUNDARY_TOLERANCE) {
      for (const entry of boundary.pair) {
        if (entry !== primary) {
          alternates.push(entry)
        }
      }
    }
  }

  return { primary, alternates, sectors: sectorArcs(hold), source: SOURCE }
}

export function entryGuidance(entry: Entry, hold: HoldCourse): EntryGuidance {
  const outboundCourse = reciprocal(hold.inboundCourse)
  const pattern = hold.turnDirection
  // Flying the outbound course, the holding side is opposite the pattern's
  // turn direction (right turns off the inbound leg put the racetrack on the
  // outbound leg's left).
  const towardHoldingSide = pattern === 'right' ? -30 : 30

  switch (entry) {
    case 'direct':
      return {
        entry,
        outboundHeading: outboundCourse,
        side: 'holding',
        turnToInbound: pattern,
        source: GUIDANCE_SOURCE,
      }
    case 'teardrop':
      return {
        entry,
        outboundHeading: normalizeDeg(outboundCourse + towardHoldingSide),
        side: 'holding',
        turnToInbound: pattern,
        source: GUIDANCE_SOURCE,
      }
    case 'parallel':
      // AIM 5-3-8 j3(a): parallel outbound on the nonholding side, then "turn in
      // the direction of the holding pattern through more than 180 degrees".
      //
      // That phrase is SPATIAL — toward the racetrack, back across the holding
      // course onto the holding side — NOT rotational. So the rejoin turn OPPOSES
      // the pattern. The parallel entry is the one entry with two turns against
      // the pattern; only the final turn at the fix follows it.
      //
      // FIG 5-3-4 settles the ambiguity the sentence cannot: in one standard-
      // pattern figure it draws the teardrop rejoin clockwise (with the pattern)
      // and the parallel rejoin counter-clockwise (against it) — same words, two
      // senses. IFH FAA-H-8083-15B Fig 10-6 and AIP FIG ENR 1.5-3 agree. ICAO Doc
      // 8168 Vol I Pt II §6 Ch 2 states it in words: 2.2.4 (parallel) "the
      // aircraft is turned TOWARD THE HOLDING SIDE"; 2.2.5 (teardrop) "turned
      // RIGHT". Rendered evidence: docs/parallel-entry-evidence.md.
      //
      // ⚠️ DO NOT re-derive this from "more than 180 degrees". That clause does
      // not discriminate between the two readings, and reasoning from it is what
      // shipped this field inverted app-wide on 2026-07-22 (docs/content-audit.md).
      // The old argument measured the bearing to the fix at the START of the turn
      // and never updated it for motion DURING the turn; computed properly, right
      // turns sweep 212.6°–222.1° and left turns 189.3°–215.3° — both over 180°,
      // and exactly equal at zero offset by symmetry.
      return {
        entry,
        outboundHeading: outboundCourse,
        side: 'nonholding',
        turnToInbound: pattern === 'right' ? 'left' : 'right',
        source: GUIDANCE_SOURCE,
      }
  }
}
