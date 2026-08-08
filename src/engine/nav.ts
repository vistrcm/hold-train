// Nav-display geometry: what a course deviation indicator shows for an
// aircraft that has not yet reached the fix. Pure — no clamping, no pixels,
// no scale. Full-scale deflection and dot spacing are display decisions and
// live with the instrument that draws them.
//
// This module decides nothing about entries. AIM 5-3-8 j3 picks the entry
// sector from heading alone; deviation and distance are display state.

import { angleDiff, assertCourse } from './geometry'

const DEG = Math.PI / 180

export interface CourseDeviation {
  /** NM right of the selected course line (negative = left). */
  crossTrackNm: number
  /** TO when following the selected course from here closes on the fix. */
  sense: 'to' | 'from'
}

/**
 * Deviation from a selected course through the fix, for an aircraft `distanceNm`
 * from that fix.
 *
 * ASSUMES THE AIRCRAFT IS TRACKING DIRECT TO THE FIX — the signature does not
 * carry that. Position is reconstructed as "bearing heading+180 from the fix",
 * so both outputs are valid only while heading equals the bearing to the fix.
 * A vectored or wind-drifting aircraft is somewhere else entirely and would be
 * given a wrong side and a wrong flag, silently.
 *
 * Sign convention: positive crossTrackNm means the aircraft lies right of the
 * course line, looking along the direction of travel. Course 000 with the
 * aircraft due east of the fix is +D.
 *
 * The sense flips at exactly 90 degrees off course, where the aircraft is
 * abeam the fix and following the course neither closes nor opens: that
 * boundary is FROM.
 */
export function courseDeviation(
  heading: number,
  course: number,
  distanceNm: number,
): CourseDeviation {
  assertCourse(heading, 'heading')
  assertCourse(course, 'course')
  if (!Number.isFinite(distanceNm) || distanceNm <= 0) {
    // Zero is rejected with the negatives: over the fix the cross-track is 0
    // for every heading and the sense has no geometric meaning.
    throw new RangeError(`distance to the fix must be positive NM, got ${distanceNm}`)
  }
  const offCourse = angleDiff(course, heading)
  const crossTrackNm = -distanceNm * Math.sin(offCourse * DEG)
  return {
    // Math.sin(0) is +0, so on course the product is -0, which formats as
    // "-0.0" and compares unequal to 0 under Object.is.
    crossTrackNm: crossTrackNm === 0 ? 0 : crossTrackNm,
    sense: Math.abs(offCourse) < 90 ? 'to' : 'from',
  }
}
