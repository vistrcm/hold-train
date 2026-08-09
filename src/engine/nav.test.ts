import { describe, it, expect } from 'vitest'
import { normalizeDeg } from './geometry'
import { courseDeviation } from './nav'

// Every golden below was derived by DRAWING the picture first, then written
// down — never read back out of courseDeviation. The drawing convention:
//
//   fix at the origin, north up, east right.
//   The aircraft tracks direct to the fix, so it sits at bearing heading+180
//   from the fix, D NM out.
//   "right of course" = the side 90 degrees right of the selected course
//   direction of travel (course 090 eastbound -> right is SOUTH).
//   TO = following the selected course from the aircraft's position closes on
//   the fix; FROM = it does not.

describe('courseDeviation goldens', () => {
  it('heading = course: on the course line, inbound (TO)', () => {
    // Course 090 east. Heading 090 means the fix is due east of the aircraft,
    // so the aircraft sits ON the eastbound line through the fix, west of it.
    // Flying 090 from there arrives at the fix.
    const d = courseDeviation(90, 90, 10)
    expect(d.crossTrackNm).toBe(0)
    expect(d.sense).toBe('to')
  })

  it('heading = course + 90: aircraft LEFT of course, FROM at the exact tie-break', () => {
    // Course 000 north. Heading 090 means the fix is due east of the aircraft,
    // so the aircraft sits due WEST of the fix, D NM out. West is LEFT of a
    // northbound course -> xtk = -D. Flying 000 from a point due west of the
    // fix runs parallel past it and never closes: FROM, at exactly 90 degrees.
    const d = courseDeviation(90, 0, 10)
    expect(d.crossTrackNm).toBeCloseTo(-10, 10)
    expect(d.sense).toBe('from')
  })

  it('heading = course - 90: aircraft RIGHT of course', () => {
    // Course 000 north. Heading 270 means the fix is due west of the aircraft,
    // so the aircraft sits due EAST of the fix. East is RIGHT of a northbound
    // course -> xtk = +D. Abeam again, so FROM.
    const d = courseDeviation(270, 0, 10)
    expect(d.crossTrackNm).toBeCloseTo(10, 10)
    expect(d.sense).toBe('from')
  })

  it('heading = course + 180: on the course line, outbound (FROM)', () => {
    // Course 090 east. Heading 270 means the fix is due west of the aircraft,
    // so the aircraft sits ON the eastbound line, EAST of the fix. Flying 090
    // from there goes away from the fix.
    const d = courseDeviation(270, 90, 10)
    // ⚠️ `toBe`, not `toBeCloseTo`, and that is the whole assertion: ON the line
    // means the cross-track is zero, not nearly zero. This golden read
    // `toBeCloseTo(0, 10)` while its `heading = course` twin above read `toBe(0)`
    // — the same geometric claim pinned exactly at one end of the line and
    // loosely at the other — and the slack hid a real defect. `Math.sin(PI)` is
    // 1.2e-16, so this end returned a denormal NEGATIVE, which the HSI's
    // `deviationText` read as a side: "deviation 0.0 dots right" announced over
    // a bar it drew dead centre, on ~1 shipping seed in 360.
    expect(d.crossTrackNm).toBe(0)
    expect(d.sense).toBe('from')
  })

  // The two goldens above are the two ends of one line, and a guard that names
  // only the two of them proves nothing about the third reciprocal pair. Swept
  // rather than sampled, because the defect was a property of Math.sin at 180
  // and not of any one course.
  it('is exactly zero at BOTH ends of the course line, for every course', () => {
    for (let course = 0; course < 360; course += 1) {
      const inbound = courseDeviation(course, course, 10)
      const outbound = courseDeviation(normalizeDeg(course + 180), course, 10)
      expect(Object.is(inbound.crossTrackNm, 0), `course ${course} inbound`).toBe(true)
      expect(Object.is(outbound.crossTrackNm, 0), `course ${course} outbound`).toBe(true)
      // Object.is, so -0 fails too: it formats as "-0.0" and a readout saying
      // minus zero miles off course looks like a value, the same trap
      // `distanceText` throws on.
      expect(inbound.sense).toBe('to')
      expect(outbound.sense).toBe('from')
    }
  })

  // One case per quadrant of (heading - course), all on course 090 east at
  // D = 10 NM, so every cross-track is 10 * sin(30) = 5 NM exactly by hand.
  // Right of an eastbound course is SOUTH; the fix is east of the aircraft
  // when the aircraft is west of it.

  it('quadrant 1 (heading 30 right of course): LEFT of course, TO', () => {
    // Heading 120 -> the fix bears 120 from the aircraft, so the aircraft sits
    // at bearing 300 from the fix: NORTHWEST. North of an eastbound course is
    // LEFT -> xtk = -5. West of the fix, course points east -> TO.
    const d = courseDeviation(120, 90, 10)
    expect(d.crossTrackNm).toBeCloseTo(-5, 10)
    expect(d.sense).toBe('to')
  })

  it('quadrant 2 (heading 150 right of course): LEFT of course, FROM', () => {
    // Heading 240 -> the aircraft sits at bearing 060 from the fix:
    // NORTHEAST. North is LEFT of eastbound -> xtk = -5. Already east of the
    // fix, so flying 090 leaves it behind -> FROM.
    const d = courseDeviation(240, 90, 10)
    expect(d.crossTrackNm).toBeCloseTo(-5, 10)
    expect(d.sense).toBe('from')
  })

  it('quadrant 3 (heading 150 left of course): RIGHT of course, FROM', () => {
    // Heading 300 -> the aircraft sits at bearing 120 from the fix:
    // SOUTHEAST. South is RIGHT of eastbound -> xtk = +5. East of the fix
    // -> FROM.
    const d = courseDeviation(300, 90, 10)
    expect(d.crossTrackNm).toBeCloseTo(5, 10)
    expect(d.sense).toBe('from')
  })

  it('quadrant 4 (heading 30 left of course): RIGHT of course, TO', () => {
    // Heading 060 -> the aircraft sits at bearing 240 from the fix:
    // SOUTHWEST. South is RIGHT of eastbound -> xtk = +5. West of the fix
    // -> TO.
    const d = courseDeviation(60, 90, 10)
    expect(d.crossTrackNm).toBeCloseTo(5, 10)
    expect(d.sense).toBe('to')
  })

  it('scales with distance: same angle twice as far is twice as far off course', () => {
    // Course 000 north, heading 030: the aircraft sits at bearing 210 from the
    // fix (SOUTHWEST). West is LEFT of a northbound course, and the offset is
    // D * sin(30) = half the distance out.
    expect(courseDeviation(30, 0, 8).crossTrackNm).toBeCloseTo(-4, 10)
    expect(courseDeviation(30, 0, 16).crossTrackNm).toBeCloseTo(-8, 10)
  })

  it('is measured across north without a discontinuity', () => {
    // Course 350, heading 020: 30 degrees right of course, so by the quadrant-1
    // picture the aircraft is LEFT of the course line at D * sin(30).
    expect(courseDeviation(20, 350, 10).crossTrackNm).toBeCloseTo(-5, 10)
    expect(courseDeviation(20, 350, 10).sense).toBe('to')
  })
})

