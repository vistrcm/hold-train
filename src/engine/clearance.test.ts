import { describe, it, expect } from 'vitest'
import { cardinalFromCourse, normalizeDeg, reciprocal } from './geometry'
import { CHART_HOLDS } from '../content/questions'
import {
  PUBLISHED_HOLDS,
  clearanceText,
  generateClearance,
  gradeCopiedClearance,
  mulberry32,
  type ClearanceFields,
  type CopiedClearance,
} from './clearance'

// Phraseology golden cases follow JO 7110.65BB 4-6-4 (fetched from faa.gov
// during implementation): "HOLD (direction) OF (fix/waypoint) ON (specified
// radial, course, bearing, ...) [(number) MINUTE/MILE LEG] [LEFT/RIGHT TURNS]"
// plus EFC per 4-6-1, in AIM 5-3-8 i element order.

const vorTimed: ClearanceFields = {
  direction: 'W',
  fix: 'Manteca',
  fixKind: 'VOR',
  courseKind: 'radial',
  courseDegrees: 270,
  leg: 'unstated',
  turnDirection: 'unstated',
  efc: '1745',
}

const dmeLeft: ClearanceFields = {
  direction: 'NE',
  fix: 'Linden',
  fixKind: 'VOR/DME',
  courseKind: 'radial',
  courseDegrees: 50,
  leg: { unit: 'nm', value: 5 },
  turnDirection: 'left',
  efc: '0310',
}

