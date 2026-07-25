// Colour oracle — the single place that decides whether a colour in this app is
// readable, and the single definition of what a colour literal looks like in
// source text. Kept pure and dependency-free so the stylesheet test and the
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

/**
 * `fg` painted over `bg` at `alpha`, as an opaque colour.
 *
 * WCAG ratios are defined between two opaque colours, so a mark drawn with
 * `fill-opacity`/`stroke-opacity` has to be composited before it can be
 * measured — the SVG overlays render as tints, and measuring the palette value
 * they are derived from certifies a colour that never reaches the eye.
 *
 * Simple source-over alpha compositing in sRGB, matching what the renderer
 * does: `result = fg·alpha + bg·(1 − alpha)` per channel.
 */
export function blend(fg: string, bg: string, alpha: number): string {
  if (!(alpha >= 0 && alpha <= 1)) {
    throw new RangeError(`blend: alpha must be in [0, 1], got ${alpha}`)
  }
  const f = channels(fg)
  const b = channels(bg)
  const hex = f
    .map((c, i) => Math.round((c * alpha + b[i]! * (1 - alpha)) * 255))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}

/**
 * A colour literal in source text, in every notation CSS and SVG accept:
 * `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`, plus the functional forms. Exported so
 * the stylesheet guard and the instrument guard share one definition — two
 * hand-written regexes for the same concept drift, and the half nobody edits
 * keeps waving colours through.
 *
 * Named colours (`red`, `white`) are deliberately absent: matching bare words
 * against prose and identifiers is all false positives. The SVG modules close
 * that hole differently, by asserting every `fill=`/`stroke=` attribute value
 * is `none` or a palette interpolation.
 */
export const COLOUR_LITERAL =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/g

/**
 * The CSS named colours, per CSS Color Module Level 4 §6.1
 * (https://www.w3.org/TR/css-color-4/#named-colors).
 *
 * The third notation, and the one `COLOUR_LITERAL` deliberately cannot see. The
 * reason it cannot — matching bare words against prose and identifiers is all
 * false positives — is a property of TypeScript source, not of CSS: a CSS
 * declaration value is a bounded grammar, so there the word can be matched
 * safely and the hole closed rather than worked around. (The SVG modules close
 * it a third way, by constraining `fill=`/`stroke=` attribute values.) Without
 * this, `color: crimson` was a free way back into the stylesheet.
 *
 * Spec-closed data: unlike a hand-listed set of roles, this list does not grow
 * with the app, so it cannot fall behind what ships.
 *
 * `transparent` and `currentcolor` are absent on purpose — neither introduces a
 * colour of its own, so neither is something the oracle needs to measure.
 */
export const CSS_NAMED_COLOURS: ReadonlySet<string> = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
   blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
   crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
   darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
   darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
   dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
   gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
   lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
   lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
   lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
   magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
   mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
   mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
   palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
   powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
   seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
   steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`
    .trim()
    .split(/\s+/),
)
