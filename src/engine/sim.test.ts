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
import { PARALLEL_INTERCEPT_DEG, entryGuidance } from './entry'
import { groundSpeeds, inboundCrab, outboundHeading, outboundTimeSeconds, type Wind } from './wind'
import {
  HOLD_TAS_KT,
  MAX_SIM_SECONDS,
  SAMPLE_SECONDS,
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

  // AIM 5-3-8 j3(a): parallel turns onto the outbound heading toward the
  // NONholding side, and then BOTH the outbound turn and the rejoin oppose the
  // pattern — the rejoin turns back toward the holding side, and in the real
  // maneuver it crosses the course. "Turn in the direction of the holding
  // pattern" is spatial, not rotational; FIG 5-3-4 draws the teardrop rejoin
  // clockwise and the parallel rejoin counter-clockwise in one figure. See
  // docs/parallel-entry-evidence.md. Do NOT re-derive this from the ">180°"
  // clause — both senses exceed 180°, so the clause does not discriminate, and
  // reasoning from it inverted this app once.
  //
  // ⚠️ THIS MODEL DOES NOT DRAW THE CROSSING, and the assertions below pin the
  // model, not the maneuver. `flyCircuit` starts established ON the course at
  // the fix, so the turn onto outbound is a full 180° and the rejoin comes out
  // TANGENT to the holding course — the track stays on the nonholding side
  // throughout and the inbound leg diverges instead of converging. That is the
  // KNOWN MODEL LIMITATION block in sim.ts, not a wrong turn direction. Do not
  // "fix" the assertions below to match the prose above: an assertion that the
  // track crosses the course is red under this initial condition, and a red test
  // that reads like a direction defect is exactly what argues the next session
  // back into inverting the rejoin. The DIRECTION is guarded, faithfully and at
  // the trajectory level, in src/parallel-entry.invariants.test.ts.
  it('parallel: outbound turn opposes the pattern, and so does the reintercept', () => {
    // Derived, not written out: a rounded literal left the -2R bound below with
    // ~1e-3 NM of slack, so any change to DT, TAS or the turn rate produced a
    // failure that reads like a rejoin-direction regression.
    const R = HOLD_TAS_KT / 3600 / ((TURN_RATE_DEG_PER_S * Math.PI) / 180) // ≈ 0.4775 NM
    const r = flyCircuit(RIGHT_NORTH, decisions({ entry: 'parallel' }), CALM)
    expect(r.completed).toBe(true)
    // right-turn hold → holding side east; the whole entry stays west of course
    for (const p of r.track) {
      expect(p.e).toBeLessThan(0.01)
    }
    // 180° onto outbound + the 60 s leg + a (180 + PARALLEL_INTERCEPT_DEG)°
    // rejoin, so this slice is everything through rejoin completion. DERIVED,
    // not the literal 196: that value holds only at the current intercept angle,
    // and this branch already moved it once (30 → 45). Raising it again would
    // silently cut the window mid-turn — both assertions below would still pass,
    // weaker than intended, and the whole-track bound further down would go red
    // with a message that reads like a rejoin-direction defect. That is exactly
    // the red test the comment block above warns future sessions about.
    const rejoinEnd =
      Math.ceil(
        (180 / TURN_RATE_DEG_PER_S + 60 + (180 + PARALLEL_INTERCEPT_DEG) / TURN_RATE_DEG_PER_S) /
          SAMPLE_SECONDS,
      ) + 1
    const throughRejoin = r.track.slice(0, rejoinEnd)
    // A2: the rejoin turn stays inside the displacement the outbound turn
    // already made — it curls back toward the course, it does not bulge past it
    expect(Math.min(...throughRejoin.map((p) => p.e))).toBeGreaterThan(-2 * R - 0.02) // ≈ -0.9549
    expect(throughRejoin.at(-1)!.e).toBeGreaterThan(-0.2) // rollout ≈ -0.1390
    // Whole track: -1.3022 after the fix, -1.9099 before it. The straight
    // intercept leg diverges further west under this model's initial condition
    // (see the sim.ts header note), so the 2R bound above is measured through
    // rejoin completion only — asserting it over the whole track is FALSE.
    expect(Math.min(...r.track.map((p) => p.e))).toBeGreaterThan(-3 * R)
    // honest physics: the rejoin rolls out at the engine's intercept angle, but
    // from 2R off course that heading is tangent-side of the course under this
    // model — the aircraft is still on the nonholding side abeam the fix and has
    // moved further from it, not closer. Cross-track is signed toward the
    // holding side, so a divergent parallel leg reads negative and growing. The
    // rollout HEADING itself is pinned against the engine in
    // src/parallel-entry.invariants.test.ts.
    expect(r.inboundCrossTrackNm).toBeLessThan(-0.5)
  })

  // The former 'parallel reintercept sweeps more than 180°' test lived here. It
  // measured the sweep by the track's westward excursion, which measures the
  // DEFECT, not the sweep: only the wrong-way loop reaches past 2R. Do not
  // restore an excursion proxy here.
  //
  // A3 is asserted in two places instead, neither of them an excursion:
  //   * src/engine/entry.test.ts, 'A3: the parallel rejoin sweeps 225°, and an
  //     inverted rejoin would give 135°' — the heading algebra;
  //   * src/parallel-entry.invariants.test.ts, 'rejoin rotation sense matches
  //     entryGuidance turnToInbound for every course × pattern' — the ROTATION
  //     this integrator actually flies, measured by integrating the signed
  //     cross product of successive track segments. That is the faithful
  //     trajectory-level sweep, and it pins the sim against the oracle.
  //
  // That is a DIFFERENT failure mode from the one this file covers, not a
  // stronger version of it, so do not retire the goldens below as redundant.
  // Pinning the sim against the oracle cannot catch the oracle itself being
  // wrong: sim.ts derives its turn sign from `turnToInbound`, so flipping
  // entry.ts's parallel branch flips the sim with it and every oracle-derived
  // assertion stays green. The goldens here are anchored on RIGHT_NORTH /
  // LEFT_NORTH and a written-out side, which is exactly what does go red — and
  // the every-course version of that is the pattern-anchored A2 in
  // src/parallel-entry.invariants.test.ts.

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

  it('left-turn parallel mirrors: flies the east (non-holding) side', () => {
    const R = HOLD_TAS_KT / 3600 / ((TURN_RATE_DEG_PER_S * Math.PI) / 180) // ≈ 0.4775 NM
    const r = flyCircuit(LEFT_NORTH, decisions({ entry: 'parallel' }), CALM)
    expect(r.completed).toBe(true)
    for (const p of r.track) {
      expect(p.e).toBeGreaterThan(-0.01)
    }
    // cross-track is signed toward the holding side, so a nonholding-side
    // rollout is negative in both the standard and nonstandard case
    expect(r.inboundCrossTrackNm).toBeLessThan(-0.5)
    // mirror of the standard case: the excursion peaks at 1.3022 on the
    // straight intercept leg, inside 3R — the wrong-way rejoin reached 1.9099
    expect(Math.max(...r.track.map((p) => p.e))).toBeLessThan(3 * R)
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
