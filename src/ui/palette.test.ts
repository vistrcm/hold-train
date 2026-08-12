import { describe, expect, it } from 'vitest'
import {
  COLOUR_LITERAL,
  HEX_COLOUR,
  HEX_COLOUR_SOURCE,
  blend,
  contrastRatio,
  hueOf,
} from '../contrast'
// The stylesheet is read for `--bg`: the plan-view plate sits straight on the
// page, so its marks are measured against both, and the dark PFD panel has to
// separate itself from that page as a component boundary. `PALETTE.plate.face`
// also claims in a comment to match `--surface`. Two artifacts asserted by two
// suites that never compared could drift without either failing.
import STYLES from '../styles.css?raw'
// The instrument modules are read as source text, not imported for their
// behaviour: the contrast assertions below can only judge colours they can
// see, and they only see PALETTE. A literal left behind in a template string
// would escape them entirely. `?raw` is the same idiom styles.test.ts uses on
// the stylesheet and dashboard.test.ts uses on the README.
import HSI_SOURCE from './hsi.ts?raw'
import MAPVIEW_SOURCE from './mapview.ts?raw'
// The app shell is the one artifact that is neither a `.ts` file the glob below
// sweeps nor the stylesheet `styles.test.ts` scans, so it was the one place a
// colour could still enter while CLAUDE.md claimed a literal "anywhere else
// fails npm test". Task 4 of the plan grepped it once by hand; this asserts it.
import INDEX_HTML from '../../index.html?raw'
import { OVERLAY_ALPHA, PALETTE } from './palette'

/** What a colour does decides its threshold: WCAG SC 1.4.3 asks 4.5:1 of
 * text, SC 1.4.11 asks 3:1 of a graphical object (a tick, a path, a border).
 * Neither may be met by rounding a computed ratio up.
 *
 * Every leaf of PALETTE must appear here — a hand-listed subset measured only
 * the keys that existed when the list was typed, so a new one shipped
 * unmeasured. `backdrop` is what everything else in its group is measured
 * against. */
const TIERS: Readonly<Record<string, 'text' | 'graphic' | 'backdrop'>> = {
  'plate.face': 'backdrop',
  // the fix name, the north letter, the racetrack and ownship symbols
  'plate.ink': 'text',
  // the flown track, and nothing else — a polyline. It drew the HSI's heading
  // digits too until the palette split moved that instrument onto `pfd.card`,
  // so `text` here was left over from a rendering that no longer happens.
  'plate.readout': 'graphic',
  // ghost track, north arrow — lines, never letters
  'plate.inkDim': 'graphic',
  'plate.bezel': 'graphic',
  'plate.entry.direct': 'graphic',
  'plate.entry.teardrop': 'graphic',
  'plate.entry.parallel': 'graphic',

  'pfd.face': 'backdrop',
  // card labels and the heading readout digits, plus the lubber and aircraft
  'pfd.card': 'text',
  // the HDG box digits as well as the bug itself
  'pfd.bug': 'text',
  // the CRS box digits as well as the pointer and deviation bar
  'pfd.course': 'text',
  // minor ticks and secondary marks — lines, never letters
  'pfd.cardDim': 'graphic',
  'pfd.chrome': 'graphic',
  'pfd.entry.direct': 'graphic',
  'pfd.entry.teardrop': 'graphic',
  'pfd.entry.parallel': 'graphic',
}

const MINIMUM = { text: 4.5, graphic: 3 } as const

/** What each PFD colour draws *inside the compass card*, where a sector wedge
 * tints the face under it — and at which tier it draws it.
 *
 * A different question from `TIERS`, which asks what a colour draws anywhere on
 * the panel. `pfd.course` renders the CRS box digits (text, 4.5:1), but that
 * box sits on the bare face with its own fill; inside the card the same colour
 * draws only the pointer, the bar and the flag, so over a wedge it answers at
 * the graphic tier. Reusing `TIERS` here would demand 4.5:1 of a line and force
 * the tint down for a case that never renders.
 *
 * `null` means no wedge is ever under it: `pfd.chrome` draws the card ring and
 * the value-box frames, all outside `LAYOUT.tickR` where the wedges stop (it
 * would fail at 1.96:1 if it did), and the entry colours *are* the wedges.
 *
 * Hand-written, so it gets the same exhaustiveness guard `TIERS` and
 * `BACKDROPS` get. Raising `sectorFill` lowers the contrast of everything drawn
 * over a wedge, not only of the marks that were listed when the list was
 * typed. */
