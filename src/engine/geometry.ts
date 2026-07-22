// Course math for the holding engine. All angles are magnetic degrees in
// [0, 360); 0 is north. Functions taking a course/heading/radial require it
// already normalized — normalizeDeg is the entry point for arbitrary numbers.

export type Cardinal = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

const CARDINALS: readonly Cardinal[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function normalizeDeg(deg: number): number {
  if (!Number.isFinite(deg)) {
    throw new RangeError(`degrees must be finite, got ${deg}`)
  }
  return ((deg % 360) + 360) % 360
}

function assertCourse(deg: number, name: string): void {
  if (!Number.isFinite(deg) || deg < 0 || deg >= 360) {
    throw new RangeError(`${name} must be in [0, 360), got ${deg}`)
  }
}

/** Signed shortest turn from one course to another: right positive, in (-180, 180]. */
export function angleDiff(from: number, to: number): number {
  assertCourse(from, 'from')
  assertCourse(to, 'to')
  const diff = normalizeDeg(to - from)
  if (diff > 180) {
    return diff - 360
  }
  return diff
}

export function reciprocal(course: number): number {
  assertCourse(course, 'course')
  return normalizeDeg(course + 180)
}

export function cardinalFromCourse(course: number): Cardinal {
  assertCourse(course, 'course')
  // course is in [0, 360), so the index is always 0..7
  return CARDINALS[Math.round(course / 45) % 8]!
}

export function courseFromCardinal(cardinal: Cardinal): number {
  const index = CARDINALS.indexOf(cardinal)
  if (index === -1) {
    throw new RangeError(`unknown cardinal: ${JSON.stringify(cardinal)}`)
  }
  return index * 45
}

/** A radial points FROM the fix; the inbound holding course points TO it. */
export function radialToInboundCourse(radial: number): number {
  assertCourse(radial, 'radial')
  return reciprocal(radial)
}
