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
 * suite reported the opaque 6.14:1. The wedge boundary is stroked opaque, so
 * only the fill is a tint.
 *
 * An alpha is tuned to a *face*, not to a palette: inverting the face inverts
 * which direction the tint moves the backdrop, so both values are re-judged
 * here whenever it changes. Both are measured against `pfd.face` and against
 * every mark drawn over them, ceiling and floor.
 *
 * FLAT on purpose, unlike `PALETTE`. Every alpha here is a PFD alpha —
 * `mapview.ts` paints no translucent mark at all — so a `plate` group would be
 * empty, and grouping would make `Object.keys(OVERLAY_ALPHA)` return group
 * names instead of alpha names, blinding the `composites every alpha it
 * declares` guard that exists to stop an unmeasured alpha shipping.
 */
export const OVERLAY_ALPHA = Object.freeze({
  /**
   * Entry-sector wedge fill (the boundary stroke is opaque).
   *
   * Bounded on both sides, and the two bounds are what fixes the value rather
   * than taste. Ceiling: the tint *lightens* the near-black face, so everything
   * drawn over a wedge loses contrast — the tightest is the **thumb band over a
   * wedge** at 3.38:1 here, which reaches SC 1.4.11's 3:1 at about 0.29. Floor:
   * this was 0.1 when the face was white, and 0.1 over near-black renders at
   * 1.15:1 against the bare panel, a wedge that is not there.
   *
   * ⚠️ The ceiling used to be quoted as the dim minor ticks, 3.79:1 and 0.32.
   * The ticks are real but they are not the binding case: in learn mode both
   * overlays draw, and the band is emitted *after* `.hsi-rose` closes while the
   * wedges fill to `tickR` — so 75–80 of the band's annulus is over a tint at
   * every heading (the sectors sum to 360°, so the nose is never over bare
   * face). Tuning to the old 0.32 would have shipped the band at 2.79:1 with
   * `keeps the thumb band above the graphic tier` — which composites against
   * the *bare* face — still green. Measured by its over-a-tint twin now.
   */
  sectorFill: 0.25,
  /**
   * The 20° thumb-band aid — a solid marker, not a tint, so it answers for
   * itself at the graphic tier once composited: 5.47:1 on the dark face in
   * `cardDim`. It needed no re-tuning through the palette split, which is the
   * point of measuring rather than assuming: only the fill's direction of
   * travel reversed with the face.
   *
   * That 5.47:1 is its *bare-face* figure and is not the binding one. In learn
   * mode the band paints over the sector wedges, where it reads 3.38:1 — the
   * tightest composite on the panel, and the number that actually fixes
   * `sectorFill`'s ceiling. Both are asserted; neither implies the other, since
   * they move with different alphas.
   *
   * At 0.9 it OCCLUDES rather than tints, which is why it gets no `OVER_WEDGE`
   * treatment in palette.test.ts: the band spans radii `roseR`→`roseR − 9` and
   * is painted after the card, so in its 20° arc it covers the outer half of
   * every tick (`tickR` inward) and the inner half of the card ring, washing
   * them to 1.12:1 (chrome) — 1.36:1 (the white major ticks) against itself.
   * Measuring those marks over it would be measuring marks the band is
   * deliberately hiding. Lower this materially and that stops being true — the
   * band becomes a tint, and every card mark under it then needs the
   * ceiling/floor treatment `sectorFill` gets. That is a floor on this value,
   * and it is a *different* floor from the band's own 3:1: the band gains
   * contrast as the alpha rises, so the graphic-tier assertion passes all the
   * way down to 0.6 and bounds nothing here. `hides the card marks it covers
   * rather than half-tinting them` is the one that does.
   */
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