const OVER_WEDGE: Readonly<Record<string, 'text' | 'graphic' | null>> = {
  'pfd.face': null,
  // the 30° labels; the major ticks, lubber and aircraft symbol are the same
  // colour and only need the graphic tier, so text is what binds
  'pfd.card': 'text',
  // minor ticks and the deviation dots. It also paints the thumb band, which
  // this tier does NOT cover: the band is drawn at `OVERLAY_ALPHA.thumbBand`,
  // so measuring it here at full strength would certify a colour that never
  // reaches the eye. It answers over a wedge in its own composited assertion
  // below — and that one, not the ticks, is what binds `sectorFill`.
  'pfd.cardDim': 'graphic',
  // the notch rides the card's OUTER edge, from `roseR` outward, so it is
  // outside `tickR` where the wedges stop — same as the card ring below, not
  // over a tint at all; its digits are in the HDG box, on bare face. Pinned to
  // the drawing by `sits on the outer edge of the card, where the lubber reads`,
  // which measures the notch against a rendered wedge rather than against this
  // comment.
  'pfd.bug': null,
  // course pointer, deviation bar and TO/FROM flag — the CRS digits, likewise,
  // are on bare face
  'pfd.course': 'graphic',
  // card ring and value-box frames: drawn outside the wedges' radius
  'pfd.chrome': null,
  'pfd.entry.direct': null,
  'pfd.entry.teardrop': null,
  'pfd.entry.parallel': null,
}

/** Every `name → colour` leaf of the palette, nested keys dotted.
 *
 * Recursive, not two levels: the pre-split walk stopped at depth 2, and under
 * the grouped shape that silently skips every `*.entry.*` colour while still
 * returning a full-looking list. Pinned by `walks the whole tree`. */
function leaves(): Array<readonly [string, string]> {
  const out: Array<readonly [string, string]> = []
  const walk = (node: Record<string, unknown>, prefix: string): void => {
    for (const [key, value] of Object.entries(node)) {
      const name = prefix === '' ? key : `${prefix}.${key}`
      if (typeof value === 'string') {
        out.push([name, value])
        continue
      }
      walk(value as Record<string, unknown>, name)
    }
  }
  walk(PALETTE, '')
  return out
}

/** The top-level group a dotted leaf name belongs to. */
function groupOf(name: string): string {
  return name.split('.')[0]!
}

/** `--bg` / `--surface` as declared in the stylesheet — the page the
 * instruments are mounted on. */
function styleColour(name: string): string {
  // `HEX_COLOUR_SOURCE` rather than a local pattern: this value is handed
  // straight to `contrastRatio`, so the two must agree on what a hex is. The
  // local copy read `{3,8}` and would have captured a `#rrggbbaa` the oracle
  // then threw on, from a helper whose whole job is to find a readable colour.
  // `(?=[;}])` and not `;`: CSS lets the last declaration of a block drop its
  // semicolon, and requiring one would read straight past a `--bg` that ended
  // up last in `:root`. styles.test.ts's own harvests use the lookahead for the
  // same reason — two readers of one stylesheet must agree on where a value
  // ends.
  const match = STYLES.match(new RegExp(`${name}:\\s*(${HEX_COLOUR_SOURCE})\\s*(?=[;}])`))
  if (!match?.[1]) throw new Error(`styles.css declares no ${name}`)
  return match[1]
}

