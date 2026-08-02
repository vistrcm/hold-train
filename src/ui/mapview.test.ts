import { describe, expect, it } from 'vitest'
import { ENTRIES, entryGuidance } from '../engine/entry'
import { renderMap, type MapProps } from './mapview'

const MIN_LEG = { unit: 'min', value: 1 } as const // 1.5 NM at ~90 kt

function hold(overrides: Partial<MapProps['holdSpec']> = {}): MapProps['holdSpec'] {
  return { fix: 'HAIRE', inboundCourse: 0, turnDirection: 'right', leg: MIN_LEG, ...overrides }
}

function render(props: MapProps): HTMLElement {
  const el = document.createElement('div')
  renderMap(el, props)
  return el
}

/** All numbers in an attribute string, in order. */
function nums(s: string | null): number[] {
  return (s?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
}

function scaleOf(el: HTMLElement): number {
  return Number(el.querySelector('svg')!.getAttribute('data-scale'))
}

// racetrack d = M Sx Sy L Fx Fy A r r 0 0 sw F'x F'y L S'x S'y A r r 0 0 sw Sx Sy Z
// nums indices:   0  1    2  3    4 5 6 7 8   9  10    11  12   ...      17(sw)
function racetrackNums(el: HTMLElement): number[] {
  return nums(el.querySelector('.map-racetrack')!.getAttribute('d'))
}

describe('renderMap basics', () => {
  it('renders one scalable north-up svg into the container', () => {
    const el = render({ holdSpec: hold() })
    const svgs = el.querySelectorAll('svg')
    expect(svgs).toHaveLength(1)
    const svg = svgs[0]!
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 200')
    // no fixed pixel size — CSS scales it to the container (320 px phones)
    expect(svg.getAttribute('width')).toBeNull()
    expect(svg.getAttribute('height')).toBeNull()
    expect(svg.classList.contains('mapview')).toBe(true)
    expect(svg.getAttribute('role')).toBe('img')
    expect(el.querySelector('.map-north')).not.toBeNull()
  })

  it('re-render replaces previous content instead of appending', () => {
    const el = document.createElement('div')
    renderMap(el, { holdSpec: hold() })
    renderMap(el, { holdSpec: hold({ inboundCourse: 90 }) })
    expect(el.querySelectorAll('svg')).toHaveLength(1)
  })

  it('scales for 1-minute legs and shrinks DME-leg patterns to fit', () => {
    const oneMin = scaleOf(render({ holdSpec: hold() }))
    const dme = scaleOf(render({ holdSpec: hold({ leg: { unit: 'nm', value: 4 } }) }))
    expect(oneMin).toBeGreaterThan(0)
    expect(dme).toBeGreaterThan(0)
    expect(dme).toBeLessThan(oneMin)
  })

  it('keeps the racetrack inside the viewBox, including 4 NM legs', () => {
    for (const leg of [MIN_LEG, { unit: 'nm', value: 4 } as const]) {
      for (const v of racetrackNums(render({ holdSpec: hold({ leg }) }))) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(200)
      }
    }
  })
})