describe('clearanceText — golden phraseology (JO 7110.65BB 4-6-4; AIM 5-3-8 i)', () => {
  it('VOR hold, nothing optional stated: direction, fix, radial, EFC only', () => {
    expect(clearanceText(vorTimed)).toBe(
      'Hold west of the Manteca VOR on the two seven zero radial, expect further clearance at one seven four five.',
    )
  })

  it('DME legs and left turns appear, in AIM 5-3-8 i order', () => {
    expect(clearanceText(dmeLeft)).toBe(
      'Hold northeast of the Linden VOR on the zero five zero radial, five mile legs, left turns, expect further clearance at zero three one zero.',
    )
  })

  it('NDB hold states the bearing explicitly TO the station (P/CG: BEARING is to or from)', () => {
    const text = clearanceText({
      direction: 'SE',
      fix: 'Amber',
      fixKind: 'NDB',
      courseKind: 'bearing',
      courseDegrees: 331,
      leg: 'unstated',
      turnDirection: 'unstated',
      efc: '2205',
    })
    expect(text).toBe(
      'Hold southeast of the Amber NDB on the three three one bearing to the station, expect further clearance at two two zero five.',
    )
  })

  it('charted hold abbreviates to direction + "as published" (JO 7110.65BB 4-6-1)', () => {
    const text = clearanceText({
      direction: 'E',
      fix: 'CEDES',
      fixKind: 'charted',
      courseKind: 'published',
      leg: 'published',
      turnDirection: 'unstated',
      efc: '1630',
    })
    expect(text).toBe('Hold east of CEDES as published, expect further clearance at one six three zero.')
  })

  it('spells courses in ATC digits: 360 for north, niner for 9', () => {
    expect(clearanceText({ ...vorTimed, courseDegrees: 360 })).toContain('three six zero radial')
    expect(clearanceText({ ...vorTimed, courseDegrees: 90 })).toContain('zero niner zero radial')
  })

  it('speaks 10-mile legs digit by digit', () => {
    expect(clearanceText({ ...dmeLeft, leg: { unit: 'nm', value: 10 } })).toContain('one zero mile legs')
  })

  it('elements appear in AIM 5-3-8 i order', () => {
    const text = clearanceText(dmeLeft)
    const order = ['northeast', 'Linden', 'radial', 'mile legs', 'left turns', 'expect further clearance']
    const positions = order.map((s) => text.indexOf(s))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('never states right turns (JO 7110.65BB 4-6-4: turns only if left)', () => {
    expect(clearanceText(vorTimed)).not.toContain('right turns')
  })

  // A clearance the pilot can read but not fly back is negative training, so
  // the renderer refuses malformed fields rather than speaking them.
  it('rejects a course that is missing or outside [0, 360]', () => {
    for (const courseDegrees of [undefined, -1, 361, 90.5, NaN]) {
      expect(() => clearanceText({ ...vorTimed, courseDegrees }), `${courseDegrees}`).toThrow(
        RangeError,
      )
    }
  })

  it('rejects a leg length that is not a positive whole number', () => {
    for (const value of [0, -5, 2.5, NaN]) {
      expect(() => clearanceText({ ...dmeLeft, leg: { unit: 'nm', value } }), `${value}`).toThrow(
        /leg value/,
      )
    }
  })

  it('rejects an EFC that is not a 4-digit zulu time', () => {
    for (const efc of ['', '930', '09300', '09:30', 'soon']) {
      expect(() => clearanceText({ ...vorTimed, efc }), JSON.stringify(efc)).toThrow(/EFC/)
    }
  })
})

describe('generateClearance — seeded scenarios', () => {
  const seeds = Array.from({ length: 250 }, (_, i) => i)

  it('is deterministic for a given seed', () => {
    expect(generateClearance(42)).toEqual(generateClearance(42))
  })

  it('rejects a non-finite seed', () => {
    expect(() => generateClearance(Number.NaN)).toThrow(RangeError)
    expect(() => generateClearance(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('covers all fix kinds, both turn directions, timed and DME legs', () => {
    const results = seeds.map((s) => generateClearance(s))
    const kinds = new Set(results.map((r) => r.holdSpec.fixKind))
    expect(kinds).toEqual(new Set(['VOR', 'VOR/DME', 'NDB', 'charted']))
    expect(new Set(results.map((r) => r.holdSpec.turnDirection))).toEqual(new Set(['right', 'left']))
    expect(new Set(results.map((r) => r.holdSpec.leg.unit))).toEqual(new Set(['min', 'nm']))
  })

  it('text is exactly the phraseology for the expected fields (engine is the oracle)', () => {
    for (const seed of seeds) {
      const { clearance, expectedFields } = generateClearance(seed)
      expect(clearance.text).toBe(clearanceText(expectedFields))
    }
  })

  it('derives the inbound course correctly: radial is FROM, bearing is TO (P/CG)', () => {
    for (const seed of seeds) {
      const { holdSpec, expectedFields } = generateClearance(seed)
      if (expectedFields.courseKind === 'radial') {
        expect(holdSpec.inboundCourse).toBe(reciprocal(normalizeDeg(expectedFields.courseDegrees!)))
      }
      if (expectedFields.courseKind === 'bearing') {
        expect(holdSpec.inboundCourse).toBe(normalizeDeg(expectedFields.courseDegrees!))
      }
    }
  })

  it('holding direction is the cardinal of the outbound side of the fix', () => {
    for (const seed of seeds) {
      const { holdSpec, expectedFields } = generateClearance(seed)
      expect(expectedFields.direction).toBe(cardinalFromCourse(reciprocal(holdSpec.inboundCourse)))
    }
  })

  it('states leg length in miles exactly when DME is used (JO 7110.65BB 4-6-4)', () => {
    for (const seed of seeds) {
      const { clearance, holdSpec, expectedFields } = generateClearance(seed)
      if (holdSpec.fixKind === 'VOR/DME') {
        expect(expectedFields.leg).toEqual(holdSpec.leg)
        expect(holdSpec.leg.unit).toBe('nm')
        expect(clearance.text).toContain('mile legs')
      }
      if (holdSpec.fixKind === 'VOR' || holdSpec.fixKind === 'NDB') {
        expect(expectedFields.leg).toBe('unstated')
        expect(holdSpec.leg).toEqual({ unit: 'min', value: 1 })
        expect(clearance.text).not.toContain('legs')
      }
    }
  })

  it('states turn direction only for left turns; unstated resolves to right', () => {
    for (const seed of seeds) {
      const { clearance, holdSpec, expectedFields } = generateClearance(seed)
      expect(clearance.text).not.toContain('right turns')
      if (holdSpec.fixKind === 'charted') {
        expect(expectedFields.turnDirection).toBe('unstated')
        continue
      }
      if (holdSpec.turnDirection === 'left') {
        expect(expectedFields.turnDirection).toBe('left')
        expect(clearance.text).toContain('left turns')
      } else {
        expect(expectedFields.turnDirection).toBe('unstated')
      }
    }
  })

  it('charted holds carry a fully resolved published pattern in the answer key', () => {
    const charted = seeds.map((s) => generateClearance(s)).filter((r) => r.holdSpec.fixKind === 'charted')
    expect(charted.length).toBeGreaterThan(0)
    for (const { clearance, holdSpec, expectedFields } of charted) {
      expect(clearance.text).toContain('as published')
      expect(expectedFields.courseKind).toBe('published')
      expect(expectedFields.leg).toBe('published')
      expect(holdSpec.inboundCourse).toBeGreaterThanOrEqual(0)
      expect(holdSpec.inboundCourse).toBeLessThan(360)
      expect(['right', 'left']).toContain(holdSpec.turnDirection)
    }
  })

  it('EFC is a valid zulu time and is spoken in the text', () => {
    for (const seed of seeds) {
      const { clearance, holdSpec } = generateClearance(seed)
      expect(holdSpec.efc).toMatch(/^([01]\d|2[0-3])[0-5][05]$/)
      expect(clearance.text).toContain('expect further clearance at')
    }
  })

  it('every generated clearance cites its FAA sources', () => {
    const { clearance } = generateClearance(7)
    expect(clearance.source).toContain('JO 7110.65BB 4-6-4')
    expect(clearance.source).toContain('AIM 5-3-8 i')
  })
})

describe('gradeCopiedClearance', () => {
  const perfectCopy: CopiedClearance = {
    direction: 'W',
    fix: 'Manteca',
    courseKind: 'radial',
    courseDegrees: 270,
    leg: { unit: 'min', value: 1 },
    turnDirection: 'right',
    efc: '1745',
  }

  it('grades a perfect copy all correct', () => {
    const grade = gradeCopiedClearance(perfectCopy, vorTimed)
    expect(grade.allCorrect).toBe(true)
    expect(grade.fields).toHaveLength(6)
    for (const f of grade.fields) {
      expect(f.correct).toBe(true)
    }
  })

  it('fix name comparison is case-insensitive', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, fix: '  manteca ' }, vorTimed)
    expect(grade.fields.find((f) => f.field === 'fix')!.correct).toBe(true)
  })

  it('flags a wrong holding direction', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, direction: 'E' }, vorTimed)
    const f = grade.fields.find((x) => x.field === 'direction')!
    expect(f.correct).toBe(false)
    expect(grade.allCorrect).toBe(false)
  })

  it('THE TRAP: unstated turn direction means right turns — answering left is wrong and trap-flagged', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, turnDirection: 'left' }, vorTimed)
    const f = grade.fields.find((x) => x.field === 'turnDirection')!
    expect(f.correct).toBe(false)
    expect(f.trap).toBe(true)
    expect(f.note).toContain('right')
  })

  it('answering right on an unstated turn direction is correct, still trap-annotated', () => {
    const grade = gradeCopiedClearance(perfectCopy, vorTimed)
    const f = grade.fields.find((x) => x.field === 'turnDirection')!
    expect(f.correct).toBe(true)
    expect(f.trap).toBe(true)
  })

  it('a stated left turn graded wrong is not the omission trap', () => {
    const grade = gradeCopiedClearance(
      { ...perfectCopy, direction: 'NE', courseDegrees: 50, leg: { unit: 'nm', value: 5 }, efc: '0310' },
      dmeLeft,
    )
    const f = grade.fields.find((x) => x.field === 'turnDirection')!
    expect(f.correct).toBe(false)
    expect(f.trap).toBeUndefined()
  })

  it('radial copied as a bearing with the same degrees is wrong geometry (FROM vs TO)', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, courseKind: 'bearing' }, vorTimed)
    const f = grade.fields.find((x) => x.field === 'holdingCourse')!
    expect(f.correct).toBe(false)
    expect(f.note).toMatch(/FROM/)
    expect(f.note).toMatch(/TO/)
  })

  it('radial 270 copied as bearing 090 is geometrically equivalent but not what was said', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, courseKind: 'bearing', courseDegrees: 90 }, vorTimed)
    const f = grade.fields.find((x) => x.field === 'holdingCourse')!
    expect(f.correct).toBe(false)
    expect(f.note).toMatch(/equivalent/i)
  })

  it('course degrees compare on the circle: 360 matches 0', () => {
    const grade = gradeCopiedClearance(
      { ...perfectCopy, courseDegrees: 360 },
      { ...vorTimed, courseDegrees: 0 },
    )
    expect(grade.fields.find((f) => f.field === 'holdingCourse')!.correct).toBe(true)
  })

  it('unstated leg length resolves to 1-minute legs (AIM 5-3-8 j4) with a note', () => {
    const f = gradeCopiedClearance(perfectCopy, vorTimed).fields.find((x) => x.field === 'legLength')!
    expect(f.correct).toBe(true)
    expect(f.note).toContain('1 minute')
    const wrong = gradeCopiedClearance({ ...perfectCopy, leg: { unit: 'nm', value: 5 } }, vorTimed)
    expect(wrong.fields.find((x) => x.field === 'legLength')!.correct).toBe(false)
  })

  it('grades an "as published" copy on the stated fields only', () => {
    const published: ClearanceFields = {
      direction: 'E',
      fix: 'CEDES',
      fixKind: 'charted',
      courseKind: 'published',
      leg: 'published',
      turnDirection: 'unstated',
      efc: '1630',
    }
    const grade = gradeCopiedClearance(
      {
        direction: 'E',
        fix: 'CEDES',
        courseKind: 'published',
        leg: 'published',
        turnDirection: 'right',
        efc: '1630',
      },
      published,
    )
    expect(grade.allCorrect).toBe(true)
  })

  it('flags a wrong EFC', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, efc: '1754' }, vorTimed)
    expect(grade.fields.find((f) => f.field === 'efc')!.correct).toBe(false)
  })

  it('treats missing course degrees as incorrect rather than throwing', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, courseDegrees: undefined }, vorTimed)
    expect(grade.fields.find((f) => f.field === 'holdingCourse')!.correct).toBe(false)
  })
})

describe('mulberry32 — seeded PRNG (drill scenario reproducibility)', () => {
  it('same seed yields the same sequence (drills are replayable)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it('every value is in [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('different seeds diverge', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('seed 0 still produces a usable non-constant stream', () => {
    const rng = mulberry32(0)
    const seq = Array.from({ length: 10 }, () => rng())
    expect(new Set(seq).size).toBeGreaterThan(1)
  })
})

describe('PUBLISHED_HOLDS practice fixtures', () => {
  // The fixtures invent course, turn direction, and legs. Reusing a real
  // charted fix's name would state those invented numbers for a hold the
  // student actually flies — "Hold northeast of HAIRE as published" once
  // taught 210°/left against the charted 231°/right.
  it('never reuses the name of a fix charted in the written bank', () => {
    const charted = new Set(CHART_HOLDS.map((h) => h.fix))
    for (const hold of PUBLISHED_HOLDS) {
      expect(charted.has(hold.fix), hold.fix).toBe(false)
    }
  })
})
