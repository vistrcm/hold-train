// Decision sim for the Wind & Timing Lab: a fixed-timestep point-mass
// integrator that flies one holding circuit from the pilot's decisions —
// entry shape, outbound heading, inbound crab, outbound seconds — at constant
// TAS through steady wind with standard-rate turns, and returns the ground
// track for debrief.
//
// It deliberately models decisions, not aircraft dynamics (no roll-in, no
// speed changes): the training target is the pilot's numbers, per AIM 5-3-8
// j8 (drift correction) and j4 (adjust outbound legs for the 1-minute
// inbound). The circuit starts at the fix heading the inbound course; the
// entry choice sets the turn directions (parallel turns onto outbound against
// the pattern, then reintercepts with it through more than 180° per AIM 5-3-8
// j3(a)), the decisions set everything else. The inbound leg is flown
// straight on the rollout heading until crossing the line abeam the fix, so
// the debrief can report honest timing and cross-track — including a
// teardrop that does not re-intercept by itself.
//
// Frame: NM east/north of the holding fix (the map view's MapPoint shape).

import type { Entry, TurnDirection } from './entry'
import { assertCourse, normalizeDeg } from './geometry'
import { inboundCrab, outboundHeading, outboundTimeSeconds, type Wind } from './wind'

/** C172 holding speed the lab trains at. */
export const HOLD_TAS_KT = 90
/** Standard-rate turn. */
export const TURN_RATE_DEG_PER_S = 3
/** Integrator hard stop — an unclosable circuit reports instead of hanging. */
export const MAX_SIM_SECONDS = 900

const DT = 0.1 // s per integration step
// Angle the parallel entry's reintercept turn rolls out on, measured into the
// inbound course. Any positive angle makes the pattern-direction turn exceed
// 180° as AIM 5-3-8 j3(a) requires; 30° matches the teardrop offset the same
// paragraph specifies, so the two entries roll out on the same intercept.
const PARALLEL_INTERCEPT_DEG = 30
const SAMPLE_SECONDS = 1 // ground-track sampling interval
/** Longest outbound leg flyCircuit will accept. Callers that *suggest* a leg
 *  time must clamp to this, or they hand the pilot a number the sim rejects. */
export const MAX_OUTBOUND_SECONDS = 600
const MAX_CRAB_DEG = 45
const DEG = Math.PI / 180

/** Position in NM east/north of the holding fix. */
export interface SimPoint {
  e: number
  n: number
}

/** The slice of a hold the sim needs; a full HoldSpec satisfies it. */
export interface SimHold {
  /** Inbound holding course TO the fix, degrees magnetic in [0, 360). */
  inboundCourse: number
  turnDirection: TurnDirection
}

/** The pilot's numbers for one circuit. */
export interface SimDecisions {
  entry: Entry
  /** Heading flown outbound, degrees magnetic in [0, 360). */
  outboundHeading: number
  /** Inbound crab, signed degrees: positive = crab right of course. */
  inboundCrab: number
  outboundSeconds: number
}

export interface SimResult {
  /** Ground track sampled ~1/s, oldest first, starting at the fix. */
  track: SimPoint[]
  /** Wings-level rollout → crossing the line abeam the fix. */
  inboundSeconds: number
  totalSeconds: number
  /** Signed cross-track at the abeam crossing, NM; positive = holding side. */
  inboundCrossTrackNm: number
  /** False if the inbound leg never reached the fix within MAX_SIM_SECONDS. */
  completed: boolean
}

/**
 * The AIM-rule circuit for this hold and wind: direct (established) pattern,
 * triple-drift outbound heading, ratio-timed outbound leg. The wind engine is
 * the oracle — the lab's ghost track and grading targets both come from here.
 */
export function textbookDecisions(hold: SimHold, wind: Wind, tasKt = HOLD_TAS_KT): SimDecisions {
  return {
    entry: 'direct',
    outboundHeading: outboundHeading(hold.inboundCourse, wind, tasKt),
    inboundCrab: inboundCrab(hold.inboundCourse, wind, tasKt),
    outboundSeconds: outboundTimeSeconds(hold.inboundCourse, wind, tasKt),
  }
}

function assertDecisions(d: SimDecisions): void {
  assertCourse(d.outboundHeading, 'outboundHeading')
  if (!Number.isFinite(d.inboundCrab) || Math.abs(d.inboundCrab) > MAX_CRAB_DEG) {
    throw new RangeError(`inboundCrab must be within ±${MAX_CRAB_DEG}°, got ${d.inboundCrab}`)
  }
  if (
    !Number.isFinite(d.outboundSeconds) ||
    d.outboundSeconds <= 0 ||
    d.outboundSeconds > MAX_OUTBOUND_SECONDS
  ) {
    throw new RangeError(
      `outboundSeconds must be in (0, ${MAX_OUTBOUND_SECONDS}], got ${d.outboundSeconds}`,
    )
  }
}