describe('racetrack geometry (fix at center, north-up)', () => {
  it('inbound course 360, right turns: inbound leg runs south-to-fix', () => {
    const el = render({ holdSpec: hold() })
    const sc = scaleOf(el)
    const d = racetrackNums(el)
    // start of inbound leg is 1.5 NM south of the fix
    expect(d[0]).toBeCloseTo(100, 1)
    expect(d[1]).toBeCloseTo(100 + 1.5 * sc, 1)
    // inbound leg ends at the fix (viewBox center)
    expect(d[2]).toBeCloseTo(100, 1)
    expect(d[3]).toBeCloseTo(100, 1)
    expect(el.querySelector('.map-racetrack')!.getAttribute('data-turn')).toBe('right')
  })

  it('right turns put the outbound leg on the holding side (east of course 360)', () => {
    const el = render({ holdSpec: hold() })
    const sc = scaleOf(el)
    const d = racetrackNums(el)
    // end of the fix-end turn: one turn diameter (2 × 0.48 NM) east of the fix
    expect(d[9]).toBeCloseTo(100 + 0.96 * sc, 1)
    expect(d[10]).toBeCloseTo(100, 1)
    // turns drawn clockwise on screen
    expect(d[8]).toBe(1)
    expect(d[17]).toBe(1)
  })

  it('nonstandard (left turns) mirrors the racetrack to the west side', () => {
    const el = render({ holdSpec: hold({ turnDirection: 'left' }) })
    const sc = scaleOf(el)
    const d = racetrackNums(el)
    expect(d[9]).toBeCloseTo(100 - 0.96 * sc, 1)
    expect(d[10]).toBeCloseTo(100, 1)
    expect(d[8]).toBe(0)
    expect(d[17]).toBe(0)
    expect(el.querySelector('.map-racetrack')!.getAttribute('data-turn')).toBe('left')
  })

  it('rotates with the course: inbound 090 right turns holds south of the fix', () => {
    const el = render({ holdSpec: hold({ inboundCourse: 90 }) })
    const sc = scaleOf(el)
    const d = racetrackNums(el)
    // inbound leg starts 1.5 NM west of the fix
    expect(d[0]).toBeCloseTo(100 - 1.5 * sc, 1)
    expect(d[1]).toBeCloseTo(100, 1)
    // holding side is south (right of an eastbound course)
    expect(d[9]).toBeCloseTo(100, 1)
    expect(d[10]).toBeCloseTo(100 + 0.96 * sc, 1)
  })

  it('DME legs draw at charted length: 4 NM inbound leg', () => {
    const el = render({ holdSpec: hold({ leg: { unit: 'nm', value: 4 } }) })
    const sc = scaleOf(el)
    const d = racetrackNums(el)
    expect(d[1]).toBeCloseTo(100 + 4 * sc, 1)
  })

  it('shows direction of flight on the inbound leg', () => {
    expect(render({ holdSpec: hold() }).querySelector('.map-course-arrow')).not.toBeNull()
  })
})

describe('fix marker', () => {
  it('draws the fix at center with its name', () => {
    const el = render({ holdSpec: hold() })
    expect(el.querySelector('.map-fix')).not.toBeNull()
    expect(el.querySelector('.map-fix-label')!.textContent).toBe('HAIRE')
  })

  it('omits the label when the fix is unnamed', () => {
    const el = render({ holdSpec: hold({ fix: undefined }) })
    expect(el.querySelector('.map-fix')).not.toBeNull()
    expect(el.querySelector('.map-fix-label')).toBeNull()
  })
})

describe('ownship', () => {
  it('is placed at its NM offset from the fix, rotated to heading', () => {
    const el = render({
      holdSpec: hold(),
      ownship: { position: { e: 1, n: 0.5 }, heading: 45 },
    })
    const sc = scaleOf(el)
    const ship = el.querySelector('.map-ownship')!
    const t = nums(ship.getAttribute('transform'))
    expect(t[0]).toBeCloseTo(100 + 1 * sc, 1)
    expect(t[1]).toBeCloseTo(100 - 0.5 * sc, 1)
    expect(t[2]).toBeCloseTo(45, 1)
  })

  it('normalizes out-of-range headings', () => {
    const el = render({ holdSpec: hold(), ownship: { position: { e: 0, n: 0 }, heading: 450 } })
    expect(nums(el.querySelector('.map-ownship')!.getAttribute('transform'))[2]).toBeCloseTo(90, 1)
  })

  it('is absent when omitted', () => {
    expect(render({ holdSpec: hold() }).querySelector('.map-ownship')).toBeNull()
  })
})

