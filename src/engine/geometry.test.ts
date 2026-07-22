import { describe, it, expect } from 'vitest'
import {
  normalizeDeg,
  angleDiff,
  reciprocal,
  cardinalFromCourse,
  courseFromCardinal,
  radialToInboundCourse,
  type Cardinal,
} from './geometry'

describe('normalizeDeg', () => {
  it('leaves values already in [0, 360) unchanged', () => {
    expect(normalizeDeg(0)).toBe(0)
    expect(normalizeDeg(340)).toBe(340)
    expect(normalizeDeg(359.5)).toBe(359.5)
  })

  it('wraps 360 to 0', () => {
    expect(normalizeDeg(360)).toBe(0)
  })

  it('wraps values above 360', () => {
    expect(normalizeDeg(370)).toBe(10)
    expect(normalizeDeg(720)).toBe(0)
    expect(normalizeDeg(725)).toBe(5)
  })

  it('wraps negative values into [0, 360)', () => {
    expect(normalizeDeg(-10)).toBe(350)
    expect(normalizeDeg(-360)).toBe(0)
    expect(normalizeDeg(-725)).toBe(355)
  })

  it('rejects non-finite input', () => {
    expect(() => normalizeDeg(NaN)).toThrow(RangeError)
    expect(() => normalizeDeg(Infinity)).toThrow(RangeError)
    expect(() => normalizeDeg(-Infinity)).toThrow(RangeError)
  })
})

describe('angleDiff', () => {
  it('returns signed shortest turn from one course to another', () => {
    expect(angleDiff(0, 90)).toBe(90) // right turn positive
    expect(angleDiff(90, 0)).toBe(-90) // left turn negative
    expect(angleDiff(340, 20)).toBe(40) // across north, right
    expect(angleDiff(20, 340)).toBe(-40) // across north, left
  })

  it('returns 0 for identical courses', () => {
    expect(angleDiff(160, 160)).toBe(0)
  })

  it('returns +180 for exact reciprocals (never -180)', () => {
    expect(angleDiff(0, 180)).toBe(180)
    expect(angleDiff(270, 90)).toBe(180)
  })

  it('rejects non-finite and out-of-range courses', () => {
    expect(() => angleDiff(NaN, 90)).toThrow(RangeError)
    expect(() => angleDiff(90, NaN)).toThrow(RangeError)
    expect(() => angleDiff(360, 90)).toThrow(RangeError)
    expect(() => angleDiff(90, -1)).toThrow(RangeError)
  })
})

describe('reciprocal', () => {
  it('returns the opposite course', () => {
    expect(reciprocal(0)).toBe(180)
    expect(reciprocal(180)).toBe(0)
    expect(reciprocal(340)).toBe(160)
    expect(reciprocal(90)).toBe(270)
  })

  it('rejects non-finite and out-of-range courses', () => {
    expect(() => reciprocal(NaN)).toThrow(RangeError)
    expect(() => reciprocal(360)).toThrow(RangeError)
    expect(() => reciprocal(-0.5)).toThrow(RangeError)
  })
})

describe('cardinalFromCourse', () => {
  it('maps the eight cardinal centers exactly', () => {
    expect(cardinalFromCourse(0)).toBe('N')
    expect(cardinalFromCourse(45)).toBe('NE')
    expect(cardinalFromCourse(90)).toBe('E')
    expect(cardinalFromCourse(135)).toBe('SE')
    expect(cardinalFromCourse(180)).toBe('S')
    expect(cardinalFromCourse(225)).toBe('SW')
    expect(cardinalFromCourse(270)).toBe('W')
    expect(cardinalFromCourse(315)).toBe('NW')
  })

  it('maps off-center courses to the nearest cardinal (45-degree sectors)', () => {
    expect(cardinalFromCourse(10)).toBe('N')
    expect(cardinalFromCourse(30)).toBe('NE')
    expect(cardinalFromCourse(160)).toBe('S')
    expect(cardinalFromCourse(340)).toBe('N')
    expect(cardinalFromCourse(203)).toBe('SW')
  })

  it('rejects non-finite and out-of-range courses', () => {
    expect(() => cardinalFromCourse(NaN)).toThrow(RangeError)
    expect(() => cardinalFromCourse(360)).toThrow(RangeError)
    expect(() => cardinalFromCourse(-10)).toThrow(RangeError)
  })
})

describe('courseFromCardinal', () => {
  it('maps each cardinal to its center course', () => {
    const cases: Array<[Cardinal, number]> = [
      ['N', 0],
      ['NE', 45],
      ['E', 90],
      ['SE', 135],
      ['S', 180],
      ['SW', 225],
      ['W', 270],
      ['NW', 315],
    ]
    for (const [cardinal, course] of cases) {
      expect(courseFromCardinal(cardinal)).toBe(course)
    }
  })

  it('round-trips through cardinalFromCourse', () => {
    const cardinals: Cardinal[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    for (const c of cardinals) {
      expect(cardinalFromCourse(courseFromCardinal(c))).toBe(c)
    }
  })

  it('rejects unknown cardinal strings', () => {
    expect(() => courseFromCardinal('NNE' as Cardinal)).toThrow(RangeError)
    expect(() => courseFromCardinal('' as Cardinal)).toThrow(RangeError)
    expect(() => courseFromCardinal('north' as Cardinal)).toThrow(RangeError)
  })
})

describe('radialToInboundCourse', () => {
  it('radial 160 FROM the fix means inbound course 340 TO the fix', () => {
    expect(radialToInboundCourse(160)).toBe(340)
  })

  it('is the reciprocal for all radials', () => {
    expect(radialToInboundCourse(0)).toBe(180)
    expect(radialToInboundCourse(90)).toBe(270)
    expect(radialToInboundCourse(270)).toBe(90)
    expect(radialToInboundCourse(359)).toBe(179)
  })

  it('rejects non-finite and out-of-range radials', () => {
    expect(() => radialToInboundCourse(NaN)).toThrow(RangeError)
    expect(() => radialToInboundCourse(360)).toThrow(RangeError)
    expect(() => radialToInboundCourse(-160)).toThrow(RangeError)
  })
})
