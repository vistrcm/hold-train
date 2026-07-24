import { describe, it, expect } from 'vitest'
import { normalizeDeg, radialToInboundCourse } from './geometry'
import {
  determineEntry,
  entryGuidance,
  ENTRIES,
  type Entry,
  type HoldCourse,
  type SectorArc,
} from './entry'

// Golden cases hand-derived by drawing and verified against AIM 5-3-8 j3
// FIG 5-3-4 (fetched from faa.gov during implementation): for a STANDARD
// (right-turn) pattern with inbound course C, classify the aircraft heading H
// by d = signed diff from C to H (right positive):
//   direct   (180° sector):  -70 < d < 110
//   teardrop ( 70° sector):  110 <= d <= 180
//   parallel (110° sector): -180 < d <= -70
// Nonstandard (left turns) mirrors the sectors about the holding course
// (AIM 5-3-8 j3: entries are "oriented in relation to the 70 degree line on
// the holding side just as in the standard pattern").

const std = (inboundCourse: number): HoldCourse => ({ inboundCourse, turnDirection: 'right' })
const nonStd = (inboundCourse: number): HoldCourse => ({ inboundCourse, turnDirection: 'left' })

function arcWidth(arc: SectorArc): number {
  return normalizeDeg(arc.to - arc.from) === 0 ? 360 : normalizeDeg(arc.to - arc.from)
}

function accepted(heading: number, hold: HoldCourse): Entry[] {
  const r = determineEntry(heading, hold)
  return [r.primary, ...r.alternates].sort()
}

describe('determineEntry — golden cases, standard pattern (AIM FIG 5-3-4, inbound 270)', () => {
  const hold = std(270)

  it('heading aligned with the inbound course is direct', () => {
    const r = determineEntry(270, hold)
    expect(r.primary).toBe('direct')
    expect(r.alternates).toEqual([])
  })

  it('sector interiors classify per the AIM figure', () => {
    expect(determineEntry(200.1, hold).primary).toBe('direct') // just inside d=-70 edge
    expect(determineEntry(340, hold).primary).toBe('direct') // d=+70
    expect(determineEntry(19, hold).primary).toBe('direct') // d=+109
    expect(determineEntry(60, hold).primary).toBe('teardrop') // d=+150
    expect(determineEntry(85, hold).primary).toBe('teardrop') // d=+175
    expect(determineEntry(150, hold).primary).toBe('parallel') // d=-120
    expect(determineEntry(190, hold).primary).toBe('parallel') // d=-80
  })

  it('the 70° line boundaries accept both adjacent entries', () => {
    expect(accepted(20, hold)).toEqual(['direct', 'teardrop']) // d=+110
    expect(accepted(200, hold)).toEqual(['direct', 'parallel']) // d=-70
  })

  it('heading opposite the inbound course is the classic "parallel or teardrop"', () => {
    expect(accepted(90, hold)).toEqual(['parallel', 'teardrop']) // d=180
  })
})

describe('determineEntry — 160-radial classic (inbound course 340)', () => {
  const inbound = radialToInboundCourse(160) // 340

  it('standard turns: dividers fall at 090/270 (the 70° line) and 160', () => {
    const { sectors } = determineEntry(340, std(inbound))
    expect(sectors.direct).toEqual({ from: 270, to: 90 })
    expect(sectors.teardrop).toEqual({ from: 90, to: 160 })
    expect(sectors.parallel).toEqual({ from: 160, to: 270 })
  })

  it('left turns: the classic 230 divider (160 + 70) appears', () => {
    const { sectors } = determineEntry(340, nonStd(inbound))
    expect(sectors.direct).toEqual({ from: 230, to: 50 })
    expect(sectors.teardrop).toEqual({ from: 160, to: 230 })
    expect(sectors.parallel).toEqual({ from: 50, to: 160 })
  })

  it('standard turns: golden headings', () => {
    expect(determineEntry(340, std(inbound)).primary).toBe('direct')
    expect(determineEntry(120, std(inbound)).primary).toBe('teardrop') // d=+140
    expect(determineEntry(200, std(inbound)).primary).toBe('parallel') // d=-140
  })

  it('left turns: golden headings mirror', () => {
    expect(determineEntry(340, nonStd(inbound)).primary).toBe('direct')
    expect(determineEntry(200, nonStd(inbound)).primary).toBe('teardrop') // d=-140
    expect(determineEntry(120, nonStd(inbound)).primary).toBe('parallel') // d=+140
    expect(accepted(230, nonStd(inbound))).toEqual(['direct', 'teardrop'])
  })
})