/** What each group's colours actually render on.
 *
 * Per group, because the two instruments have opposite backdrops and measuring
 * either against the other's would be measuring a picture that never appears.
 * Hand-written, so it has exactly the failure mode `TIERS` has — it measures
 * only the groups that existed when it was typed — and therefore gets the same
 * exhaustiveness guard (`measures every group it declares against a backdrop`).
 *
 *  - `plate.*` renders on the white plate, but the plate is not a card
 *    (`.mapview` carries no background rule), so it sits straight on the `--bg`
 *    page at 1.13:1 and its frame overhangs onto that page. Both backdrops.
 *  - `pfd.*` renders on the dark panel and on nothing else: the panel fills the
 *    whole viewBox, so no PFD mark ever touches the page. `pfd.face` answers to
 *    `--bg` on its own, in `separates the PFD panel from the page` below.
 *
 * A function, not a describe-scope const, for the same reason `tints()` is one:
 * `styleColour` throws when the stylesheet read comes back blank or renamed, and
 * at module scope that throw lands during COLLECTION — the file then reports
 * "no tests" and every guard in it goes silent, including the `src/**` colour
 * sweep and the `index.html` scan, under an error message about `--bg` that
 * names nothing to do with colours. */
function backdrops(): Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> {
  return {
    plate: [
      ['plate.face', PALETTE.plate.face],
      ['--bg', styleColour('--bg')],
    ],
    pfd: [['pfd.face', PALETTE.pfd.face]],
  }
}