describe('ground track and ghost track', () => {
  it('projects track points NM-east/north → screen', () => {
    const el = render({
      holdSpec: hold(),
      track: [
        { e: 0, n: 0 },
        { e: 0.5, n: -1 },
      ],
    })
    const sc = scaleOf(el)
    const pts = nums(el.querySelector('.map-track')!.getAttribute('points'))
    expect(pts[0]).toBeCloseTo(100, 1)
    expect(pts[1]).toBeCloseTo(100, 1)
    expect(pts[2]).toBeCloseTo(100 + 0.5 * sc, 1)
    expect(pts[3]).toBeCloseTo(100 + 1 * sc, 1)
  })

  it('draws the ghost track as a separate dashed polyline', () => {
    const el = render({
      holdSpec: hold(),
      track: [
        { e: 0, n: 0 },
        { e: 0.1, n: 0.1 },
      ],
      ghostTrack: [
        { e: 0, n: 0 },
        { e: 0.2, n: 0.2 },
      ],
    })
    const ghost = el.querySelector('.map-ghost-track')!
    expect(ghost).not.toBeNull()
    expect(ghost.getAttribute('stroke-dasharray')).not.toBeNull()
    expect(el.querySelector('.map-track')).not.toBeNull()
  })

  it('is absent when omitted or empty', () => {
    const el = render({ holdSpec: hold(), track: [] })
    expect(el.querySelector('.map-track')).toBeNull()
    expect(el.querySelector('.map-ghost-track')).toBeNull()
  })
})