describe('courseDeviation properties', () => {
  it('never reports more cross-track than the distance to the fix', () => {
    for (let heading = 0; heading < 360; heading += 1) {
      for (const course of [0, 37, 180, 359]) {
        const { crossTrackNm } = courseDeviation(heading, course, 12)
        expect(Math.abs(crossTrackNm)).toBeLessThanOrEqual(12 + 1e-9)
      }
    }
  })

  it('mirroring the heading about the course flips the cross-track and keeps the sense', () => {
    const course = 130
    for (let heading = 0; heading < 360; heading += 1) {
      const mirrored = normalizeDeg(2 * course - heading)
      const direct = courseDeviation(heading, course, 9)
      const flipped = courseDeviation(mirrored, course, 9)
      expect(flipped.crossTrackNm).toBeCloseTo(-direct.crossTrackNm, 10)
      expect(flipped.sense).toBe(direct.sense)
    }
  })

  it('reports TO for exactly the open semicircle within 90 degrees of the course', () => {
    const course = 215
    for (let off = -179; off <= 180; off += 1) {
      const heading = normalizeDeg(course + off)
      const expected = Math.abs(off) < 90 ? 'to' : 'from'
      expect(courseDeviation(heading, course, 6).sense).toBe(expected)
    }
  })

  it('puts the aircraft left of course whenever its heading is right of course', () => {
    // Generalises the quadrant-1 and quadrant-2 goldens: a heading right of
    // course means the fix bears right of the course line from the aircraft,
    // which puts the aircraft itself on the LEFT of that line, and mirrored.
    const course = 75
    for (let off = 1; off < 180; off += 1) {
      expect(courseDeviation(normalizeDeg(course + off), course, 5).crossTrackNm).toBeLessThan(0)
      expect(courseDeviation(normalizeDeg(course - off), course, 5).crossTrackNm).toBeGreaterThan(0)
    }
  })
})

describe('courseDeviation validation', () => {
  it('rejects headings outside [0, 360)', () => {
    expect(() => courseDeviation(360, 90, 10)).toThrow(RangeError)
    expect(() => courseDeviation(-1, 90, 10)).toThrow(RangeError)
    expect(() => courseDeviation(NaN, 90, 10)).toThrow(RangeError)
    expect(() => courseDeviation(Infinity, 90, 10)).toThrow(RangeError)
  })

  it('rejects courses outside [0, 360)', () => {
    expect(() => courseDeviation(90, 360, 10)).toThrow(RangeError)
    expect(() => courseDeviation(90, -0.5, 10)).toThrow(RangeError)
    expect(() => courseDeviation(90, NaN, 10)).toThrow(RangeError)
    expect(() => courseDeviation(90, -Infinity, 10)).toThrow(RangeError)
  })

  it('rejects negative and non-finite distances', () => {
    expect(() => courseDeviation(90, 90, -1)).toThrow(RangeError)
    expect(() => courseDeviation(90, 90, NaN)).toThrow(RangeError)
    expect(() => courseDeviation(90, 90, Infinity)).toThrow(RangeError)
  })

  it('rejects zero distance: over the fix there is no geometry to report', () => {
    // At D = 0 the aircraft is AT the fix: the cross-track is 0 for every
    // heading and the sense reduces to comparing two angles, which is not a
    // nav picture. Callers must not depict it, so the oracle refuses it.
    expect(() => courseDeviation(90, 90, 0)).toThrow(RangeError)
  })
})
