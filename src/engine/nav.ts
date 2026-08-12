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
  // The course line runs BOTH ways from the fix, so the aircraft sits on it at
  // two headings, not one: the course itself (inbound, short of the fix) and
  // its reciprocal (outbound, past it). Either way the cross-track is exactly
  // zero, and stating that here is what an oracle is for — `Math.sin` cannot.
  // It returns +0 at 0 degrees, so the product is -0, which formats as "-0.0"
  // and compares unequal to 0 under Object.is; and 1.2246e-16 at 180 degrees,
  // so the outbound end came back a denormal NEGATIVE. Only the first was
  // handled, which left the second reading as a real displacement to the left
  // of the line: the HSI announced "deviation 0.0 dots right" over a bar it
  // drew dead centre, on roughly one shipping seed in 360.
  //
  // Exact comparisons, deliberately — no epsilon. Off the two ends the
  // cross-track is genuinely non-zero however small, and a tolerance here
  // would round a real displacement away.
  const onCourseLine = offCourse === 0 || Math.abs(offCourse) === 180
  return {
    crossTrackNm: onCourseLine ? 0 : -distanceNm * Math.sin(offCourse * DEG),
    sense: Math.abs(offCourse) < 90 ? 'to' : 'from',
  }
}
