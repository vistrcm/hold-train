// Instrument palette: the only place a colour enters the HSI or the map view.
// Kept out of styles.css because these colours live inside SVG attribute
// strings, not CSS declarations, and out of the modules themselves so the two
// instruments cannot drift apart — the entry colours in particular must mean
// the same thing on the compass rose and on the plan view.
//
// Every value is measured against `face` by src/ui/palette.test.ts: 4.5:1 for
// anything that renders letters (WCAG SC 1.4.3), 3:1 for lines and shapes
// (SC 1.4.11). Changing one without re-running that test is how an instrument
// becomes unreadable on a sunlit kneeboard tablet.

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
 */
export const OVERLAY_ALPHA = Object.freeze({
  /** Entry-sector wedge fill (the boundary stroke is opaque). */
  sectorFill: 0.1,
  /** The 20° thumb-band aid — a solid marker, not a tint. */
  thumbBand: 0.9,
})

export const PALETTE = Object.freeze({
  /** Instrument face — paper white, matching `--surface` in styles.css. */
  face: '#ffffff',
  /** Rose bezel and plate frame. A boundary, not text: 3.61:1. */
  bezel: '#7d8894',
  /** Card labels, major ticks, aircraft and lubber symbols, fix name: 18.20:1. */
  ink: '#10161c',
  /** Minor ticks, ghost track, north arrow — never letters: 3.61:1. */
  inkDim: '#7d8894',
  /** AIM 5-3-8 j3 entry types, one colour each across both instruments. */
  entry: Object.freeze({
    direct: '#15703f', // 6.14:1
    teardrop: '#8a5200', // 6.39:1
    parallel: '#2f6fd0', // 4.88:1
  }),
  /** Course pointer — the conventional GPS magenta, darkened to 6.84:1. */
  cdi: '#a3168f',
  /** Heading readout digits and the flown track: 5.98:1. */
  readout: '#0b6b8f',
})
