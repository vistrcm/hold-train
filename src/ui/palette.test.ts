import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../contrast'
// The instrument modules are read as source text, not imported for their
// behaviour: the contrast assertions below can only judge colours they can
// see, and they only see PALETTE. A literal left behind in a template string
// would escape them entirely. `?raw` is the same idiom styles.test.ts uses on
// the stylesheet and dashboard.test.ts uses on the README.
import HSI_SOURCE from './hsi.ts?raw'
import MAPVIEW_SOURCE from './mapview.ts?raw'
import { PALETTE } from './palette'

/** What a colour does decides its threshold: WCAG SC 1.4.3 asks 4.5:1 of
 * text, SC 1.4.11 asks 3:1 of a graphical object (a tick, a path, a border).
 * Neither may be met by rounding a computed ratio up. */
const TEXT = 4.5
const GRAPHIC = 3

const ROLES: ReadonlyArray<readonly [string, string, number]> = [
  // card labels, the fix name, the aircraft and lubber symbols
  ['ink', PALETTE.ink, TEXT],
  // the heading readout digits
  ['readout', PALETTE.readout, TEXT],
  // minor ticks, ghost track, north arrow — lines, never letters
  ['inkDim', PALETTE.inkDim, GRAPHIC],
  ['bezel', PALETTE.bezel, GRAPHIC],
  ['cdi', PALETTE.cdi, GRAPHIC],
  ['entry.direct', PALETTE.entry.direct, GRAPHIC],
  ['entry.teardrop', PALETTE.entry.teardrop, GRAPHIC],
  ['entry.parallel', PALETTE.entry.parallel, GRAPHIC],
]

/** A `#rgb`/`#rrggbb`/`#rrggbbaa` literal. */
const HEX_LITERAL = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g

describe('instrument palette', () => {
  it('names exactly the three AIM entry types', () => {
    expect(Object.keys(PALETTE.entry).sort()).toEqual(['direct', 'parallel', 'teardrop'])
  })

  // Frozen so a screen cannot "just tweak" one instrument's colour at runtime
  // and drift the entry colours apart between the HSI and the map.
  it('is frozen', () => {
    expect(Object.isFrozen(PALETTE)).toBe(true)
    expect(Object.isFrozen(PALETTE.entry)).toBe(true)
  })

  it('clears WCAG contrast against the instrument face', () => {
    const failures: string[] = []
    for (const [name, value, min] of ROLES) {
      const ratio = contrastRatio(value, PALETTE.face)
      if (ratio < min) {
        failures.push(`${name} (${value}) on face ${PALETTE.face}: ${ratio.toFixed(2)} < ${min}`)
      }
    }
    expect(failures).toEqual([])
  })

  // Non-vacuous guard: comparing the palette against itself would pass for any
  // set of values, so pin the one pair whose ratio is hand-checkable.
  it('computes real ratios (black on white is 21)', () => {
    expect(contrastRatio('#000000', PALETTE.face)).toBeCloseTo(21, 6)
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
      expect(source.match(HEX_LITERAL) ?? [], `${name} hex literals`).toEqual([])
      expect(source, `${name} palette import`).toMatch(/from '\.\/palette'/)
    }
  })
})