function assertWind(wind: Wind, tasKt: number): void {
  assertCourse(wind.directionFrom, 'wind directionFrom')
  if (!Number.isFinite(wind.speedKt) || wind.speedKt < 0) {
    throw new RangeError(`wind speed must be non-negative, got ${wind.speedKt}`)
  }
  if (wind.speedKt >= tasKt) {
    throw new RangeError(`wind ${wind.speedKt} kt at or above TAS ${tasKt} kt — cannot hold`)
  }
}

/** Degrees to turn from one heading to another going only in direction s. */
function turnAmount(from: number, to: number, s: 1 | -1): number {
  return s === 1 ? normalizeDeg(to - from) : normalizeDeg(from - to)
}

export function flyCircuit(
  hold: SimHold,
  decisions: SimDecisions,
  wind: Wind,
  tasKt = HOLD_TAS_KT,
): SimResult {
  assertCourse(hold.inboundCourse, 'inboundCourse')
  assertDecisions(decisions)
  if (!Number.isFinite(tasKt) || tasKt <= 0) {
    throw new RangeError(`TAS must be positive, got ${tasKt}`)
  }
  assertWind(wind, tasKt)

  const c = hold.inboundCourse
  const pattern: 1 | -1 = hold.turnDirection === 'right' ? 1 : -1
  const isParallel = decisions.entry === 'parallel'
  // AIM 5-3-8 j3(a). The parallel entry's two turns oppose each other: the turn
  // onto the outbound heading is made toward the non-holding side (against the
  // pattern), and the reintercept is "in the direction of the holding pattern
  // through more than 180 degrees". Direct and teardrop turn with the pattern
  // throughout.
  const outboundTurnSign: 1 | -1 = isParallel ? (pattern === 1 ? -1 : 1) : pattern
  const reinterceptTurnSign: 1 | -1 = pattern
  // Parallel rolls out on an intercept heading angled back into the course, not
  // on the inbound heading itself — turning to the inbound heading would be
  // exactly 180°, which rolls out parallel to the course and never intercepts.
  const rolloutHeading = normalizeDeg(
    c + (isParallel ? PARALLEL_INTERCEPT_DEG * pattern : 0) + decisions.inboundCrab,
  )

  // integrator state
  const pos: SimPoint = { e: 0, n: 0 }
  let heading = c
  let t = 0
  let sampledAt = 0
  const track: SimPoint[] = [{ e: 0, n: 0 }]

  const windToRad = normalizeDeg(wind.directionFrom + 180) * DEG
  const windE = (wind.speedKt / 3600) * Math.sin(windToRad)
  const windN = (wind.speedKt / 3600) * Math.cos(windToRad)

  function step(dt: number, turnDegPerS: number): void {
    pos.e += ((tasKt / 3600) * Math.sin(heading * DEG) + windE) * dt
    pos.n += ((tasKt / 3600) * Math.cos(heading * DEG) + windN) * dt
    heading = normalizeDeg(heading + turnDegPerS * dt)
    t += dt
    if (t - sampledAt >= SAMPLE_SECONDS - 1e-9) {
      track.push({ e: pos.e, n: pos.n })
      sampledAt = t
    }
  }

  function turnTo(target: number, s: 1 | -1): void {
    let remaining = turnAmount(heading, target, s)
    while (remaining > 1e-9) {
      const dt = Math.min(DT, remaining / TURN_RATE_DEG_PER_S)
      step(dt, s * TURN_RATE_DEG_PER_S)
      remaining -= TURN_RATE_DEG_PER_S * dt
    }
    heading = target // absorb float rounding from the partial last step
  }

  function flyStraight(seconds: number): void {
    let remaining = seconds
    while (remaining > 1e-9) {
      const dt = Math.min(DT, remaining)
      step(dt, 0)
      remaining -= dt
    }
  }

  // 1: turn from the inbound course heading to the decided outbound heading
  turnTo(decisions.outboundHeading, outboundTurnSign)
  // 2: outbound leg
  flyStraight(decisions.outboundSeconds)
  // 3: turn to the crab-corrected inbound heading (parallel: to the intercept
  // heading, through more than 180°)
  turnTo(rolloutHeading, reinterceptTurnSign)

  // 4: fly straight until crossing the line abeam the fix
  const alongE = Math.sin(c * DEG)
  const alongN = Math.cos(c * DEG)
  const inboundStart = t
  let completed = false
  while (t < MAX_SIM_SECONDS) {
    step(DT, 0)
    if (pos.e * alongE + pos.n * alongN >= 0) {
      completed = true
      break
    }
  }

  track.push({ e: pos.e, n: pos.n })
  // cross-track: positive toward the holding side (90° pattern-ward of course)
  const holdingRad = normalizeDeg(c + 90 * pattern) * DEG
  return {
    track,
    inboundSeconds: t - inboundStart,
    totalSeconds: t,
    inboundCrossTrackNm: pos.e * Math.sin(holdingRad) + pos.n * Math.cos(holdingRad),
    completed,
  }
}