describe('instrument palette', () => {
  it('names exactly the three AIM entry types, in both groups', () => {
    expect(Object.keys(PALETTE.plate.entry).sort()).toEqual(['direct', 'parallel', 'teardrop'])
    expect(Object.keys(PALETTE.pfd.entry).sort()).toEqual(['direct', 'parallel', 'teardrop'])
  })

  // Frozen so a screen cannot "just tweak" one instrument's colour at runtime
  // and drift the entry colours apart between the HSI and the map. Walked
  // rather than hand-listed: `Object.freeze` is shallow, so a new nested group
  // is unfrozen by default and a hand-listed check would not look at it.
  it('is frozen all the way down', () => {
    const unfrozen: string[] = []
    const walk = (node: Record<string, unknown>, path: string): void => {
      if (!Object.isFrozen(node)) unfrozen.push(path)
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'object' && value !== null) {
          walk(value as Record<string, unknown>, `${path}.${key}`)
        }
      }
    }
    walk(PALETTE, 'PALETTE')
    expect(unfrozen).toEqual([])
    expect(Object.isFrozen(OVERLAY_ALPHA)).toBe(true)
  })

  // Non-vacuous guard on the walk itself: a two-level `leaves()` returns the
  // group object as if it were a colour and never reaches the three entry
  // colours below it — a full-looking list with the newest colours missing,
  // which every assertion downstream would then silently skip.
  it('walks the whole tree, not just two levels', () => {
    const found = leaves()
    const names = found.map(([name]) => name)
    expect(names).toContain('pfd.entry.direct')
    expect(names).toContain('plate.entry.parallel')
    expect(names).not.toContain('pfd.entry')
    for (const [name, value] of found) {
      expect(value, `${name} is not a colour`).toMatch(HEX_COLOUR)
    }
  })

  it('classifies every colour it declares', () => {
    const unclassified = leaves()
      .map(([name]) => name)
      .filter((name) => !(name in TIERS))
    expect(unclassified, 'add these to TIERS as text/graphic/backdrop').toEqual([])
  })

  it('measures every group it declares against a backdrop', () => {
    const mapped = backdrops()
    const unmapped = Object.keys(PALETTE).filter((group) => !(group in mapped))
    expect(unmapped, 'add these groups to backdrops()').toEqual([])
  })

  // A mark that only clears its tier on one of its group's backdrops is
  // unreadable wherever it crosses to the other, which the plate's frame does.
  it('clears WCAG contrast on every backdrop its group renders on', () => {
    const mapped = backdrops()
    const failures: string[] = []
    for (const [name, value] of leaves()) {
      const tier = TIERS[name]
      if (tier === undefined || tier === 'backdrop') continue
      const against = mapped[groupOf(name)]
      // Not a skip: an unmapped group would otherwise pass this test by being
      // measured against nothing at all.
      if (against === undefined) {
        failures.push(`${name}: group ${groupOf(name)} has no backdrop`)
        continue
      }
      for (const [backdrop, colour] of against) {
        const ratio = contrastRatio(value, colour)
        if (ratio < MINIMUM[tier]) {
          failures.push(`${name} (${value}) on ${backdrop}: ${ratio.toFixed(2)} < ${MINIMUM[tier]}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  // The dark panel is its own component boundary against the light page, so it
  // needs no bezel stroke to be perceivable — but only if it clears the 3:1
  // SC 1.4.11 asks of a boundary. Nothing else measures `pfd.face`: it is the
  // backdrop everything in its own group is measured against, so without this
  // it would be the one colour in the palette answering to nobody.
  it('separates the PFD panel from the page', () => {
    const ratio = contrastRatio(PALETTE.pfd.face, styleColour('--bg'))
    expect(ratio, `pfd.face on --bg: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(MINIMUM.graphic)
  })

  // An entry type keeps its hue across the two instruments. Lightness is free —
  // a green readable on white is not readable on near-black — but the hue is
  // the code the student learns, and the HSI and the map appear together in the
  // drill's feedback view, so a hue drift teaches two colour codes on one
  // screen. That is the drift this file was centralised to prevent.
  //
  // ⚠️ The tolerance was chosen after the colours were, so the number itself
  // proves nothing; what makes this guard real is that swapping a `pfd.entry`
  // colour for a different hue fails it (mutation-checked). The three pairs
  // currently sit 1.58°, 0.16° and 0.00° apart.
  const HUE_TOLERANCE_DEG = 5

  it('keeps each entry colour the same hue on both instruments', () => {
    const drifted: string[] = []
    for (const entry of ['direct', 'teardrop', 'parallel'] as const) {
      const gap = Math.abs(hueOf(PALETTE.plate.entry[entry]) - hueOf(PALETTE.pfd.entry[entry]))
      // Hue is an angle: 359° and 1° are 2° apart, not 358°.
      const apart = Math.min(gap, 360 - gap)
      if (apart > HUE_TOLERANCE_DEG) {
        drifted.push(`${entry}: ${apart.toFixed(2)}° apart, tolerance ${HUE_TOLERANCE_DEG}°`)
      }
    }
    expect(drifted).toEqual([])
  })

  // `PALETTE.plate.face` says in a comment that it matches `--surface`, and a
  // comment is not an assertion: a drift here silently changes what every plate
  // ratio above was measured against.
  it('keeps the plate face equal to the stylesheet surface', () => {
    expect(PALETTE.plate.face).toBe(styleColour('--surface'))
  })

  // Non-vacuous guard: comparing the palette against itself would pass for any
  // set of values, so pin the one pair whose ratio is hand-checkable.
  it('computes real ratios (black on white is 21)', () => {
    expect(contrastRatio('#000000', PALETTE.plate.face)).toBeCloseTo(21, 6)
  })
})

// A translucent mark is not the colour it is drawn with. Measuring the palette
// value certified the sector wedges at 4.88–6.39:1 while they rendered at
// 1.24–2.06:1 over the white face, so every alpha the instruments paint at has
// to be composited here before it is judged.
describe('instrument overlays, as composited', () => {
  // Both overlays are HSI-only, so they composite over the PFD panel. Note the
  // asymmetry against the old white face: a tint over a dark backdrop
  // *lightens* it, so the binding assertion is no longer that the tint stays
  // faint but that the white card marks crossing it stay legible on top.
  const face = PALETTE.pfd.face

  // A function, not a describe-scope const: `blend` throws on an alpha that is
  // not a number, and at describe scope that throw lands during collection, so
  // the whole file reports "no tests" and the guard that names the actual
  // mistake never runs. Nesting `OVERLAY_ALPHA` — the exact mutation
  // `composites every alpha it declares` exists to catch — does precisely that.
  function tints(): Array<readonly [string, string]> {
    return Object.entries(PALETTE.pfd.entry).map(
      ([name, colour]) => [name, blend(colour, face, OVERLAY_ALPHA.sectorFill)] as const,
    )
  }

  // The wedge boundary is what makes the sector legible as a sector, so it is
  // stroked opaque (checked above at the graphic tier). The fill underneath is
  // a tint and is not required to reach 3:1 on its own.
  it('leaves the sector boundary opaque', () => {
    expect(HSI_SOURCE, 'a stroke alpha composites the boundary below 3:1').not.toMatch(
      /stroke-opacity=/,
    )
  })

  it('classifies every PFD colour for what it draws over a wedge', () => {
    const unclassified = leaves()
      .map(([name]) => name)
      .filter((name) => groupOf(name) === 'pfd' && !(name in OVER_WEDGE))
    expect(unclassified, 'add these to OVER_WEDGE as text/graphic/null').toEqual([])
  })

  // Card marks are drawn over the wedges, so their contrast is against the
  // tinted face, not the bare one. At the old 0.16 on the white face the minor
  // ticks fell to 2.85:1 here while the suite reported 3.61:1.
  //
  // Every card mark, not the two someone listed: raising `sectorFill` lowers
  // the contrast of *everything* with a wedge under it, and the tuning this
  // task performs is exactly such a raise. `cardDim` is the tightest of them at
  // 3.79:1 and is what fixes the ceiling.
  it('keeps every card mark legible over a tinted sector', () => {
    const colours = new Map(leaves())
    const failures: string[] = []
    for (const [name, tint] of tints()) {
      for (const [mark, tier] of Object.entries(OVER_WEDGE)) {
        if (tier === null) continue
        const colour = colours.get(mark)
        // A classified name that is not a colour is a typo in OVER_WEDGE, and
        // skipping it silently would drop that mark from the measurement.
        expect(colour, `OVER_WEDGE names ${mark}, which is not in the palette`).toBeDefined()
        const ratio = contrastRatio(colour!, tint)
        if (ratio < MINIMUM[tier]) {
          failures.push(`${mark} on ${name} tint ${tint}: ${ratio.toFixed(2)} < ${MINIMUM[tier]}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  // The floor, and the other half of the same tuning. 0.1 was the alpha for a
  // white face, where the tint darkened paper; over near-black it renders at
  // 1.15:1 against the bare panel — a wedge that is not there, teaching nothing
  // while every ceiling above passes comfortably.
  //
  // Deliberately **not** an SC threshold, and it must not become one: the
  // opaque boundary is what carries the sector under SC 1.4.11, because a fill
  // that reached 3:1 against the face on its own needs alpha ≈ 0.44 and puts
  // the dim ticks crossing it at 2.2:1. The two constraints are in direct
  // tension and only the boundary can satisfy the standard. This is a floor the
  // old white-face value fails, which is what stops it being reverted.
  const TINT_FLOOR = 1.3

  it('tints the wedge enough to be seen at all', () => {
    const invisible: string[] = []
    for (const [name, tint] of tints()) {
      const ratio = contrastRatio(tint, face)
      if (ratio < TINT_FLOOR) {
        invisible.push(`${name} tint ${tint} on the face: ${ratio.toFixed(2)} < ${TINT_FLOOR}`)
      }
    }
    expect(invisible).toEqual([])
  })

  // The thumb band is a solid marker rather than a tint, so it answers for
  // itself at the graphic tier once composited. It is painted `pfd.cardDim` —
  // a marker colour, deliberately not one of the three entry colours, since the
  // band is the 70° boundary and not a sector (see the ⚠️ in hsi.test.ts). That
  // costs contrast: 5.47:1 here against the old teardrop fill's 8.83:1, still
  // clear of the graphic tier. `pfd.chrome`, the only other non-semantic colour,
  // would land at 2.95:1 and fail — which is why this assertion is what fixes
  // the choice rather than taste.
  it('keeps the thumb band above the graphic tier', () => {
    const band = blend(PALETTE.pfd.cardDim, face, OVERLAY_ALPHA.thumbBand)
    expect(contrastRatio(band, face)).toBeGreaterThanOrEqual(MINIMUM.graphic)
  })

  // …and the backdrop the band actually has in learn mode, which is not the
  // bare face. Learn mode draws BOTH overlays, `thumbBand()` is emitted after
  // `</g>` closes `.hsi-rose` (so it paints over the wedges, pinned by `is
  // painted over the sector wedges, not under them` in hsi.test.ts), and its
  // annulus `roseR`→`roseR − 9` overlaps the wedges' `tickR` across 75–80
  // (pinned by `is thick enough to cover the card marks palette.test.ts says it
  // hides`). The sectors sum to 360°, so there is no heading at which the nose
  // is over bare face — this composite renders on every learn-mode scenario.
  //
  // It is the TIGHTEST composite on the panel at 3.38:1, below the 3.79:1 dim
  // ticks the `sectorFill` docblock used to name as binding, and it is what
  // fixes that ceiling: 3:1 falls at `sectorFill` ≈ 0.29, not 0.32. Both band
  // assertions are needed and neither implies the other — the bare-face one
  // gains contrast as `thumbBand` rises, this one loses it as `sectorFill`
  // rises, so they bound different constants.
  //
  // Not folded into `keeps every card mark legible over a tinted sector`: that
  // loop measures OPAQUE marks over a tint, and `pfd.cardDim` enters it as the
  // minor ticks. The band is the same colour at a different alpha, so it needs
  // its own composite or the suite measures the ticks twice and the band never.
  it('keeps the thumb band above the graphic tier over a tinted sector', () => {
    const failures: string[] = []
    for (const [name, tint] of tints()) {
      const band = blend(PALETTE.pfd.cardDim, tint, OVERLAY_ALPHA.thumbBand)
      const ratio = contrastRatio(band, tint)
      if (ratio < MINIMUM.graphic) {
        failures.push(`the band on the ${name} tint: ${ratio.toFixed(2)} < ${MINIMUM.graphic}`)
      }
    }
    expect(failures).toEqual([])
    // Non-vacuous: this must be the tighter of the two readings, or the
    // bare-face assertion above already covered it and this one bounds nothing.
    const overFace = contrastRatio(blend(PALETTE.pfd.cardDim, face, OVERLAY_ALPHA.thumbBand), face)
    const overTint = Math.min(
      ...tints().map(([, tint]) =>
        contrastRatio(blend(PALETTE.pfd.cardDim, tint, OVERLAY_ALPHA.thumbBand), tint),
      ),
    )
    expect(overTint, 'the tint is what costs the band contrast').toBeLessThan(overFace)
  })

  // The band's exemption from OVER_WEDGE rests on a premise nothing asserted:
  // at 0.9 it OCCLUDES the marks in its 20° arc rather than tinting them, so
  // measuring those marks over it would be measuring marks it deliberately
  // hides. Lower the alpha and that stops being true — the marks come back as
  // half-visible ghosts nothing measures, because the band is excluded from the
  // only map that would measure them. The assertion above is a floor on the
  // BAND, and the band gets *more* contrast as the alpha rises, so it passes
  // all the way down to 0.6: the two constraints pull opposite ways and only
  // this one bounds the alpha from below.
  //
  // Stated as a ceiling on what still shows through, which is the claim itself.
  // Deliberately NOT an SC threshold — nothing here is required to be legible;
  // the opposite. Like `TINT_FLOOR`, it is a chosen number that the values it
  // must reject fail: 1.5 passes today (the white major ticks are the loosest
  // at 1.36:1) and fails at 0.8, which is what "lower this materially" means.
  const OCCLUSION_CEILING = 1.5

  it('hides the card marks it covers rather than half-tinting them', () => {
    const band = PALETTE.pfd.cardDim
    const a = OVERLAY_ALPHA.thumbBand
    // What the band's own arc looks like where no mark is under it.
    const overFace = blend(band, face, a)
    const showing: string[] = []
    // What the band's annulus (roseR → roseR − 9, i.e. 75–84) is drawn over.
    // Both tick weights run inward from tickR = 80 and the card ring sits at
    // roseR, so their outer/inner halves are under it — and so are the sector
    // wedges, whose opaque boundary strokes run out to tickR along two radial
    // edges and around the arc, and which the band is painted *over* (asserted
    // by `is painted over the sector wedges, not under them` in hsi.test.ts).
    //
    // The wedge colours are the group an earlier version of this list left out
    // while its comment called itself exhaustive — the same over-claim this
    // ledger records against `ruleBlock`'s docblock. They are spread from the
    // group rather than named, so a fourth entry colour is measured by default;
    // hand-listing is what let the first three go unmeasured.
    //
    // What no assertion here can carry: this is a claim about `hsi.ts`'s LAYOUT
    // radii, and a radius change moves what lies under the band without
    // touching a line of this file.
    const covered: readonly (readonly [string, string])[] = [
      ['card', PALETTE.pfd.card],
      ['cardDim', PALETTE.pfd.cardDim],
      ['chrome', PALETTE.pfd.chrome],
      ...Object.entries(PALETTE.pfd.entry).map(([name, hex]) => [`entry.${name}`, hex] as const),
    ]
    for (const [mark, hex] of covered) {
      const ratio = contrastRatio(blend(band, hex, a), overFace)
      if (ratio > OCCLUSION_CEILING) {
        showing.push(`pfd.${mark} under the band: ${ratio.toFixed(2)} > ${OCCLUSION_CEILING}`)
      }
    }
    expect(showing, 'the band is tinting these, so they need measuring').toEqual([])
    // Non-vacuous: the same arithmetic at an alpha that does tint must report
    // them, or the loop above would pass for a band painted at any strength.
    const tinting = contrastRatio(blend(band, PALETTE.pfd.card, 0.5), blend(band, face, 0.5))
    expect(tinting).toBeGreaterThan(OCCLUSION_CEILING)
  })

  // Non-vacuous: if `blend` ever returned its foreground unchanged, every
  // assertion above would silently revert to measuring the opaque palette.
  // Stated without naming an alpha, so tuning one above fails the assertion it
  // is meant to fail and not this one. The arithmetic itself is pinned against
  // hand-computed pairs in contrast.test.ts.
  it('actually composites (a tint of black on the face is neither)', () => {
    const tint = blend('#000000', face, OVERLAY_ALPHA.sectorFill)
    expect(tint).not.toBe('#000000')
    expect(contrastRatio(tint, face)).toBeLessThan(contrastRatio('#000000', face))
  })
})

describe('instrument source', () => {
  const modules: ReadonlyArray<readonly [string, string]> = [
    ['hsi.ts', HSI_SOURCE],
    ['mapview.ts', MAPVIEW_SOURCE],
  ]

  // Vite blanks a `?raw` import it does not resolve, and an empty string makes
  // the no-literals assertion below pass without reading anything.
  it('is actually loaded', () => {
    for (const [name, source] of modules) {
      expect(source.length, `${name} raw source`).toBeGreaterThan(1000)
    }
  })

  it('lets colour in only through PALETTE', () => {
    for (const [name, source] of modules) {
      expect(source.match(COLOUR_LITERAL) ?? [], `${name} colour literals`).toEqual([])
      expect(source, `${name} palette import`).toMatch(/from '\.\/palette'/)
    }
  })

  // The literal scan cannot see a named colour (`fill="red"`), and matching bare
  // words against prose is all false positives. Constraining the attribute
  // values instead closes that notation without guessing: an SVG paint here is
  // either `none` or an interpolated value, and the scan above already proves
  // no literal colour exists in the file for that value to have come from.
  it('paints only with none or an interpolated value', () => {
    const strays: string[] = []
    for (const [name, source] of modules) {
      for (const [, attr, value] of source.matchAll(/(fill|stroke)="([^"]*)"/g)) {
        if (value === 'none' || value!.includes('${')) continue
        strays.push(`${name}: ${attr}="${value}"`)
      }
    }
    expect(strays).toEqual([])
  })

  // Same rule one level down: an alpha is not a colour, but it decides what
  // colour actually reaches the eye, so it has to be visible to the composite
  // tests above. A hand-written `fill-opacity="0.5"` is an alpha those tests
  // cannot see and therefore silently certify at `OVERLAY_ALPHA`'s value — the
  // whole defect `OVERLAY_ALPHA` exists to prevent, left half-closed because the
  // boundary check only banned `stroke-opacity`.
  it('takes every alpha from OVERLAY_ALPHA', () => {
    const strays: string[] = []
    for (const [name, source] of modules) {
      for (const [, attr, value] of source.matchAll(/([\w-]*opacity)="([^"]*)"/g)) {
        if (value!.includes('${OVERLAY_ALPHA.')) continue
        strays.push(`${name}: ${attr}="${value}"`)
      }
    }
    expect(strays, 'declare the alpha in OVERLAY_ALPHA so the suite composites it').toEqual([])
  })

  // And the exhaustiveness half: a third alpha added to OVERLAY_ALPHA and used
  // on a mark would satisfy the guard above while no test composited it. Listed
  // here rather than inferred, for the same reason `TIERS` is.
  it('composites every alpha it declares', () => {
    const measured = ['sectorFill', 'thumbBand']
    expect(Object.keys(OVERLAY_ALPHA).sort(), 'add a composited assertion for these').toEqual(
      measured.sort(),
    )
  })
})

// The two instruments are not the only source files that could hand-write a
// colour: any screen under `modules/` can put one in an inline `style=`, and
// nothing outside this sweep would notice. CLAUDE.md states the palette is the
// only way a colour enters the app; this is what makes that true rather than
// true-of-the-two-files-someone-remembered.
describe('every source file', () => {
  const SOURCES = import.meta.glob<string>('../**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  /** Files whose colour literals are the point: `palette.ts` is the palette,
   * `contrast.ts` documents the shorthand rule with examples, and
   * `contrast.test.ts` holds hand-checkable reference pairs — importing those
   * from the palette would make every ratio assertion circular.
   *
   * This file is absent because Vite excludes the importing module from its own
   * glob, which is also why its reference pairs need no entry here. */
  const ALLOWED = new Set(['../contrast.ts', '../contrast.test.ts', './palette.ts'])

  it('is actually loaded', () => {
    const paths = Object.keys(SOURCES)
    expect(paths.length, 'glob matched no source files').toBeGreaterThan(20)
    for (const path of paths) {
      expect(SOURCES[path]!.length, `${path} raw source`).toBeGreaterThan(0)
    }
    // An allowlist entry that no longer matches a file is a hole, not a no-op.
    for (const path of ALLOWED) {
      expect(paths, `allowlisted ${path} does not exist`).toContain(path)
    }
  })

  it('declares colours only in the palette', () => {
    const strays: string[] = []
    for (const [path, source] of Object.entries(SOURCES)) {
      if (ALLOWED.has(path)) continue
      for (const literal of source.match(COLOUR_LITERAL) ?? []) {
        strays.push(`${path}: ${literal}`)
      }
    }
    expect(strays).toEqual([])
  })
})

// `index.html` is markup, so neither the `.ts` sweep above nor the stylesheet
// scan in styles.test.ts can see it — yet it is a place a colour enters the app,
// via a `<meta name="theme-color">` or an inline `style=`. Left unasserted, the
// "colours live in exactly two places" rule was true of everything someone
// remembered to glob.
describe('the app shell', () => {
  it('is actually loaded', () => {
    expect(INDEX_HTML).toMatch(/<html/i)
  })

  it('carries no colour literal', () => {
    expect(INDEX_HTML.match(COLOUR_LITERAL) ?? []).toEqual([])
  })

  // The notation the literal scan cannot see, closed the same way the two
  // instrument modules close it: by bounding where a CSS declaration — and so a
  // named colour — is allowed to appear at all. An inline `style=` is the only
  // route for one into markup, and this shell is a single mount point that has
  // no reason to carry styling of its own.
  it('styles nothing inline, so no named colour can reach it', () => {
    expect([...INDEX_HTML.matchAll(/\sstyle=/gi)].map((m) => m[0])).toEqual([])
  })
})
