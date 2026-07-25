import { describe, expect, it } from 'vitest'
import { COLOUR_LITERAL, blend, contrastRatio } from '../contrast'
// The stylesheet is read for `--bg` alone: the airframe-fixed parts of the HSI
// (lubber triangle, heading-readout box) hang outside the rose and render on the
// page background, not on the instrument face, and `PALETTE.face` claims in a
// comment to match `--surface`. Two artifacts asserted by two suites that never
// compared could drift without either failing.
import STYLES from '../styles.css?raw'
// The instrument modules are read as source text, not imported for their
// behaviour: the contrast assertions below can only judge colours they can
// see, and they only see PALETTE. A literal left behind in a template string
// would escape them entirely. `?raw` is the same idiom styles.test.ts uses on
// the stylesheet and dashboard.test.ts uses on the README.
import HSI_SOURCE from './hsi.ts?raw'
import MAPVIEW_SOURCE from './mapview.ts?raw'
import { OVERLAY_ALPHA, PALETTE } from './palette'

/** What a colour does decides its threshold: WCAG SC 1.4.3 asks 4.5:1 of
 * text, SC 1.4.11 asks 3:1 of a graphical object (a tick, a path, a border).
 * Neither may be met by rounding a computed ratio up.
 *
 * Every leaf of PALETTE must appear here — a hand-listed subset measured only
 * the keys that existed when the list was typed, so a new one shipped
 * unmeasured. `backdrop` is what everything else is measured against. */
const TIERS: Readonly<Record<string, 'text' | 'graphic' | 'backdrop'>> = {
  face: 'backdrop',
  // card labels, the fix name, the aircraft and lubber symbols
  ink: 'text',
  // the heading readout digits
  readout: 'text',
  // minor ticks, ghost track, north arrow — lines, never letters
  inkDim: 'graphic',
  bezel: 'graphic',
  cdi: 'graphic',
  'entry.direct': 'graphic',
  'entry.teardrop': 'graphic',
  'entry.parallel': 'graphic',
}

const MINIMUM = { text: 4.5, graphic: 3 } as const

/** Every `name → colour` leaf of the palette, nested keys dotted. */
function leaves(): Array<readonly [string, string]> {
  const out: Array<readonly [string, string]> = []
  for (const [key, value] of Object.entries(PALETTE)) {
    if (typeof value === 'string') {
      out.push([key, value])
      continue
    }
    for (const [sub, colour] of Object.entries(value)) {
      out.push([`${key}.${sub}`, colour])
    }
  }
  return out
}

/** `--bg` as declared in the stylesheet — the surface the airframe-fixed parts
 * of the instrument sit on. */
function styleColour(name: string): string {
  const match = STYLES.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`))
  if (!match?.[1]) throw new Error(`styles.css declares no ${name}`)
  return match[1]
}

describe('instrument palette', () => {
  it('names exactly the three AIM entry types', () => {
    expect(Object.keys(PALETTE.entry).sort()).toEqual(['direct', 'parallel', 'teardrop'])
  })

  // Frozen so a screen cannot "just tweak" one instrument's colour at runtime
  // and drift the entry colours apart between the HSI and the map.
  it('is frozen', () => {
    expect(Object.isFrozen(PALETTE)).toBe(true)
    expect(Object.isFrozen(PALETTE.entry)).toBe(true)
    expect(Object.isFrozen(OVERLAY_ALPHA)).toBe(true)
  })

  it('classifies every colour it declares', () => {
    const unclassified = leaves()
      .map(([name]) => name)
      .filter((name) => !(name in TIERS))
    expect(unclassified, 'add these to TIERS as text/graphic/backdrop').toEqual([])
  })

  // The instrument face is white and the page it sits on is `--bg`; a mark that
  // only clears its tier on one of the two is unreadable wherever it crosses to
  // the other, which the lubber triangle and the readout box frame both do.
  it('clears WCAG contrast on the instrument face and on the page', () => {
    const backdrops = [
      ['face', PALETTE.face],
      ['--bg', styleColour('--bg')],
    ] as const

    const failures: string[] = []
    for (const [name, value] of leaves()) {
      const tier = TIERS[name]
      if (tier === undefined || tier === 'backdrop') continue
      for (const [backdrop, against] of backdrops) {
        const ratio = contrastRatio(value, against)
        if (ratio < MINIMUM[tier]) {
          failures.push(`${name} (${value}) on ${backdrop}: ${ratio.toFixed(2)} < ${MINIMUM[tier]}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  // `PALETTE.face` says in a comment that it matches `--surface`; the SVG sits
  // inside a `--surface` card, so a mismatch shows as a visible seam and, worse,
  // silently changes what every ratio above was measured against.
  it('keeps the instrument face equal to the stylesheet surface', () => {
    expect(PALETTE.face).toBe(styleColour('--surface'))
  })

  // Non-vacuous guard: comparing the palette against itself would pass for any
  // set of values, so pin the one pair whose ratio is hand-checkable.
  it('computes real ratios (black on white is 21)', () => {
    expect(contrastRatio('#000000', PALETTE.face)).toBeCloseTo(21, 6)
  })
})

// A translucent mark is not the colour it is drawn with. Measuring the palette
// value certified the sector wedges at 4.88–6.39:1 while they rendered at
// 1.24–2.06:1 over the white face, so every alpha the instruments paint at has
// to be composited here before it is judged.
describe('instrument overlays, as composited', () => {
  const face = PALETTE.face
  const tints = Object.entries(PALETTE.entry).map(
    ([name, colour]) => [name, blend(colour, face, OVERLAY_ALPHA.sectorFill)] as const,
  )

  // The wedge boundary is what makes the sector legible as a sector, so it is
  // stroked opaque (checked above at the graphic tier). The fill underneath is
  // a tint and is not required to reach 3:1 on its own.
  it('leaves the sector boundary opaque', () => {
    expect(HSI_SOURCE, 'a stroke alpha composites the boundary below 3:1').not.toMatch(
      /stroke-opacity=/,
    )
  })

  // Ticks and card labels are drawn over the wedges, so their contrast is
  // against the tinted face, not the bare one. At the old 0.16 the minor ticks
  // fell to 2.85:1 here while the suite reported 3.61:1.
  it('keeps ticks and labels legible over a tinted sector', () => {
    const failures: string[] = []
    for (const [name, tint] of tints) {
      const tick = contrastRatio(PALETTE.inkDim, tint)
      if (tick < MINIMUM.graphic) {
        failures.push(`inkDim on ${name} tint ${tint}: ${tick.toFixed(2)} < ${MINIMUM.graphic}`)
      }
      const label = contrastRatio(PALETTE.ink, tint)
      if (label < MINIMUM.text) {
        failures.push(`ink on ${name} tint ${tint}: ${label.toFixed(2)} < ${MINIMUM.text}`)
      }
    }
    expect(failures).toEqual([])
  })

  // The thumb band is a solid marker rather than a tint, so it answers for
  // itself at the graphic tier once composited.
  it('keeps the thumb band above the graphic tier', () => {
    const band = blend(PALETTE.entry.teardrop, face, OVERLAY_ALPHA.thumbBand)
    expect(contrastRatio(band, face)).toBeGreaterThanOrEqual(MINIMUM.graphic)
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
