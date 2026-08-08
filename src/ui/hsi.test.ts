import { describe, expect, it } from 'vitest'
import { determineEntry } from '../engine/entry'
import { courseText, distanceText } from '../format'
import { OVERLAY_ALPHA, PALETTE } from './palette'
import {
  DEVIATION_DOTS,
  FULL_SCALE_NM,
  LAYOUT,
  PX_PER_NM,
  renderHSI,
  type HSIProps,
} from './hsi'

/** The nav state needs an ident. `ZORVU` is already a `PUBLISHED_HOLDS`
 * fixture, i.e. already checked to be a fictitious waypoint — inventing a
 * second name here would mean repeating that check for no gain. */
const FIX = 'ZORVU'

function render(props: HSIProps): HTMLElement {
  const el = document.createElement('div')
  renderHSI(el, props)
  return el
}

function rotationOf(el: Element | null): string {
  expect(el).not.toBeNull()
  return el!.getAttribute('transform') ?? ''
}

function num(el: Element, attr: string): number {
  const raw = el.getAttribute(attr)
  expect(raw, `${el.tagName} has no ${attr}`).not.toBeNull()
  return Number(raw)
}

/** The `x,y` pairs of a `<polygon points="…">`. */
function pointsOf(el: Element): Array<{ x: number; y: number }> {
  return (el.getAttribute('points') ?? '')
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(',')
      return { x: Number(x), y: Number(y) }
    })
}

/** Every absolute move/line coordinate of a `<path d="…">`. */
function coordsOf(el: Element): Array<{ x: number; y: number }> {
  const d = el.getAttribute('d') ?? ''
  return [...d.matchAll(/[ML]\s*(-?[\d.]+)[\s,](-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }))
}

/** Distance from the rose centre — the card convention is polar about it. */
function radiusFromCentre(x: number, y: number): number {
  return Math.hypot(x - LAYOUT.cx, y - LAYOUT.cy)
}

/**
 * Total rotation `el` receives on screen: its own `transform` plus every
 * ancestor's.
 *
 * The course assembly's own transform reads `rotate(course)` no matter where it
 * is parented, so reading that attribute alone would stay green with the whole
 * assembly lifted out of the rotating card — the needle would then stand still
 * while the compass turned under it. Composing the chain is what names that
 * failure, and it needs `heading ≠ 0` **and** `course ≠ 0` to do so: at either
 * zero the composed angle collapses onto the local one.
 */