describe('determineEntry — sector properties', () => {
  const courses = [0, 45, 90, 137, 180, 270, 340, 359]

  it('sectors are 180/70/110 wide and sum to 360 for both turn directions', () => {
    for (const c of courses) {
      for (const hold of [std(c), nonStd(c)]) {
        const { sectors } = determineEntry(0, hold)
        expect(arcWidth(sectors.direct)).toBe(180)
        expect(arcWidth(sectors.teardrop)).toBe(70)
        expect(arcWidth(sectors.parallel)).toBe(110)
        const total = arcWidth(sectors.direct) + arcWidth(sectors.teardrop) + arcWidth(sectors.parallel)
        expect(total).toBe(360)
      }
    }
  })

  it('sectors tile the circle: each boundary is shared by exactly two sectors', () => {
    for (const c of courses) {
      for (const hold of [std(c), nonStd(c)]) {
        const { sectors } = determineEntry(0, hold)
        const froms = [sectors.direct.from, sectors.teardrop.from, sectors.parallel.from].sort()
        const tos = [sectors.direct.to, sectors.teardrop.to, sectors.parallel.to].sort()
        expect(froms).toEqual(tos)
      }
    }
  })

  it('the primary entry always lies in the sector arc drawn for it', () => {
    // The −70/110/180 offsets are written out three times in entry.ts: in
    // BOUNDARIES, in classify(), and in sectorArcs(). classify() decides the
    // answer the student is graded on; sectorArcs() paints the HSI overlay they
    // read it off. Nothing but this test keeps the two from drifting apart.
    for (const c of courses) {
      for (const hold of [std(c), nonStd(c)]) {
        for (let h = 0; h < 360; h++) {
          const { primary, sectors } = determineEntry(h, hold)
          const arc = sectors[primary]
          const into = normalizeDeg(h - arc.from)
          // Closed arc: a heading exactly on a divider belongs to either
          // neighbour, and the ±5° rule reports both as acceptable anyway.
          expect(into <= arcWidth(arc), `${hold.turnDirection} ${c}: heading ${h} → ${primary}`)
            .toBe(true)
        }
      }
    }
  })

  it('heading equal to the inbound course is always direct', () => {
    for (const c of courses) {
      expect(determineEntry(c, std(c)).primary).toBe('direct')
      expect(determineEntry(c, nonStd(c)).primary).toBe('direct')
    }
  })

  it('nonstandard is the exact mirror of standard about the holding course', () => {
    for (const c of courses) {
      for (let h = 0; h < 360; h++) {
        const mirrored = normalizeDeg(2 * c - h)
        expect(accepted(h, nonStd(c))).toEqual(accepted(mirrored, std(c)))
      }
    }
  })

  it('the primary entry is never listed as its own alternate', () => {
    for (let h = 0; h < 360; h++) {
      const r = determineEntry(h, std(340))
      expect(r.alternates).not.toContain(r.primary)
      expect(r.alternates.length).toBeLessThanOrEqual(1)
    }
  })
})

describe('determineEntry — ±5° boundary tolerance (AIM 5-3-8 j8)', () => {
  const hold = std(0)
  // standard boundaries for inbound 0: headings 110 (d=+110), 290 (d=-70), 180 (d=180)

  it('within 5° of a boundary both adjacent entries are acceptable', () => {
    for (const b of [110, 290, 180]) {
      for (const off of [-5, -3, 0, 3, 5]) {
        const r = determineEntry(normalizeDeg(b + off), hold)
        expect(r.alternates.length, `heading ${b + off}`).toBe(1)
      }
    }
  })

  it('just outside 5° there is a single acceptable entry', () => {
    for (const b of [110, 290, 180]) {
      for (const off of [-6, 6]) {
        const r = determineEntry(normalizeDeg(b + off), hold)
        expect(r.alternates, `heading ${b + off}`).toEqual([])
      }
    }
  })

  it('pairs match the boundary being straddled', () => {
    expect(accepted(107, hold)).toEqual(['direct', 'teardrop'])
    expect(accepted(113, hold)).toEqual(['direct', 'teardrop'])
    expect(accepted(176, hold)).toEqual(['parallel', 'teardrop'])
    expect(accepted(184, hold)).toEqual(['parallel', 'teardrop'])
    expect(accepted(287, hold)).toEqual(['direct', 'parallel'])
    expect(accepted(293, hold)).toEqual(['direct', 'parallel'])
  })

  it('cites FAA sources', () => {
    const r = determineEntry(90, hold)
    expect(r.source).toMatch(/AIM 5-3-8/)
  })
})

