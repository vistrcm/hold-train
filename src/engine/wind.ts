// Wind correction and timing for holding, per AIM 5-3-8 (verified verbatim
// against the current AIM fetched from faa.gov):
//   j8 — compensate for wind primarily by drift correction; outbound, triple
//        the inbound drift correction (left 8° inbound → right 24° outbound).
//   j4 — inbound leg 1 minute at or below 14,000 ft MSL (1½ above); adjust
//        subsequent outbound legs to achieve the proper inbound time.
//   j5 — DME/GPS ATD holding: leg lengths in NM; the end of the outbound leg
//        is determined by the DME or ATD readout.
//
// Crab angles are signed degrees: positive = crab right of course.
// The exact 1-minute-inbound outbound time is computed from ground speeds;
// the field "~1 s/kt" rule of thumb is an approximation of this math, not
// an AIM rule.

import { angleDiff, normalizeDeg, reciprocal } from './geometry'

export interface Wind {
  /** Direction the wind blows FROM, degrees magnetic in [0, 360). */
  directionFrom: number
  speedKt: number
}

export const WIND_SOURCE =
  'AIM 5-3-8 j8(c) (drift correction; triple the inbound correction outbound)'
export const TIMING_SOURCE =
  'AIM 5-3-8 j4 (1-minute inbound at/below 14,000 ft MSL; adjust outbound to achieve it)'
export const DME_SOURCE = 'AIM 5-3-8 j5 (end of outbound leg by DME/ATD readout)'

const DEG = Math.PI / 180

function assertWind(wind: Wind, tasKt: number): void {
  if (!Number.isFinite(tasKt) || tasKt <= 0) {
    throw new RangeError(`TAS must be positive, got ${tasKt}`)
  }
  if (!Number.isFinite(wind.speedKt) || wind.speedKt < 0) {
    throw new RangeError(`wind speed must be non-negative, got ${wind.speedKt}`)
  }
  if (wind.speedKt >= tasKt) {
    throw new RangeError(`wind ${wind.speedKt} kt at or above TAS ${tasKt} kt — cannot hold`)
  }
}

/** Wind components relative to a course: headwind opposes travel along it. */
function components(course: number, wind: Wind): { headwindKt: number; crosswindKt: number } {
  // angleDiff validates both angles are in [0, 360).
  const relative = angleDiff(course, wind.directionFrom)
  return {
    headwindKt: wind.speedKt * Math.cos(relative * DEG),
    crosswindKt: wind.speedKt * Math.sin(relative * DEG),
  }
}

/**
 * Crab angle to track the inbound course, signed degrees (positive = right).
 * Wind from the right of the course requires a right crab.
 */
export function inboundCrab(inboundCourse: number, wind: Wind, tasKt: number): number {
  assertWind(wind, tasKt)
  const { crosswindKt } = components(inboundCourse, wind)
  return Math.asin(crosswindKt / tasKt) / DEG
}

/**
 * Outbound heading using the AIM triple-drift technique: the single-drift
 * outbound correction is the exact negation of the inbound crab (same wind,
 * reciprocal course), tripled per AIM 5-3-8 j8(c).
 */
export function outboundHeading(inboundCourse: number, wind: Wind, tasKt: number): number {
  const crab = inboundCrab(inboundCourse, wind, tasKt)
  return normalizeDeg(reciprocal(inboundCourse) - 3 * crab)
}

/**
 * Crab-corrected ground speeds along the holding course on each leg. The same
 * crosswind magnitude applies both ways, so the airspeed component along the
 * course (alongKt) is shared; headwind subtracts inbound and adds outbound.
 */
export function groundSpeeds(
  inboundCourse: number,
  wind: Wind,
  tasKt: number,
): { inboundKt: number; outboundKt: number } {
  assertWind(wind, tasKt)
  const { headwindKt, crosswindKt } = components(inboundCourse, wind)
  const alongKt = Math.sqrt(tasKt * tasKt - crosswindKt * crosswindKt)
  return { inboundKt: alongKt - headwindKt, outboundKt: alongKt + headwindKt }
}

/**
 * Outbound leg time that yields the target inbound time (default 60 s,
 * AIM 5-3-8 j4 at/below 14,000 ft MSL), from the wind-triangle ground
 * speeds on each leg: t_out = target · GS_inbound / GS_outbound.
 */
export function outboundTimeSeconds(
  inboundCourse: number,
  wind: Wind,
  tasKt: number,
  targetInboundSeconds = 60,
): number {
  if (!Number.isFinite(targetInboundSeconds) || targetInboundSeconds <= 0) {
    throw new RangeError(`target inbound seconds must be positive, got ${targetInboundSeconds}`)
  }
  const { inboundKt, outboundKt } = groundSpeeds(inboundCourse, wind, tasKt)
  return (targetInboundSeconds * inboundKt) / outboundKt
}

/**
 * DME/ATD readout at which the outbound leg ends (AIM 5-3-8 j5 figures:
 * inbound toward the NAVAID, fix 10 DME + 5 NM legs → 15 DME; inbound away,
 * fix 28 DME + 8 NM legs → 20 DME).
 */
export function dmeOutboundEnd(
  fixDistanceNm: number,
  legNm: number,
  inbound: 'toward' | 'away',
): number {
  if (!Number.isFinite(fixDistanceNm) || fixDistanceNm <= 0) {
    throw new RangeError(`fix distance must be positive, got ${fixDistanceNm}`)
  }
  if (!Number.isFinite(legNm) || legNm <= 0) {
    throw new RangeError(`leg length must be positive, got ${legNm}`)
  }
  if (inbound === 'toward') {
    return fixDistanceNm + legNm
  }
  if (legNm >= fixDistanceNm) {
    throw new RangeError(
      `${legNm} NM legs inbound-away from a fix at ${fixDistanceNm} DME would cross the station`,
    )
  }
  return fixDistanceNm - legNm
}