function composedRotation(el: Element): number {
  let total = 0
  for (let node: Element | null = el; node !== null; node = node.parentElement) {
    const m = (node.getAttribute('transform') ?? '').match(/rotate\(\s*(-?[\d.]+)/)
    if (m !== null) {
      total += Number(m[1])
    }
  }
  return total
}

describe('the PFD panel', () => {
  it('renders one scalable svg into the container', () => {
    const el = render({ heading: 0 })
    const svgs = el.querySelectorAll('svg')
    expect(svgs).toHaveLength(1)
    const svg = svgs[0]!
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${LAYOUT.width} ${LAYOUT.height}`)
    // no fixed pixel size — CSS scales it to the container (320 px phones)
    expect(svg.getAttribute('width')).toBeNull()
    expect(svg.getAttribute('height')).toBeNull()
    expect(svg.classList.contains('hsi')).toBe(true)
  })

  // Cross-checked against the viewBox parsed off the svg rather than against
  // LAYOUT twice: the claim is that the dark face reaches every edge, which is
  // what lets palette.test.ts measure every instrument colour against one
  // backdrop. A rect inset by a few px would satisfy a LAYOUT-vs-LAYOUT check
  // and still leave marks hanging onto the light page.
  it('fills the whole viewBox with a single dark panel', () => {
    const el = render({ heading: 0 })
    const panels = el.querySelectorAll('.hsi-panel')
    expect(panels).toHaveLength(1)
    const panel = panels[0]!
    const box = el.querySelector('svg')!.getAttribute('viewBox')!.split(/\s+/).map(Number)
    const [vx, vy, vw, vh] = box as [number, number, number, number]
    expect(panel.tagName.toLowerCase()).toBe('rect')
    expect(num(panel, 'x')).toBe(vx)
    expect(num(panel, 'y')).toBe(vy)
    expect(num(panel, 'width')).toBe(vw)
    expect(num(panel, 'height')).toBe(vh)
  })

  // A panel painted last is an opaque cover, not a backdrop: every assertion
  // below would still pass while the instrument rendered as a black rectangle.
  it('paints the panel first, behind the instrument', () => {
    const svg = render({ heading: 0 }).querySelector('svg')!
    expect(svg.firstElementChild!.classList.contains('hsi-panel')).toBe(true)
  })

  it('re-render replaces previous content instead of appending', () => {
    const el = document.createElement('div')
    renderHSI(el, { heading: 0 })
    renderHSI(el, { heading: 90 })
    expect(el.querySelectorAll('svg')).toHaveLength(1)
    expect(el.querySelectorAll('.hsi-panel')).toHaveLength(1)
  })

  it('rejects non-finite heading and course', () => {
    const el = document.createElement('div')
    expect(() => renderHSI(el, { heading: NaN })).toThrow(RangeError)
    expect(() => renderHSI(el, { heading: 0, course: NaN })).toThrow(RangeError)
  })
})

describe('the compass card', () => {
  it('draws 72 ticks and the 12 G1000-style labels', () => {
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

  // Geometry, not just a count: the ticks moved with the rose centre in this
  // task, and a tick ring still centred on the old (100, 100) would render 72
  // ticks off-axis and pass the count above.
  it('hangs every tick off the exported tick radius, about the rose centre', () => {
    const ticks = [...render({ heading: 0 }).querySelectorAll('.hsi-tick')]
    for (const tick of ticks) {
      expect(radiusFromCentre(num(tick, 'x1'), num(tick, 'y1'))).toBeCloseTo(LAYOUT.tickR, 1)
    }
    // ticks are generated from 0° up, so the first one points at the card's N
    const north = ticks[0]!
    expect(num(north, 'x1')).toBeCloseTo(LAYOUT.cx, 6)
    expect(num(north, 'y1')).toBeCloseTo(LAYOUT.cy - LAYOUT.tickR, 6)
  })

  it('sets the 30° labels on the card at the exported label radius', () => {
    const labels = [...render({ heading: 0 }).querySelectorAll('.hsi-label')]
    const north = labels[0]!
    expect(north.textContent).toBe('N')
    expect(num(north, 'x')).toBe(LAYOUT.cx)
    expect(num(north, 'y')).toBe(LAYOUT.cy - LAYOUT.labelR)
    expect(north.getAttribute('transform')).toBe(`rotate(0 ${LAYOUT.cx} ${LAYOUT.cy})`)
    // every label is the same text node rotated into place, so E pins the step
    const east = labels[3]!
    expect(east.textContent).toBe('E')
    expect(east.getAttribute('transform')).toBe(`rotate(90 ${LAYOUT.cx} ${LAYOUT.cy})`)
  })
})

describe('rose rotation (heading up)', () => {
  it('rotates the card so the current heading is under the lubber mark', () => {
    const el = render({ heading: 90 })
    expect(rotationOf(el.querySelector('.hsi-rose'))).toBe(`rotate(-90 ${LAYOUT.cx} ${LAYOUT.cy})`)
  })

  it('heading 0 leaves the card unrotated', () => {
    const el = render({ heading: 0 })
    expect(rotationOf(el.querySelector('.hsi-rose'))).toBe(`rotate(0 ${LAYOUT.cx} ${LAYOUT.cy})`)
  })

  it('normalizes out-of-range headings', () => {
    const el = render({ heading: 450 })
    expect(rotationOf(el.querySelector('.hsi-rose'))).toBe(`rotate(-90 ${LAYOUT.cx} ${LAYOUT.cy})`)
  })
})

describe('airframe-fixed marks', () => {
  it('points the lubber mark down the centreline at the top of the card', () => {
    const lubber = render({ heading: 41 }).querySelector('.hsi-lubber')!
    const points = pointsOf(lubber)
    expect(points).toHaveLength(3)
    const [apex, left, right] = points as [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
    ]
    // apex touches the card edge, so the mark reads against the heading tape
    expect(apex.x).toBeCloseTo(LAYOUT.cx, 6)
    expect(apex.y).toBeCloseTo(LAYOUT.cy - LAYOUT.roseR, 6)
    // and the base sits above it — a triangle pointing down, not up
    expect(left.y).toBeLessThan(apex.y)
    expect(right.y).toBeLessThan(apex.y)
    expect(left.x + right.x).toBeCloseTo(2 * LAYOUT.cx, 6)
  })

  it('keeps the lubber fixed to the airframe, not the rotating card', () => {
    const lubber = render({ heading: 41 }).querySelector('.hsi-lubber')!
    expect(lubber.closest('.hsi-rose')).toBeNull()
  })

  it('centres the aircraft symbol on the rose centre', () => {
    const aircraft = render({ heading: 41 }).querySelector('.hsi-aircraft')!
    const points = coordsOf(aircraft)
    expect(points.length).toBeGreaterThan(3)
    // symmetric left/right about the centreline
    for (const { x } of points) {
      expect(points.some((p) => Math.abs(p.x - (2 * LAYOUT.cx - x)) < 1e-6)).toBe(true)
    }
    // and straddling the centre vertically, so the deviation bar reads across it
    expect(Math.min(...points.map((p) => p.y))).toBeLessThan(LAYOUT.cy)
    expect(Math.max(...points.map((p) => p.y))).toBeGreaterThan(LAYOUT.cy)
    expect(aircraft.closest('.hsi-rose')).toBeNull()
  })

  it('centres the heading readout box above the rose, clear of the card', () => {
    const el = render({ heading: 41 })
    const box = el.querySelector('.hsi-heading-box')!
    expect(num(box, 'x') + num(box, 'width') / 2).toBeCloseTo(LAYOUT.cx, 6)
    expect(num(box, 'y')).toBe(LAYOUT.boxY)
    expect(num(box, 'height')).toBe(LAYOUT.boxH)
    // the box lives above the card, not on top of it
    expect(num(box, 'y') + num(box, 'height')).toBeLessThan(LAYOUT.cy - LAYOUT.roseR)
    expect(box.closest('.hsi-rose')).toBeNull()
  })

  it('shows the heading through courseText — three digits, 0 shown as 360', () => {
    expect(render({ heading: 90 }).querySelector('.hsi-heading-readout')!.textContent).toBe('090°')
    expect(render({ heading: 5 }).querySelector('.hsi-heading-readout')!.textContent).toBe('005°')
    expect(render({ heading: 0 }).querySelector('.hsi-heading-readout')!.textContent).toBe('360°')
    // and it is that function, not a second rounding rule that agrees on those
    for (const heading of [0.4, 129.6, 359.5]) {
      const text = render({ heading }).querySelector('.hsi-heading-readout')!.textContent
      expect(text, `heading ${heading}`).toBe(courseText(heading))
    }
  })

  // Avionics readouts are monospaced so the digits do not shuffle sideways as
  // the value changes; a proportional stack makes a live heading jitter.
  it('sets the readout digits in a monospace stack', () => {
    const readout = render({ heading: 41 }).querySelector('.hsi-heading-readout')!
    expect(readout.getAttribute('font-family')).toMatch(/monospace/)
  })
})

describe('course pointer', () => {
  it('sits at the course position on the card (rotates with the rose)', () => {
    const el = render({ heading: 90, course: 340 })
    const pointer = el.querySelector('.hsi-course')
    expect(rotationOf(pointer)).toBe(`rotate(340 ${LAYOUT.cx} ${LAYOUT.cy})`)
    // inside the rotating rose group, so on screen it appears at course − heading
    expect(pointer!.closest('.hsi-rose')).not.toBeNull()
  })

  it('is absent when no course is given', () => {
    expect(render({ heading: 90 }).querySelector('.hsi-course')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Deviation indication. Sign conventions invert easily and an inverted needle
// looks subtly plausible, so every golden below was drawn on paper first and
// then written down — never read back out of the renderer, and never
// re-derived by calling `courseDeviation` inside the expectation. That last one
// is the `turnToInbound` tautology verbatim: renderer and expectation would
// flip together the moment the engine flipped.
// ─────────────────────────────────────────────────────────────────────────────

/** Deviation bar's x, checked to be vertical (it slides; it never tilts). */
function barX(props: HSIProps): number {
  const bar = render(props).querySelector('.hsi-cdi-bar')
  expect(bar, 'no deviation bar drawn').not.toBeNull()
  const x1 = num(bar!, 'x1')
  expect(num(bar!, 'x2')).toBeCloseTo(x1, 6)
  return x1
}

describe('the no-nav contract', () => {
  // `written-test.ts` renders this instrument for every entry question with a
  // heading and a course and nothing else — it has no aircraft position at all.
  // A real HSI *removes* the deviation indication when it has no valid nav
  // data; it does not centre it, which would read as "established on course"
  // on a graded question. That contract was unspecified until this task.
  it('draws the course pointer and no deviation indication when nav is absent', () => {
    const el = render({ heading: 90, course: 340 })
    expect(el.querySelector('.hsi-course')).not.toBeNull()
    expect(el.querySelector('.hsi-cdi-bar')).toBeNull()
    expect(el.querySelectorAll('.hsi-cdi-dot')).toHaveLength(0)
    expect(el.querySelector('.hsi-tofrom')).toBeNull()
  })

  it('drops the whole assembly when no course is given', () => {
    const el = render({ heading: 90 })
    expect(el.querySelector('.hsi-course')).toBeNull()
    expect(el.querySelector('.hsi-cdi-bar')).toBeNull()
    expect(el.querySelectorAll('.hsi-cdi-dot')).toHaveLength(0)
    expect(el.querySelector('.hsi-tofrom')).toBeNull()
  })

  // A deviation with nothing to deviate from is a caller mistake, not a
  // drawing decision — silently rendering nothing would hide it.
  it('rejects nav data with no course to deviate from', () => {
    const el = document.createElement('div')
    const nav = { fix: FIX, distanceNm: 8 }
    expect(() => renderHSI(el, { heading: 90, nav })).toThrow(TypeError)
  })

  // Over the fix the cross-track is 0 for every heading and the sense has no
  // geometric meaning, so `courseDeviation` rejects it rather than let a
  // caller depict it. The instrument must not swallow that.
  it('propagates the engine’s rejection of a non-positive distance', () => {
    const el = document.createElement('div')
    for (const distanceNm of [0, -4]) {
      expect(() =>
        renderHSI(el, { heading: 90, course: 90, nav: { fix: FIX, distanceNm } }),
      ).toThrow(RangeError)
    }
  })
})

describe('deviation bar', () => {
  it('lands one dot right of centre for a half-scale left cross-track', () => {
    // Drawn first: course 090 runs east through the fix. Heading 120 tracking
    // direct means the aircraft lies on the 300 bearing FROM the fix, 1.0 NM
    // out — 0.87 NM west of it and 0.50 NM north of it. The course line runs
    // east, so north of it is the aircraft's LEFT: cross-track −0.50 NM.
    // The needle shows where the course is, not where you are, so the course
    // lies 0.50 NM to the aircraft's RIGHT and the bar deflects right of
    // centre by 0.50 NM × 30 px/NM = 15 px — exactly the inner (half-scale) dot.
    //
    // ⚠️ 1.0 NM is deliberately shorter than any distance the drill generates.
    // An unpegged needle *requires* a distance inside FULL_SCALE_NM, and the
    // shipping app never produces one (see "Two accepted consequences" in
    // docs/plans/20260807-g1000-hsi.md). Do not "fix" this to a realistic
    // distance — the golden would peg and stop measuring the arithmetic.
    expect(barX({ heading: 120, course: 90, nav: { fix: FIX, distanceNm: 1 } })).toBeCloseTo(
      LAYOUT.cx + 15,
      6,
    )
  })

  it('deflects LEFT when the aircraft is RIGHT of the course', () => {
    // Course 090 again, heading 060 at 1.0 NM: tracking direct puts the
    // aircraft on the 240 bearing from the fix — 0.87 NM west and 0.50 NM
    // SOUTH. South of an eastbound course is its RIGHT, cross-track +0.50 NM.
    // Fly toward the needle: the course is off the left wing, so the bar sits
    // left of centre, on the inner dot at cx − 15.
    expect(barX({ heading: 60, course: 90, nav: { fix: FIX, distanceNm: 1 } })).toBeCloseTo(
      LAYOUT.cx - 15,
      6,
    )
  })

  it('pegs on the outer dot instead of sliding off the card', () => {
    // Course 090, heading 180 at 8 NM: the aircraft lies on the 360 bearing
    // from the fix, i.e. 8 NM due north of it — 8 NM LEFT of the eastbound
    // course, eight times full scale. The bar deflects right and stops on the
    // outer dot.
    const full = FULL_SCALE_NM * PX_PER_NM
    expect(barX({ heading: 180, course: 90, nav: { fix: FIX, distanceNm: 8 } })).toBeCloseTo(
      LAYOUT.cx + full,
      6,
    )
    // Mirrored: heading 000 at 8 NM sits 8 NM due south of the fix, 8 NM RIGHT
    // of the same course, so the bar pegs on the opposite outer dot.
    expect(barX({ heading: 0, course: 90, nav: { fix: FIX, distanceNm: 8 } })).toBeCloseTo(
      LAYOUT.cx - full,
      6,
    )
  })

  it('centres exactly on course', () => {
    // Heading = course: the aircraft is on the course line, dead ahead of it.
    expect(barX({ heading: 90, course: 90, nav: { fix: FIX, distanceNm: 8 } })).toBeCloseTo(
      LAYOUT.cx,
      6,
    )
  })

  // Bar and dots are two readings of one scale, so this is drawn-against-drawn
  // rather than against a constant: it keeps binding if PX_PER_NM is re-tuned,
  // which a pair of hand-typed pixel goldens would not. (Swapping PX_PER_NM for
  // a literal of the *same* value is undetectable by construction — nothing can
  // see the difference; this is what catches the two drifting apart afterwards.)
  it('puts a half-scale deflection exactly on the drawn inner dot', () => {
    const el = render({ heading: 120, course: 90, nav: { fix: FIX, distanceNm: 1 } })
    const bar = el.querySelector('.hsi-cdi-bar')!
    const dots = [...el.querySelectorAll('.hsi-cdi-dot')].map((d) => num(d, 'cx'))
    expect(dots).toContain(num(bar, 'x1'))
  })
})

describe('deviation dots', () => {
  it('draws DEVIATION_DOTS a side, evenly spaced out to full scale', () => {
    const el = render({ heading: 90, course: 90, nav: { fix: FIX, distanceNm: 8 } })
    const dots = [...el.querySelectorAll('.hsi-cdi-dot')]
    expect(dots).toHaveLength(2 * DEVIATION_DOTS)
    const full = FULL_SCALE_NM * PX_PER_NM
    const expected: number[] = []
    for (let i = DEVIATION_DOTS; i >= 1; i -= 1) {
      expected.push((-i * full) / DEVIATION_DOTS)
    }
    for (let i = 1; i <= DEVIATION_DOTS; i += 1) {
      expected.push((i * full) / DEVIATION_DOTS)
    }
    const offsets = dots.map((d) => num(d, 'cx') - LAYOUT.cx).sort((a, b) => a - b)
    expect(offsets).toEqual(expected)
    // and they lie on the lateral line through the centre, where the bar reads
    for (const dot of dots) {
      expect(num(dot, 'cy')).toBe(LAYOUT.cy)
    }
  })
})

describe('TO/FROM flag', () => {
  function flag(props: HSIProps): Element {
    const el = render(props).querySelector('.hsi-tofrom')
    expect(el, 'no TO/FROM flag drawn').not.toBeNull()
    return el!
  }

  /** Apex, and the midpoint of the base — a triangle points where its apex is. */
  function pointing(el: Element): { apexY: number; baseY: number } {
    const pts = pointsOf(el)
    expect(pts).toHaveLength(3)
    const [apex, left, right] = pts as [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
    ]
    return { apexY: apex.y, baseY: (left.y + right.y) / 2 }
  }

  it('points up the course arrow when the course closes on the fix', () => {
    // Course 090, heading 090, 5 NM out: tracking direct, the aircraft is 5 NM
    // west of the fix flying east at it, so following 090 from here reaches the
    // fix — TO. The flag points toward the arrowhead, up the local course line.
    const f = flag({ heading: 90, course: 90, nav: { fix: FIX, distanceNm: 5 } })
    expect(f.getAttribute('data-sense')).toBe('to')
    const { apexY, baseY } = pointing(f)
    expect(apexY).toBeLessThan(baseY) // apex above its base: pointing up
    expect(apexY).toBeLessThan(LAYOUT.cy) // and sitting on the arrowhead's side
  })

  it('points down the tail when the course opens away from the fix', () => {
    // Course 090, heading 270, 5 NM out: tracking direct on 270 means the fix
    // is west of the aircraft, so the aircraft is 5 NM EAST of it. Following
    // 090 from there flies away from the fix — FROM.
    const f = flag({ heading: 270, course: 90, nav: { fix: FIX, distanceNm: 5 } })
    expect(f.getAttribute('data-sense')).toBe('from')
    const { apexY, baseY } = pointing(f)
    expect(apexY).toBeGreaterThan(baseY) // apex below its base: pointing down
    expect(apexY).toBeGreaterThan(LAYOUT.cy) // and sitting on the tail's side
  })
})

describe('the course assembly rides the compass card', () => {
  it('composes to course − heading on screen, not to the local rotate()', () => {
    // heading 041, course 300 — both non-zero, so the composed angle is
    // distinguishable from either term: −41 + 300 = 259° on screen.
    const el = render({ heading: 41, course: 300, nav: { fix: FIX, distanceNm: 8 } })
    for (const selector of ['.hsi-course', '.hsi-cdi-bar', '.hsi-cdi-dot', '.hsi-tofrom']) {
      const node = el.querySelector(selector)
      expect(node, selector).not.toBeNull()
      expect(composedRotation(node!), selector).toBeCloseTo(259, 6)
    }
  })
})

describe('the selected-value boxes', () => {
  it('shows the selected heading in the HDG box, in the bug’s own colour', () => {
    const el = render({ heading: 41, headingBug: 120 })
    const value = el.querySelector('.hsi-hdg-value')!
    expect(el.querySelector('.hsi-hdg-label')!.textContent).toBe('HDG')
    // the *selected* heading, not the current one — those differ here on purpose
    expect(value.textContent).toBe(courseText(120))
    expect(value.getAttribute('fill')).toBe(PALETTE.pfd.bug)
    expect(value.getAttribute('font-family')).toMatch(/monospace/)
  })

  it('shows the selected course in the CRS box, in the pointer’s own colour', () => {
    const el = render({ heading: 41, course: 300 })
    const value = el.querySelector('.hsi-crs-value')!
    expect(el.querySelector('.hsi-crs-label')!.textContent).toBe('CRS')
    expect(value.textContent).toBe(courseText(300))
    expect(value.getAttribute('fill')).toBe(PALETTE.pfd.course)
    expect(value.getAttribute('font-family')).toMatch(/monospace/)
  })

  it('renders both values through courseText — three digits, 0 shown as 360', () => {
    const el = render({ heading: 41, headingBug: 0, course: 5 })
    expect(el.querySelector('.hsi-hdg-value')!.textContent).toBe('360°')
    expect(el.querySelector('.hsi-crs-value')!.textContent).toBe('005°')
  })

  // A box with nothing selected in it is a readout of nothing. The written
  // test's entry figure selects a course but no heading, so it gets one box.
  it('omits each box when its value is not selected', () => {
    const noBug = render({ heading: 41, course: 300 })
    expect(noBug.querySelector('.hsi-hdg-box')).toBeNull()
    expect(noBug.querySelector('.hsi-crs-box')).not.toBeNull()
    const noCourse = render({ heading: 41 })
    expect(noCourse.querySelector('.hsi-crs-box')).toBeNull()
    expect(noCourse.querySelector('.hsi-hdg-box')).toBeNull()
  })

  it('flanks the heading readout without overlapping it or the panel edge', () => {
    const el = render({ heading: 41, headingBug: 41, course: 300 })
    const span = (selector: string): readonly [number, number] => {
      const box = el.querySelector(selector)!
      return [num(box, 'x'), num(box, 'x') + num(box, 'width')] as const
    }
    const [hdgL, hdgR] = span('.hsi-hdg-box')
    const [crsL, crsR] = span('.hsi-crs-box')
    const [readL, readR] = span('.hsi-heading-box')
    expect(hdgL).toBeGreaterThanOrEqual(0)
    expect(crsR).toBeLessThanOrEqual(LAYOUT.width)
    expect(hdgR).toBeLessThan(readL) // HDG left of the current heading
    expect(crsL).toBeGreaterThan(readR) // CRS right of it
    // one row across the top of the panel, so all three read together
    for (const selector of ['.hsi-hdg-box', '.hsi-crs-box']) {
      const box = el.querySelector(selector)!
      expect(num(box, 'y'), selector).toBe(LAYOUT.boxY)
      expect(num(box, 'height'), selector).toBe(LAYOUT.boxH)
      expect(box.closest('.hsi-rose'), selector).toBeNull()
    }
  })
})

describe('the heading bug', () => {
  it('rides the card at the selected heading, not under the nose', () => {
    // heading 041, bug 120 — different and both non-zero, so the composed
    // screen angle (120 − 41 = 79°) is distinguishable from either term and
    // from its own negation. The drill parks the bug on the current heading,
    // where the composed angle is a constant 0 that an inverted rotation
    // satisfies exactly as well as the right one.
    const bug = render({ heading: 41, headingBug: 120 }).querySelector('.hsi-bug')!
    expect(bug.closest('.hsi-rose'), 'the bug marks a magnetic heading').not.toBeNull()
    expect(composedRotation(bug)).toBeCloseTo(79, 6)
  })

  it('sits on the outer edge of the card, where the lubber reads', () => {
    const bug = render({ heading: 0, headingBug: 120 }).querySelector('.hsi-bug')!
    const radii = pointsOf(bug).map((p) => radiusFromCentre(p.x, p.y))
    expect(radii.length).toBeGreaterThan(2)
    // its inner edge touches the card…
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(LAYOUT.roseR)
    expect(Math.min(...radii)).toBeLessThan(LAYOUT.roseR + 1)
    // …and it does not reach out across the value boxes
    expect(Math.max(...radii)).toBeLessThan(LAYOUT.roseR + 12)
  })

  it('is absent when no heading is selected', () => {
    expect(render({ heading: 41 }).querySelector('.hsi-bug')).toBeNull()
  })
})

describe('the nav status line', () => {
  function status(props: HSIProps): Element {
    const line = render(props).querySelector('.hsi-status')
    expect(line, 'no nav status line drawn').not.toBeNull()
    return line!
  }

  function field(line: Element, selector: string): string {
    const node = line.querySelector(selector)
    expect(node, `no ${selector} in the status line`).not.toBeNull()
    return node!.textContent ?? ''
  }

  it('names the source, the fix and the distance', () => {
    const line = status({ heading: 90, course: 90, nav: { fix: FIX, distanceNm: 12.4 } })
    expect(field(line, '.hsi-nav-source')).toBe('GPS')
    expect(field(line, '.hsi-nav-fix')).toBe(FIX)
    expect(field(line, '.hsi-nav-distance')).toBe('12.4 NM')
  })

  // Same rule as the heading readout's `courseText`: the drill screen shows
  // this distance in prose beside the panel, so a second rounding here would
  // put two different numbers for one aircraft on one screen.
  it('renders the distance through distanceText, not a second rounding rule', () => {
    for (const distanceNm of [3, 12.44, 12.46]) {
      const line = status({ heading: 90, course: 90, nav: { fix: FIX, distanceNm } })
      expect(field(line, '.hsi-nav-distance'), `${distanceNm} NM`).toBe(distanceText(distanceNm))
    }
  })

  // Not decoration: with GPS as the nav source and an active leg a real G1000
  // has an inoperative CRS knob and auto-slews the CDI, so the picture this
  // instrument draws — a manually selected course with a live deflection —
  // occurs in OBS/SUSP mode and nowhere else.
  it('annunciates OBS, the only mode this picture occurs in', () => {
    const line = status({ heading: 90, course: 90, nav: { fix: FIX, distanceNm: 5 } })
    expect(field(line, '.hsi-obs')).toBe('OBS')
  })

  it('reads TO when the course closes on the fix and FROM when it opens away', () => {
    // Course 090, heading 090 at 5 NM: tracking direct, the aircraft is 5 NM
    // west of the fix flying east at it, so following 090 reaches it — TO.
    expect(
      field(
        status({ heading: 90, course: 90, nav: { fix: FIX, distanceNm: 5 } }),
        '.hsi-nav-sense',
      ),
    ).toBe('TO')
    // Course 090, heading 270 at 5 NM: the fix is west of the aircraft, so the
    // aircraft is 5 NM east of it and following 090 flies away — FROM.
    expect(
      field(
        status({ heading: 270, course: 90, nav: { fix: FIX, distanceNm: 5 } }),
        '.hsi-nav-sense',
      ),
    ).toBe('FROM')
  })

  // The word and the glyph are two renderings of one flag, drawn in different
  // groups — the glyph rides the rotating course assembly, the word is fixed to
  // the airframe at the panel's foot — so nothing structural stops a future
  // change computing them separately and letting them disagree. On a panel,
  // two flags that contradict each other are worse than either alone.
  it('agrees with the TO/FROM glyph on the card', () => {
    for (const heading of [90, 270, 41, 200]) {
      const el = render({ heading, course: 90, nav: { fix: FIX, distanceNm: 5 } })
      const word = el.querySelector('.hsi-nav-sense')!.textContent ?? ''
      const glyph = el.querySelector('.hsi-tofrom')!.getAttribute('data-sense')
      expect(word.toLowerCase(), `heading ${heading}`).toBe(glyph)
    }
  })

  // The written test's entry figure again: heading and course, no position at
  // all. A status line there would invent a fix and a distance.
  it('is absent when the instrument has no nav data', () => {
    const el = render({ heading: 90, course: 340 })
    expect(el.querySelector('.hsi-status')).toBeNull()
    expect(el.querySelector('.hsi-nav-distance')).toBeNull()
    expect(el.querySelector('.hsi-nav-sense')).toBeNull()
    expect(el.querySelector('.hsi-obs')).toBeNull()
  })

  it('sits below the card, inside the panel, fixed to the airframe', () => {
    const line = status({ heading: 90, course: 90, nav: { fix: FIX, distanceNm: 5 } })
    const fields = [...line.querySelectorAll('text')]
    expect(fields).toHaveLength(5)
    for (const node of fields) {
      const where = node.getAttribute('class') ?? ''
      expect(num(node, 'y'), where).toBeGreaterThan(LAYOUT.cy + LAYOUT.roseR)
      expect(num(node, 'y'), where).toBeLessThanOrEqual(LAYOUT.height)
      expect(num(node, 'x'), where).toBeGreaterThanOrEqual(0)
      expect(num(node, 'x'), where).toBeLessThanOrEqual(LAYOUT.width)
    }
    expect(line.closest('.hsi-rose')).toBeNull()
  })
})

describe('the accessible description', () => {
  function label(props: HSIProps): string {
    return render(props).querySelector('svg')!.getAttribute('aria-label') ?? ''
  }

  it('names heading and course when there is no nav data', () => {
    const text = label({ heading: 41, course: 300 })
    expect(text).toContain(courseText(41))
    expect(text).toContain(courseText(300))
    expect(text).not.toContain('NM')
  })

  // role="img" hides the SVG's internals, so a screen reader gets this string
  // or none of the picture: every field on the panel has to be in it.
  it('names heading, course, fix, distance and sense when it has nav data', () => {
    // heading 041 with course 300: tracking direct puts the aircraft southwest
    // of the fix, which bears 041 from it. Following 300 from there differs
    // from 041 by 101°, more than a right angle, so the course opens away —
    // FROM, hand-derived rather than read back off the flag.
    const text = label({
      heading: 41,
      course: 300,
      headingBug: 41,
      nav: { fix: FIX, distanceNm: 12.4 },
    })
    expect(text).toContain(courseText(41))
    expect(text).toContain(courseText(300))
    expect(text).toContain(FIX)
    expect(text).toContain(distanceText(12.4))
    expect(text).toContain('FROM')
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

  // All three, not just the first: the wedges are emitted by one `map`, but a
  // later change that draws one of them separately (the entry being flown, say)
  // could park it in the airframe-fixed half, where it would stand still while
  // the card turned under it — and a check on `direct` alone would stay green.
  it('sectors are magnetic: they rotate with the card', () => {
    const el = render({ heading: 90, sectorOverlay: result.sectors })
    for (const entry of ['direct', 'teardrop', 'parallel'] as const) {
      const wedge = el.querySelector(`.hsi-sector-${entry}`)
      expect(wedge, entry).not.toBeNull()
      expect(wedge!.closest('.hsi-rose'), entry).not.toBeNull()
    }
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

// What the overlays are *painted with*, as opposed to where they are drawn.
// Both facts are load-bearing and neither was asserted here: palette.test.ts
// composites `PALETTE.pfd.entry.*` at `OVERLAY_ALPHA.*` and judges the result,
// but it reads this file only as source text — its scans say no colour literal
// exists and every alpha comes from `OVERLAY_ALPHA`, which a wedge painted in
// `pfd.card` at `OVERLAY_ALPHA.thumbBand` satisfies exactly. Then the measured
// picture and the drawn one are different pictures.
describe('overlay paint (the colours palette.test.ts composites)', () => {
  const sectors = determineEntry(90, { inboundCourse: 340, turnDirection: 'right' }).sectors
  const ENTRIES = ['direct', 'teardrop', 'parallel'] as const

  it('paints each wedge in its own entry colour, from the PFD group', () => {
    const el = render({ heading: 90, sectorOverlay: sectors })
    for (const entry of ENTRIES) {
      const wedge = el.querySelector(`.hsi-sector-${entry}`)!
      // the PFD copy, not the plan view's: the two are held to one hue but the
      // plate values are tuned for white paper and go dark-on-dark here
      expect(wedge.getAttribute('fill'), entry).toBe(PALETTE.pfd.entry[entry])
      expect(wedge.getAttribute('stroke'), entry).toBe(PALETTE.pfd.entry[entry])
    }
  })

  // The boundary carries the sector; the fill only tints it. That split is not
  // a style choice — the two cannot both be strong: a fill dark enough to reach
  // SC 1.4.11's 3:1 against the face on its own drops the dim ticks crossing it
  // to 2.2:1 (computed in palette.test.ts). The source scan there bans
  // `stroke-opacity=` in this file, but it cannot see a wedge that stopped
  // being stroked at all, which loses the sector the same way from the far side.
  it('tints the wedge and leaves its boundary at full strength', () => {
    const el = render({ heading: 90, sectorOverlay: sectors })
    for (const entry of ENTRIES) {
      const wedge = el.querySelector(`.hsi-sector-${entry}`)!
      expect(Number(wedge.getAttribute('fill-opacity')), entry).toBe(OVERLAY_ALPHA.sectorFill)
      expect(wedge.getAttribute('stroke-opacity'), entry).toBeNull()
      expect(num(wedge, 'stroke-width'), entry).toBeGreaterThan(0)
    }
  })

  // The band is the teardrop colour because that is the entry the shortcut
  // resolves, and it is drawn at its own alpha — a solid marker, not a tint,
  // and measured as one.
  it('paints the thumb band in the teardrop colour at the band alpha', () => {
    const band = render({ heading: 123, thumbOverlay: 'right' }).querySelector('.hsi-thumb')!
    expect(band.getAttribute('fill')).toBe(PALETTE.pfd.entry.teardrop)
    expect(Number(band.getAttribute('fill-opacity'))).toBe(OVERLAY_ALPHA.thumbBand)
    expect(band.getAttribute('stroke-opacity')).toBeNull()
  })
})

// The overlays were previously checked only through data-from/data-to, which
// echo the inputs: an inverted polar() or a flipped sweep flag would paint the
// wrong side of the card and still pass.
describe('overlay geometry (drawn arcs, not just their data attributes)', () => {
  /** The card convention under test: 0° at the top, clockwise, y grows down. */
  function cardPoint(deg: number, radius: number): { x: number; y: number } {
    const rad = (deg * Math.PI) / 180
    return { x: LAYOUT.cx + radius * Math.sin(rad), y: LAYOUT.cy - radius * Math.cos(rad) }
  }

  it('a sector wedge sweeps clockwise between its two boundary radii', () => {
    const sectors = determineEntry(340, { inboundCourse: 340, turnDirection: 'right' }).sectors
    const path = render({ heading: 0, sectorOverlay: sectors })
      .querySelector('.hsi-sector-direct')!
      .getAttribute('d')!
    const m = path.match(
      new RegExp(
        `^M ${LAYOUT.cx} ${LAYOUT.cy} L (\\S+) (\\S+) A (\\S+) \\S+ 0 (\\d) (\\d) (\\S+) (\\S+) Z$`,
      ),
    )
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
    const m = path.match(/^M (\S+) (\S+) A (\S+) /)
    expect(m, path).not.toBeNull()
    const [, ax, ay, outer] = m!
    const start = cardPoint(70, Number(outer))
    expect(Number(ax)).toBeCloseTo(start.x, 1)
    expect(Number(ay)).toBeCloseTo(start.y, 1)
    expect(Number(ax)).toBeGreaterThan(LAYOUT.cx) // right of the nose, not left
  })
})
