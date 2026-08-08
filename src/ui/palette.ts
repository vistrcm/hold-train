// Instrument palette: the only place a colour enters the HSI or the map view.
// Kept out of styles.css because these colours live inside SVG attribute
// strings, not CSS declarations, and out of the modules themselves so the two
// instruments cannot drift apart — the entry colours in particular must mean
// the same thing on the compass rose and on the plan view.
//
// Two groups, because the two instruments have opposite backdrops:
//
//   plate.*  the plan view — a light, chart-like plate, paper white, the way an
//            approach plate or an enroute chart looks. Values unchanged since
//            the light-theme switch; mapview.ts renders nothing else.
//   pfd.*    the HSI — a dark G1000 PFD panel, because that is the panel the
//            student actually flies behind. White card marks, cyan bug, magenta
//            course, on a near-black face.
//
// The three AIM entry colours exist in both groups. They differ in lightness
// (a colour readable on white is not readable on near-black) but are held to
// the same hue by `keeps each entry colour the same hue on both instruments` in
// palette.test.ts — the HSI and the map appear together in the drill's feedback
// view, so a hue drift would teach two colour codes on one screen, which is the
// exact failure this file was centralised to prevent.
//
// Every value is measured by src/ui/palette.test.ts against the backdrop its
// group actually renders on: 4.5:1 for anything that renders letters (WCAG SC
// 1.4.3), 3:1 for lines and shapes (SC 1.4.11). Changing one without re-running
// that test is how an instrument becomes unreadable on a sunlit kneeboard
// tablet.

/**
 * Alphas the HSI paints its translucent overlays at.
 *
 * These live here, not inline in `hsi.ts`, because `palette.test.ts` composites
 * with them: an alpha the test cannot see is an alpha the test silently
 * certifies at full strength. That is exactly what happened — a sector fill at
 * 0.16 and a boundary at stroke-opacity 0.45 render at 1.27:1 and 2.03:1 on the
 * white face, and dropped the minor ticks crossing a wedge to 2.85:1, while the
 * suite reported the opaque 6.14:1. The wedge boundary is now stroked opaque,
 * so only the fill is a tint, and it stays faint enough for the ticks and card
 * labels that cross it.
 *
 * FLAT on purpose, unlike `PALETTE`. Every alpha here is a PFD alpha —
 * `mapview.ts` paints no translucent mark at all — so a `plate` group would be
 * empty, and grouping would make `Object.keys(OVERLAY_ALPHA)` return group
 * names instead of alpha names, blinding the `composites every alpha it
 * declares` guard that exists to stop an unmeasured alpha shipping.
 */
export const OVERLAY_ALPHA = Object.freeze({
  /** Entry-sector wedge fill (the boundary stroke is opaque). */
  sectorFill: 0.1,
  /** The 20° thumb-band aid — a solid marker, not a tint. */
  thumbBand: 0.9,
})

export const PALETTE = Object.freeze({
  /** The plan view: a light chart-like plate. Values unchanged. */
  plate: Object.freeze({
    /** Plate face — paper white, matching `--surface` in styles.css. */
    face: '#ffffff',
    /** Plate frame. A boundary, not text: 3.61:1. */
    bezel: '#7d8894',
    /** Racetrack, fix marker and name, ownship, north letter: 18.20:1. */
    ink: '#10161c',
    /** Ghost track and north arrow — never letters: 3.61:1. */
    inkDim: '#7d8894',
    /** The flown track: 5.98:1. */
    readout: '#0b6b8f',
    /** AIM 5-3-8 j3 entry types, one hue each across both instruments. */
    entry: Object.freeze({
      direct: '#15703f', // 6.14:1
      teardrop: '#8a5200', // 6.39:1
      parallel: '#2f6fd0', // 4.88:1
    }),
  }),

  /** The HSI: a dark G1000 PFD panel. Ratios are against `pfd.face`. */
  pfd: Object.freeze({
    /** Panel face — near-black, as the G1000's PFD background is. */
    face: '#0a0f14',
    /** Compass card marks: major ticks, labels, lubber, aircraft: 19.24:1. */
    card: '#ffffff',
    /** Minor ticks and secondary marks — never letters: 6.54:1. */
    cardDim: '#8b98a6',
    /** Box frames and dividers. A boundary, not text: 3.38:1. */
    chrome: '#5c6874',
    /** Heading bug and the HDG readout — G1000 cyan: 11.85:1. */
    bug: '#33ddff',
    /** Course pointer, deviation bar and the CRS readout — GPS magenta: 6.77:1. */
    course: '#ff4de0',
    /** The same three entry types, brightened for the dark face at the same hues. */
    entry: Object.freeze({
      direct: '#3ce08c', // 11.21:1, hue 149.3 (plate 147.7)
      teardrop: '#ffb240', // 10.72:1, hue 35.8 (plate 35.7)
      parallel: '#63a1ff', // 7.40:1, hue 216.2 (plate 216.2)
    }),
  }),
})