describe('entry-path illustration (engine is the oracle)', () => {
  it('renders entryGuidance fields verbatim for every entry × turn direction', () => {
    for (const turnDirection of ['right', 'left'] as const) {
      for (const entry of ENTRIES) {
        const g = entryGuidance(entry, { inboundCourse: 340, turnDirection })
        const el = render({
          holdSpec: hold({ inboundCourse: 340, turnDirection }),
          entryPath: entry,
        })
        const group = el.querySelector('.map-entry')!
        expect(group, `${entry}/${turnDirection}`).not.toBeNull()
        expect(group.classList.contains(`map-entry-${entry}`)).toBe(true)
        expect(group.getAttribute('data-outbound-heading')).toBe(String(g.outboundHeading))
        expect(group.getAttribute('data-side')).toBe(g.side)
        expect(group.getAttribute('data-turn-to-inbound')).toBe(g.turnToInbound)
      }
    }
  })

  it('teardrop: leg leaves the fix 30° toward the holding side, then pattern-direction turn', () => {
    // course 360, right turns → outbound 180, teardrop heading 150
    const el = render({ holdSpec: hold(), entryPath: 'teardrop' })
    const sc = scaleOf(el)
    const d = nums(el.querySelector('.map-entry path')!.getAttribute('d'))
    // M fix L P1: P1 = 1.5 NM along heading 150 = (0.75 E, -1.299 N)
    expect(d[2]).toBeCloseTo(100 + 0.75 * sc, 1)
    expect(d[3]).toBeCloseTo(100 + 1.299 * sc, 1)
    // >180° turn back to inbound, in the pattern's direction (right → clockwise)
    expect(d[7]).toBe(1) // large-arc
    expect(d[8]).toBe(1) // sweep: right turn
  })

  // Parallel entry path: `d` = M fix L legEnd A rr rr 0 1 sweep rollout L fix,
  // so nums indices are 2,3 = leg end (A4: the non-holding side), 7 = large-arc,
  // 8 = sweep flag (A1: opposes the pattern), 9,10 = rollout point (A2: back on
  // the HOLDING side). The arc centre is not assertable — SVG arcs are
  // endpoint-parameterized — so A2 is measured at the rollout endpoint.
  //
  // ⚠️ The rejoin turn OPPOSES the pattern. AIM 5-3-8 j3(a)'s "turn in the
  // direction of the holding pattern" is spatial (toward the racetrack), not
  // rotational; FIG 5-3-4 draws the teardrop rejoin clockwise and the parallel
  // rejoin counter-clockwise in the same standard-pattern figure. Do not
  // re-derive from ">180°" — it does not discriminate. See
  // docs/parallel-entry-evidence.md before touching a sweep flag here.
  it('parallel: leg on the non-holding side, >180° reintercept turn against the pattern', () => {
    // course 360, right turns → holding side east; parallel leg west of course line,
    // then a counter-clockwise rejoin that crosses back over the course to the east.
    const el = render({ holdSpec: hold(), entryPath: 'parallel' })
    const d = nums(el.querySelector('.map-entry path')!.getAttribute('d'))
    expect(d[2]).toBeLessThan(100) // A4: west = non-holding side
    expect(d[7]).toBe(1) // large-arc flag — a constant in the path template, not evidence
    expect(d[8]).toBe(0) // A1: sweep counter-clockwise, against the right-turn pattern
    expect(d[9]).toBeGreaterThan(100) // A2: rolls out east = holding side
  })

  it('parallel mirrors for a nonstandard hold', () => {
    // course 360, left turns → holding side west; parallel leg east, right rejoin
    const el = render({ holdSpec: hold({ turnDirection: 'left' }), entryPath: 'parallel' })
    const d = nums(el.querySelector('.map-entry path')!.getAttribute('d'))
    expect(d[2]).toBeGreaterThan(100) // A4: east = non-holding side
    expect(d[7]).toBe(1)
    expect(d[8]).toBe(1) // A1: clockwise, against the left-turn pattern
    expect(d[9]).toBeLessThan(100) // A2: rolls out west = holding side
  })

  it('parallel golden case: inbound 140, left turns → rollout northeast of the course', () => {
    // "Hold northwest of the Delta NDB on the one four zero bearing, left turns."
    // Holding side northeast (140 − 90 = 050). Outbound 320 on the southwest side,
    // then a RIGHT (clockwise) rejoin rolling out on 185° (= 140 + 45), 0.67 NM
    // northeast of the course — scale 28.57, centre 100 → (93.3, 62.3).
    const el = render({
      holdSpec: hold({ inboundCourse: 140, turnDirection: 'left' }),
      entryPath: 'parallel',
    })
    const d = nums(el.querySelector('.map-entry path')!.getAttribute('d'))
    expect(d[7]).toBe(1) // large-arc
    expect(d[8]).toBe(1) // sweep: clockwise, opposing the left-turn pattern
    expect(d[9]).toBeCloseTo(93.3, 0)
    expect(d[10]).toBeCloseTo(62.3, 0)
  })

  it('direct: follows the racetrack turn at the fix', () => {
    const el = render({ holdSpec: hold(), entryPath: 'direct' })
    const group = el.querySelector('.map-entry-direct')!
    expect(group).not.toBeNull()
    expect(group.getAttribute('data-turn-to-inbound')).toBe('right')
  })

  it('is absent when not requested', () => {
    expect(render({ holdSpec: hold() }).querySelector('.map-entry')).toBeNull()
  })
})

describe('input validation', () => {
  it('rejects non-positive or non-finite leg lengths', () => {
    expect(() => render({ holdSpec: hold({ leg: { unit: 'min', value: 0 } }) })).toThrow(RangeError)
    expect(() => render({ holdSpec: hold({ leg: { unit: 'nm', value: -4 } }) })).toThrow(RangeError)
    expect(() => render({ holdSpec: hold({ leg: { unit: 'min', value: NaN } }) })).toThrow(
      RangeError,
    )
  })

  it('rejects out-of-range inbound courses (engine convention: [0, 360))', () => {
    expect(() => render({ holdSpec: hold({ inboundCourse: 360 }) })).toThrow(RangeError)
    expect(() => render({ holdSpec: hold({ inboundCourse: NaN }) })).toThrow(RangeError)
  })

  it('rejects a non-finite ownship heading or track point', () => {
    expect(() =>
      render({ holdSpec: hold(), ownship: { position: { e: 0, n: 0 }, heading: NaN } }),
    ).toThrow(RangeError)
    expect(() => render({ holdSpec: hold(), track: [{ e: NaN, n: 0 }] })).toThrow(RangeError)
  })
})
