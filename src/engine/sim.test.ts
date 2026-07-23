// Decision-sim golden cases, hand-derived by drawing (turn radius at 90 KTAS
// standard rate: R = v/ω = 0.025 NM/s ÷ 0.05236 rad/s ≈ 0.4775 NM):
//   - no wind, textbook decisions → closed racetrack, ~60 s inbound, ~240 s total
//   - known wind, AIM triple-drift + ratio-timing decisions → near-60 inbound,
//     small cross-track at the fix
//   - the rule's known blind spot: wind during the two 1-minute turns displaces
//     the pattern along-course, so an inbound headwind leaves the first circuit
//     long — and one exact adjustment of (60 − measured)·GSin/GSout seconds
//     (AIM 5-3-8 j4 "adjust subsequent outbound legs") closes it, because the
//     inbound time is affine in the outbound time
//   - no-crab decisions in a crosswind → measurable drift at the fix

import { describe, expect, it } from 'vitest'
import { entryGuidance } from './entry'
import { groundSpeeds, inboundCrab, outboundHeading, outboundTimeSeconds, type Wind } from './wind'
import {
  HOLD_TAS_KT,
  MAX_SIM_SECONDS,
  TURN_RATE_DEG_PER_S,
  flyCircuit,
  textbookDecisions,
  type SimDecisions,
  type SimHold,
} from './sim'

const RIGHT_NORTH: SimHold = { inboundCourse: 0, turnDirection: 'right' }
const LEFT_NORTH: SimHold = { inboundCourse: 0, turnDirection: 'left' }
const CALM: Wind = { directionFrom: 0, speedKt: 0 }

function decisions(partial: Partial<SimDecisions> = {}): SimDecisions {
  return { entry: 'direct', outboundHeading: 180, inboundCrab: 0, outboundSeconds: 60, ...partial }
}

function distanceFromFix(p: { e: number; n: number }): number {
  return Math.hypot(p.e, p.n)
}

describe('constants', () => {
  it('models the C172 holding profile: 90 KTAS, standard-rate turns', () => {
    expect(HOLD_TAS_KT).toBe(90)
    expect(TURN_RATE_DEG_PER_S).toBe(3)
  })
})

describe('textbookDecisions', () => {
  it('is the wind engine verbatim (engine is the oracle)', () => {
    const wind: Wind = { directionFrom: 240, speedKt: 18 }
    const hold: SimHold = { inboundCourse: 90, turnDirection: 'right' }
    const d = textbookDecisions(hold, wind)
    expect(d.entry).toBe('direct')
    expect(d.inboundCrab).toBeCloseTo(inboundCrab(90, wind, HOLD_TAS_KT), 10)
    expect(d.outboundHeading).toBeCloseTo(outboundHeading(90, wind, HOLD_TAS_KT), 10)
    expect(d.outboundSeconds).toBeCloseTo(outboundTimeSeconds(90, wind, HOLD_TAS_KT), 10)
  })

  it('zero wind → reciprocal heading, no crab, 60 s outbound', () => {
    const d = textbookDecisions(RIGHT_NORTH, CALM)
    expect(d.outboundHeading).toBe(180)
    expect(d.inboundCrab).toBe(0)
    expect(d.outboundSeconds).toBeCloseTo(60, 6)
  })
})