describe('entryGuidance', () => {
  // Standard pattern, inbound 270 (AIM FIG 5-3-4): outbound course 090,
  // holding side is north (right turns from a westbound inbound).
  const hold = std(270)

  it('direct: turn with the pattern onto the outbound course', () => {
    const g = entryGuidance('direct', hold)
    expect(g.outboundHeading).toBe(90)
    expect(g.side).toBe('holding')
    expect(g.turnToInbound).toBe('right')
  })

  it('teardrop: 30° offset from outbound toward the holding side, pattern-direction turn', () => {
    const g = entryGuidance('teardrop', hold)
    expect(g.outboundHeading).toBe(60) // 090 offset 30° toward the north/holding side
    expect(g.side).toBe('holding')
    expect(g.turnToInbound).toBe('right')
  })

  // AIM 5-3-8 j3(a): "turn to a heading to parallel the holding course outbound
  // on the nonholding side for one minute, turn IN THE DIRECTION OF THE HOLDING
  // PATTERN through more than 180 degrees, and return to the holding fix or
  // intercept the holding course inbound."
  //
  // Drawn out (inbound 270, right turns, outbound 090): the aircraft parallels
  // outbound on the south (nonholding) side, ending south-east of the fix. The
  // fix then bears roughly 285. A RIGHT turn 090 -> 285 is 195 deg (more than
  // 180); a LEFT turn is 165 deg (less than 180). Only the pattern direction
  // satisfies the AIM's "more than 180 degrees", so the two clauses agree.
  it('parallel: outbound course on the nonholding side, reintercept WITH the pattern', () => {
    const g = entryGuidance('parallel', hold)
    expect(g.outboundHeading).toBe(90)
    expect(g.side).toBe('nonholding')
    expect(g.turnToInbound).toBe('right')
  })

  it('nonstandard mirrors: teardrop offset flips, parallel reintercept is left', () => {
    expect(entryGuidance('teardrop', nonStd(270)).outboundHeading).toBe(120)
    expect(entryGuidance('teardrop', nonStd(270)).turnToInbound).toBe('left')
    expect(entryGuidance('parallel', nonStd(270)).turnToInbound).toBe('left')
    expect(entryGuidance('direct', nonStd(270)).turnToInbound).toBe('left')
  })

  it('every entry reintercepts in the pattern direction (AIM 5-3-8 j3)', () => {
    for (const inbound of [0, 45, 90, 180, 270, 315]) {
      for (const h of [std(inbound), nonStd(inbound)]) {
        for (const e of ENTRIES) {
          expect(entryGuidance(e, h).turnToInbound).toBe(h.turnDirection)
        }
      }
    }
  })

  it('every guidance cites an FAA source', () => {
    for (const e of ENTRIES) {
      expect(entryGuidance(e, hold).source).toMatch(/AIM 5-3-8/)
    }
  })
})

describe('input validation', () => {
  it('rejects non-finite and out-of-range headings', () => {
    expect(() => determineEntry(NaN, std(270))).toThrow(RangeError)
    expect(() => determineEntry(360, std(270))).toThrow(RangeError)
    expect(() => determineEntry(-1, std(270))).toThrow(RangeError)
  })

  it('rejects non-finite and out-of-range inbound courses', () => {
    expect(() => determineEntry(90, std(NaN))).toThrow(RangeError)
    expect(() => determineEntry(90, std(360))).toThrow(RangeError)
    expect(() => entryGuidance('direct', std(-5))).toThrow(RangeError)
  })
})
