import { describe, expect, it } from 'vitest'
import { determineEntry } from '../engine/entry'
import { renderHSI, type HSIProps } from './hsi'

function render(props: HSIProps): HTMLElement {
  const el = document.createElement('div')
  renderHSI(el, props)
  return el
}

function rotationOf(el: Element | null): string {
  expect(el).not.toBeNull()
  return el!.getAttribute('transform') ?? ''
}

describe('renderHSI basics', () => {
  it('renders one scalable svg into the container', () => {
    const el = render({ heading: 0 })
    const svgs = el.querySelectorAll('svg')
    expect(svgs).toHaveLength(1)
    const svg = svgs[0]!
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 200')
    // no fixed pixel size — CSS scales it to the container (320 px phones)
    expect(svg.getAttribute('width')).toBeNull()
    expect(svg.getAttribute('height')).toBeNull()
    expect(svg.classList.contains('hsi')).toBe(true)
  })

  it('re-render replaces previous content instead of appending', () => {
    const el = document.createElement('div')
    renderHSI(el, { heading: 0 })
    renderHSI(el, { heading: 90 })
    expect(el.querySelectorAll('svg')).toHaveLength(1)
  })

  it('draws the compass card: 72 ticks and G1000-style labels', () => {
    const el = render({ heading: 0 })
    expect(el.querySelectorAll('.hsi-tick')).toHaveLength(72)
    const labels = [...el.querySelectorAll('.hsi-label')].map((t) => t.textContent)
    expect(labels).toContain('N')
    expect(labels).toContain('E')
    expect(labels).toContain('S')
    expect(labels).toContain('W')
    expect(labels).toContain('3')
    expect(labels).toContain('33')
    expect(labels).toHaveLength(12)
  })

  it('rejects non-finite heading and course', () => {
    const el = document.createElement('div')
    expect(() => renderHSI(el, { heading: NaN })).toThrow(RangeError)
    expect(() => renderHSI(el, { heading: 0, course: NaN })).toThrow(RangeError)
  })
})

describe('rose rotation (heading up)', () => {
  it('rotates the card so the current heading is under the lubber line', () => {
    const el = render({ heading: 90 })
    expect(rotationOf(el.querySelector('.hsi-rose'))).toBe('rotate(-90 100 100)')
  })

  it('heading 0 leaves the card unrotated', () => {
    const el = render({ heading: 0 })
    expect(rotationOf(el.querySelector('.hsi-rose'))).toBe('rotate(0 100 100)')
  })

  it('normalizes out-of-range headings', () => {
    const el = render({ heading: 450 })
    expect(rotationOf(el.querySelector('.hsi-rose'))).toBe('rotate(-90 100 100)')
  })

  it('shows a three-digit heading readout', () => {
    expect(render({ heading: 90 }).querySelector('.hsi-heading-readout')!.textContent).toBe('090°')
    expect(render({ heading: 5 }).querySelector('.hsi-heading-readout')!.textContent).toBe('005°')
    expect(render({ heading: 0 }).querySelector('.hsi-heading-readout')!.textContent).toBe('360°')
  })
})

describe('course pointer', () => {
  it('sits at the course position on the card (rotates with the rose)', () => {
    const el = render({ heading: 90, course: 340 })
    const pointer = el.querySelector('.hsi-course')
    expect(rotationOf(pointer)).toBe('rotate(340 100 100)')
    // inside the rotating rose group, so on screen it appears at course − heading
    expect(pointer!.closest('.hsi-rose')).not.toBeNull()
  })

  it('is absent when no course is given', () => {
    expect(render({ heading: 90 }).querySelector('.hsi-course')).toBeNull()
  })
})

describe('thumb overlay (entry shortcut aid)', () => {
  it('standard hold: 20° band from the 70° line to the 3 o’clock index', () => {
    // The direct/parallel boundary (d = −70) appears at course − heading =
    // +70° on a heading-up card, so the band's nose-side edge must sit there.
    const thumb = render({ heading: 123, thumbOverlay: 'right' }).querySelector('.hsi-thumb')!
    expect(thumb.getAttribute('data-from')).toBe('70')
    expect(thumb.getAttribute('data-to')).toBe('90')
  })

  it('nonstandard hold: mirrored to the 9 o’clock side', () => {
    const thumb = render({ heading: 123, thumbOverlay: 'left' }).querySelector('.hsi-thumb')!
    expect(thumb.getAttribute('data-from')).toBe('270')
    expect(thumb.getAttribute('data-to')).toBe('290')
  })

  it('is fixed to the airframe, not the rotating card', () => {
    const thumb = render({ heading: 123, thumbOverlay: 'right' }).querySelector('.hsi-thumb')!
    expect(thumb.closest('.hsi-rose')).toBeNull()
  })

  it('is absent when not requested', () => {
    expect(render({ heading: 123 }).querySelector('.hsi-thumb')).toBeNull()
  })
})