describe('no-wind correctly-flown hold', () => {
  it('closes the racetrack with a ~60 s inbound leg (right turns)', () => {
    const r = flyCircuit(RIGHT_NORTH, decisions(), CALM)
    expect(r.completed).toBe(true)
    expect(r.inboundSeconds).toBeCloseTo(60, 0)
    expect(Math.abs(r.totalSeconds - 240)).toBeLessThan(3)
    expect(Math.abs(r.inboundCrossTrackNm)).toBeLessThan(0.02)
    const last = r.track[r.track.length - 1]!
    expect(distanceFromFix(last)).toBeLessThan(0.05)
  })

  it('mirrors for a left-turn (nonstandard) hold', () => {
    const r = flyCircuit(LEFT_NORTH, decisions(), CALM)
    expect(r.completed).toBe(true)
    expect(r.inboundSeconds).toBeCloseTo(60, 0)
    // whole track on the holding (west) side of the course line
    for (const p of r.track) {
      expect(p.e).toBeLessThan(0.01)
    }
  })

  it('track starts at the fix and stays on the holding side (right turns → east)', () => {
    const r = flyCircuit(RIGHT_NORTH, decisions(), CALM)
    expect(distanceFromFix(r.track[0]!)).toBeLessThan(0.01)
    for (const p of r.track) {
      expect(p.e).toBeGreaterThan(-0.01)
    }
    // reaches the outbound side of the racetrack: ~2R ≈ 0.95 NM east
    expect(Math.max(...r.track.map((p) => p.e))).toBeGreaterThan(0.9)
  })
})

describe('triple-drift decisions in known wind', () => {
  const crosswind: Wind = { directionFrom: 90, speedKt: 15 }

  it('direct crosswind: inbound near 60 s, small cross-track at the fix', () => {
    const r = flyCircuit(RIGHT_NORTH, textbookDecisions(RIGHT_NORTH, crosswind), crosswind)
    expect(r.completed).toBe(true)
    // The rule is an approximation: crab-shifted turn arcs cost ~10 s here.
    expect(Math.abs(r.inboundSeconds - 60)).toBeLessThanOrEqual(12)
    expect(Math.abs(r.inboundCrossTrackNm)).toBeLessThanOrEqual(0.15)
  })

  it('no-crab decisions in the same wind drift well off the fix', () => {
    const r = flyCircuit(RIGHT_NORTH, decisions(), crosswind)
    expect(r.completed).toBe(true)
    expect(Math.abs(r.inboundCrossTrackNm)).toBeGreaterThan(0.5)
  })

  it('inbound headwind: rule-based first circuit runs long (wind drifts the turns)', () => {
    const headwind: Wind = { directionFrom: 0, speedKt: 20 }
    const r = flyCircuit(RIGHT_NORTH, textbookDecisions(RIGHT_NORTH, headwind), headwind)
    expect(r.completed).toBe(true)
    expect(r.inboundSeconds).toBeGreaterThan(75)
  })

  it('one (60 − measured)·GSin/GSout adjustment closes the inbound to ~60 s', () => {
    for (const wind of [
      { directionFrom: 0, speedKt: 20 },
      { directionFrom: 90, speedKt: 15 },
      { directionFrom: 210, speedKt: 12 },
    ] satisfies Wind[]) {
      const first = textbookDecisions(RIGHT_NORTH, wind)
      const flown = flyCircuit(RIGHT_NORTH, first, wind)
      const gs = groundSpeeds(0, wind, HOLD_TAS_KT)
      const adjusted =
        first.outboundSeconds + ((60 - flown.inboundSeconds) * gs.inboundKt) / gs.outboundKt
      const second = flyCircuit(RIGHT_NORTH, { ...first, outboundSeconds: adjusted }, wind)
      expect(second.completed).toBe(true)
      expect(Math.abs(second.inboundSeconds - 60)).toBeLessThanOrEqual(3)
    }
  })
})

