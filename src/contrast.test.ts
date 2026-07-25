import { describe, it, expect } from 'vitest'
import { blend, contrastRatio } from './contrast'

// Reference pairs are hand-checkable against the WCAG definition, because every
// palette assertion in styles.test.ts and ui/palette.test.ts is only as
// trustworthy as this function. A wrong constant here would let the whole light
// theme ship unreadable with a green suite.
describe('contrastRatio', () => {
  it('reports 21:1 for black against white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10)
  })

  it('reports 1:1 for a colour against itself', () => {
    expect(contrastRatio('#4d5762', '#4d5762')).toBeCloseTo(1, 10)
  })

  it('is symmetric — argument order does not matter', () => {
    // The spec divides lighter by darker, so the caller never has to know which
    // of the two is the background.
    const forward = contrastRatio('#0b57b8', '#ffffff')
    // Anchor: comparing the function against itself would also hold for a
    // constant, so pin the pair to a real ratio (accent on white, per the plan).
    expect(forward).toBeGreaterThan(6)
    expect(contrastRatio('#ffffff', '#0b57b8')).toBeCloseTo(forward, 10)
  })

  // Black/white passes for ANY transform with f(0)=0 and f(1)=1, so it cannot
  // catch a wrong gamma exponent or breakpoint. #767676 is the lightest grey
  // that still clears 4.5:1 on white; its ratio moves if either constant is
  // wrong.
  it('linearizes mid-tones per the sRGB gamma curve', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.542, 2)
  })

  // Channels below the 0.03928 breakpoint take the linear /12.92 branch. #010101
  // (0.00392) is on that branch: L = 0.00392/12.92 = 0.0003036, so the ratio is
  // 1.05 / 0.0503036. The gamma branch would give a different number.
  it('uses the linear branch for very dark channels', () => {
    expect(contrastRatio('#010101', '#ffffff')).toBeCloseTo(20.87, 2)
  })

  it('parses 3-digit shorthand the same as its 6-digit form', () => {
    // Each digit doubles: #abc is #aabbcc, not #a0b0c0.
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 10)
    expect(contrastRatio('#abc', '#ffffff')).toBeCloseTo(
      contrastRatio('#aabbcc', '#ffffff'),
      10,
    )
  })

  it('returns the unrounded ratio', () => {
    // WCAG SC 1.4.3 is stated as "at least 4.5:1" and the Understanding doc
    // forbids rounding a computed value up to the threshold, so callers must be
    // able to see 4.4999.
    // #777777 on white computes to 4.478 — one step lighter than the #767676
    // above, and the first grey that fails. It must not surface as 4.5.
    const ratio = contrastRatio('#777777', '#ffffff')
    expect(ratio).toBeLessThan(4.5)
    expect(ratio).toBeGreaterThan(4.4)
  })

  it.each(['#12345', 'ffffff', '#gggggg', '', '#ffffffff', 'white'])(
    'throws on invalid hex %j',
    (bad) => {
      // Throwing beats returning NaN: a typo in a palette test would otherwise
      // silently compare against NaN, and every `>= 4.5` assertion on NaN fails
      // in a way that points at the palette instead of the typo.
      expect(() => contrastRatio(bad, '#ffffff')).toThrow()
      expect(() => contrastRatio('#ffffff', bad)).toThrow()
    },
  )
})

// A translucent SVG mark is not the colour it is drawn with, and WCAG ratios are
// defined between opaque colours — so the overlays have to be composited before
// they can be measured. Every expected value here is hand-computable, because
// `ui/palette.test.ts` trusts this to tell it what the eye actually receives.
describe('blend', () => {
  it('returns the background at alpha 0 and the foreground at alpha 1', () => {
    expect(blend('#15703f', '#ffffff', 0)).toBe('#ffffff')
    expect(blend('#15703f', '#ffffff', 1)).toBe('#15703f')
  })

  it('composites in sRGB, per channel', () => {
    // 0x00·0.5 + 0xff·0.5 = 127.5, which rounds to 128 = 0x80.
    expect(blend('#000000', '#ffffff', 0.5)).toBe('#808080')
    // Channels move independently: red stays, green and blue halve.
    expect(blend('#ff0000', '#ffffff', 0.5)).toBe('#ff8080')
  })

  it('pads a channel that composites below 0x10', () => {
    // 0xff·0.05 = 12.75 -> 13 = 0x0d. Without the pad each channel emits one
    // character and the result is a 3-char string that is not a colour at all.
    expect(blend('#ffffff', '#000000', 0.05)).toBe('#0d0d0d')
  })

  it('accepts shorthand on either side', () => {
    expect(blend('#000', '#fff', 0.5)).toBe(blend('#000000', '#ffffff', 0.5))
  })

  it.each([-0.01, 1.01, Number.NaN])('rejects an alpha outside [0, 1]: %j', (bad) => {
    // An out-of-range alpha would extrapolate past the endpoints and produce a
    // colour that renders nowhere — better to name it than to measure it.
    expect(() => blend('#000000', '#ffffff', bad)).toThrow(RangeError)
  })

  it('rejects a malformed colour the same way contrastRatio does', () => {
    expect(() => blend('white', '#ffffff', 0.5)).toThrow()
    expect(() => blend('#ffffff', 'white', 0.5)).toThrow()
  })
})