describe('sector overlay (engine is the oracle)', () => {
  const hold = { inboundCourse: 340, turnDirection: 'right' as const }
  const result = determineEntry(90, hold)

  it('draws each entry sector at exactly the engine-computed arc', () => {
    const el = render({ heading: 90, sectorOverlay: result.sectors })
    for (const entry of ['direct', 'teardrop', 'parallel'] as const) {
      const wedge = el.querySelector(`.hsi-sector-${entry}`)!
      expect(wedge, entry).not.toBeNull()
      expect(wedge.getAttribute('data-from')).toBe(String(result.sectors[entry].from))
      expect(wedge.getAttribute('data-to')).toBe(String(result.sectors[entry].to))
    }
  })

  it('sectors are magnetic: they rotate with the card', () => {
    const el = render({ heading: 90, sectorOverlay: result.sectors })
    expect(el.querySelector('.hsi-sector-direct')!.closest('.hsi-rose')).not.toBeNull()
  })

  it('nonstandard sectors mirror through the engine and render verbatim', () => {
    const mirrored = determineEntry(90, { inboundCourse: 340, turnDirection: 'left' })
    const el = render({ heading: 90, sectorOverlay: mirrored.sectors })
    const wedge = el.querySelector('.hsi-sector-direct')!
    expect(wedge.getAttribute('data-from')).toBe(String(mirrored.sectors.direct.from))
    expect(wedge.getAttribute('data-to')).toBe(String(mirrored.sectors.direct.to))
  })

  it('is absent when not requested', () => {
    expect(render({ heading: 90 }).querySelector('.hsi-sector-direct')).toBeNull()
  })
})

// The overlays were previously checked only through data-from/data-to, which
// echo the inputs: an inverted polar() or a flipped sweep flag would paint the
// wrong side of the card and still pass.
describe('overlay geometry (drawn arcs, not just their data attributes)', () => {
  /** The card convention under test: 0° at the top, clockwise, y grows down. */
  function cardPoint(deg: number, radius: number): { x: number; y: number } {
    const rad = (deg * Math.PI) / 180
    return { x: 100 + radius * Math.sin(rad), y: 100 - radius * Math.cos(rad) }
  }

  it('a sector wedge sweeps clockwise between its two boundary radii', () => {
    const sectors = determineEntry(340, { inboundCourse: 340, turnDirection: 'right' }).sectors
    const path = render({ heading: 0, sectorOverlay: sectors })
      .querySelector('.hsi-sector-direct')!
      .getAttribute('d')!
    const m = /^M 100 100 L (\S+) (\S+) A (\S+) \S+ 0 (\d) (\d) (\S+) (\S+) Z$/.exec(path)
    expect(m, path).not.toBeNull()
    const [, ax, ay, r, largeArc, sweep, bx, by] = m!
    const start = cardPoint(sectors.direct.from, Number(r))
    const end = cardPoint(sectors.direct.to, Number(r))
    expect(Number(ax)).toBeCloseTo(start.x, 1)
    expect(Number(ay)).toBeCloseTo(start.y, 1)
    expect(Number(bx)).toBeCloseTo(end.x, 1)
    expect(Number(by)).toBeCloseTo(end.y, 1)
    expect(sweep).toBe('1') // clockwise, matching the compass rose
    expect(largeArc).toBe('0') // the direct sector is exactly 180°
  })

  it('the thumb band starts on the 70° line, right of the nose, for a standard hold', () => {
    const path = render({ heading: 123, thumbOverlay: 'right' })
      .querySelector('.hsi-thumb')!
      .getAttribute('d')!
    const m = /^M (\S+) (\S+) A (\S+) /.exec(path)
    expect(m, path).not.toBeNull()
    const [, ax, ay, outer] = m!
    const start = cardPoint(70, Number(outer))
    expect(Number(ax)).toBeCloseTo(start.x, 1)
    expect(Number(ay)).toBeCloseTo(start.y, 1)
    expect(Number(ax)).toBeGreaterThan(100) // right of the nose, not left
  })
})