describe('entry shapes', () => {
  it('teardrop bulges onto the holding side and crosses the fix line east of it', () => {
    const g = entryGuidance('teardrop', RIGHT_NORTH)
    const r = flyCircuit(
      RIGHT_NORTH,
      decisions({ entry: 'teardrop', outboundHeading: g.outboundHeading }),
      CALM,
    )
    expect(r.completed).toBe(true)
    expect(Math.max(...r.track.map((p) => p.e))).toBeGreaterThan(1)
    // honest physics: a 60 s teardrop leg does not re-intercept by itself
    expect(r.inboundCrossTrackNm).toBeGreaterThan(0.5)
  })

  it('parallel flies the non-holding side with opposite turns and returns', () => {
    const r = flyCircuit(RIGHT_NORTH, decisions({ entry: 'parallel' }), CALM)
    expect(r.completed).toBe(true)
    for (const p of r.track) {
      expect(p.e).toBeLessThan(0.01)
    }
    expect(Math.abs(r.inboundCrossTrackNm)).toBeLessThan(0.05)
  })

  // Left-turn mirrors: the turnSign inversion is exactly the sign-convention
  // bug class the project rules flag, so both shapes get mirrored coverage.

  it('left-turn teardrop mirrors: bulges west onto the holding side', () => {
    const g = entryGuidance('teardrop', LEFT_NORTH)
    const r = flyCircuit(
      LEFT_NORTH,
      decisions({ entry: 'teardrop', outboundHeading: g.outboundHeading }),
      CALM,
    )
    expect(r.completed).toBe(true)
    expect(Math.min(...r.track.map((p) => p.e))).toBeLessThan(-1)
    // cross-track is signed toward the holding side, so the sign matches
    // the right-turn case even though the geometry is mirrored
    expect(r.inboundCrossTrackNm).toBeGreaterThan(0.5)
  })

  it('left-turn parallel mirrors: flies the east (non-holding) side and returns', () => {
    const r = flyCircuit(LEFT_NORTH, decisions({ entry: 'parallel' }), CALM)
    expect(r.completed).toBe(true)
    for (const p of r.track) {
      expect(p.e).toBeGreaterThan(-0.01)
    }
    expect(Math.abs(r.inboundCrossTrackNm)).toBeLessThan(0.05)
  })
})

describe('limits and validation', () => {
  it('reports an unclosable circuit instead of hanging', () => {
    // 80 kt tailwind outbound with a 45° crab decision: inbound ground speed
    // along the course is negative — the aircraft can never reach the fix.
    const gale: Wind = { directionFrom: 0, speedKt: 80 }
    const r = flyCircuit(
      RIGHT_NORTH,
      decisions({ inboundCrab: 45, outboundSeconds: 30 }),
      gale,
    )
    expect(r.completed).toBe(false)
    expect(r.totalSeconds).toBeLessThanOrEqual(MAX_SIM_SECONDS + 1)
  })

  it('rejects out-of-range inputs', () => {
    expect(() => flyCircuit(RIGHT_NORTH, decisions({ outboundHeading: 360 }), CALM)).toThrow(
      RangeError,
    )
    expect(() => flyCircuit(RIGHT_NORTH, decisions({ outboundHeading: NaN }), CALM)).toThrow(
      RangeError,
    )
    expect(() => flyCircuit(RIGHT_NORTH, decisions({ inboundCrab: 46 }), CALM)).toThrow(RangeError)
    expect(() => flyCircuit(RIGHT_NORTH, decisions({ inboundCrab: NaN }), CALM)).toThrow(RangeError)
    expect(() => flyCircuit(RIGHT_NORTH, decisions({ outboundSeconds: 0 }), CALM)).toThrow(
      RangeError,
    )
    expect(() => flyCircuit(RIGHT_NORTH, decisions({ outboundSeconds: 601 }), CALM)).toThrow(
      RangeError,
    )
    expect(() =>
      flyCircuit({ inboundCourse: -1, turnDirection: 'right' }, decisions(), CALM),
    ).toThrow(RangeError)
    expect(() => flyCircuit(RIGHT_NORTH, decisions(), { directionFrom: 0, speedKt: 90 })).toThrow(
      RangeError,
    )
    expect(() => flyCircuit(RIGHT_NORTH, decisions(), { directionFrom: 0, speedKt: -1 })).toThrow(
      RangeError,
    )
  })

  it('samples the ground track about once per second', () => {
    const r = flyCircuit(RIGHT_NORTH, decisions(), CALM)
    expect(r.track.length).toBeGreaterThan(200)
    expect(r.track.length).toBeLessThan(280)
  })
})
