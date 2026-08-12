import { describe, expect, it } from 'vitest'
import { courseText, distanceText } from './format'

// Display formatting is asserted here rather than only through the screens that
// use it: every consumer test that checks a rendered string calls these same
// functions to build its expectation, so nothing downstream can tell a wrong
// rule from a right one.

describe('courseText', () => {
  it('pads to three digits and shows 0 as 360', () => {
    expect(courseText(0)).toBe('360°')
    expect(courseText(5)).toBe('005°')
    expect(courseText(90)).toBe('090°')
    expect(courseText(359)).toBe('359°')
  })

  it('rounds to the nearest degree', () => {
    expect(courseText(129.6)).toBe('130°')
    expect(courseText(0.4)).toBe('360°') // rounds to 0, which reads as 360
  })
})

describe('distanceText', () => {
  it('shows one decimal and the unit', () => {
    expect(distanceText(12.4)).toBe('12.4 NM')
    expect(distanceText(3)).toBe('3.0 NM') // a whole number still carries the decimal
    expect(distanceText(0)).toBe('0.0 NM')
  })

  it('rounds to a tenth of a mile', () => {
    // Not a .x5 halfway case: 12.45 is 12.44999… in binary and rounds down,
    // so a golden written on the arithmetic rather than on the float would be
    // wrong about a rule that is not this function's.
    expect(distanceText(12.44)).toBe('12.4 NM')
    expect(distanceText(12.46)).toBe('12.5 NM')
  })

  // A negative distance is a caller bug, and the float that produces it does
  // not round away: `(-0.04).toFixed(1)` is "-0.0", which renders as a value
  // rather than as the mistake it is.
  it('rejects a negative or non-finite distance', () => {
    expect(() => distanceText(-0.04)).toThrow(RangeError)
    expect(() => distanceText(-8)).toThrow(RangeError)
    expect(() => distanceText(NaN)).toThrow(RangeError)
    expect(() => distanceText(Infinity)).toThrow(RangeError)
  })

  it('never renders a minus sign', () => {
    for (const nm of [0, 0.04, 1, 12.44, 99.99]) {
      expect(distanceText(nm), `${nm} NM`).not.toContain('-')
    }
  })
})
