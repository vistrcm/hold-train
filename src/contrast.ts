// WCAG contrast oracle — the single place that decides whether a colour in this
// app is readable. Kept pure and dependency-free so the stylesheet test and the
// instrument-palette test can both assert against computed ratios rather than
// against someone's eye.
//
// Formula per the W3C's own procedure in WCAG 2.0 technique G17
// (https://www.w3.org/TR/WCAG20-TECHS/G17.html, "Procedure" steps 1 and 3):
//
//   csrgb = c8bit / 255
//   c     = csrgb / 12.92                  when csrgb <= 0.03928
//         = ((csrgb + 0.055) / 1.055)^2.4  otherwise
//   L     = 0.2126 R + 0.7152 G + 0.0722 B
//   ratio = (L1 + 0.05) / (L2 + 0.05)      L1 = lighter, L2 = darker
//
// The ratio is returned unrounded on purpose: SC 1.4.3 and SC 1.4.11 are "at
// least" thresholds and the Understanding documents state a computed value is
// not to be rounded up to meet one, so 4.4999 must stay 4.4999.

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** sRGB channels in [0, 1]. Throws rather than returning NaN, so a mistyped
 * colour surfaces as a mistyped colour instead of as a failing palette. */
function channels(hex: string): [number, number, number] {
  if (!HEX.test(hex)) {
    throw new Error(`contrastRatio: not a #rgb or #rrggbb colour: ${JSON.stringify(hex)}`)
  }
  const digits = hex.slice(1)
  // Shorthand doubles each digit — #abc is #aabbcc, not #a0b0c0.
  const full = digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ]
}

function linearize(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/** WCAG contrast ratio between two colours, in [1, 21]. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}
