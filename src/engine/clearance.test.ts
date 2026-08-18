import { describe, it, expect } from 'vitest'
import { cardinalFromCourse, normalizeDeg, reciprocal } from './geometry'
import { CHART_HOLDS } from '../content/questions'
// The research artifact the real fixtures' geometry came from. Same runtime-only
// doc↔code coupling the README↔PHASE_PREP diff pins, and the same `?raw` idiom:
// a real fix name in the pool is a claim about a real place, so the claim and its
// provenance have to be checked against each other rather than typed twice.
import DOSSIER from '../../docs/bay-area-holds.md?raw'
import {
  INVENTED_HOLDS,
  NDB_NAMES,
  PUBLISHED_HOLDS,
  RESEARCHED_HOLDS,
  VOR_NAMES,
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

  it('grades an "as published" copy, requiring "per chart" for course, leg, and turns', () => {
    const published: ClearanceFields = {
      direction: 'E',
      fix: 'CEDES',
      fixKind: 'charted',
      courseKind: 'published',
      leg: 'published',
      turnDirection: 'unstated',
      efc: '1630',
    }
    const perChart: CopiedClearance = {
      direction: 'E',
      fix: 'CEDES',
      courseKind: 'published',
      leg: 'published',
      turnDirection: 'published',
      efc: '1630',
    }
    expect(gradeCopiedClearance(perChart, published).allCorrect).toBe(true)

    // A charted hold's turns are on the plate: guessing left/right is not the
    // copy, so it grades wrong (symmetry with the leg field).
    const guessed = gradeCopiedClearance({ ...perChart, turnDirection: 'right' }, published)
    expect(guessed.fields.find((f) => f.field === 'turnDirection')!.correct).toBe(false)
    expect(guessed.allCorrect).toBe(false)
  })

  it('flags a wrong EFC', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, efc: '1754' }, vorTimed)
    expect(grade.fields.find((f) => f.field === 'efc')!.correct).toBe(false)
  })

  // A pilot copies "EFC 1745Z" onto the kneeboard, and the drill's own review
  // panel prints the expected value as "1745Z" — so the zulu suffix is what the
  // app teaches. Grading it wrong marks back exactly what was displayed.
  it('accepts a copied EFC with or without the zulu suffix', () => {
    for (const efc of ['1745', '1745Z', '1745z', ' 1745Z ']) {
      const grade = gradeCopiedClearance({ ...perfectCopy, efc }, vorTimed)
      expect(grade.fields.find((f) => f.field === 'efc')!.correct, JSON.stringify(efc)).toBe(true)
    }
  })

  it('still flags a wrong EFC that carries the zulu suffix', () => {
    const grade = gradeCopiedClearance({ ...perfectCopy, efc: '1754Z' }, vorTimed)
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
  // The pool is MIXED: invented fixtures alongside real Bay Area / Central
  // Valley fixes. The old guard here — "never reuses the name of a fix charted
  // in the written bank" — is deleted, not weakened. It was a proxy for the
  // invariant that matters: the defect in every audit entry it was patched for
  // (HAIRE, CEDES, WINDY/DRIFT/TIMBR) was inventing facts ABOUT a real place,
  // never naming one, and a name ban checks no geometry at all. Three guards
  // replace it — the CHART_HOLDS geometry check in the describe below, the
  // dossier check here, and the real-waypoint check on the invented half.

  it('every fixture is declared invented or researched', () => {
    // PUBLISHED_HOLDS is built as the concatenation of the two, so what this
    // catches is a hold appended to the exported array directly — the previous
    // shape of the file invited exactly that edit, and such a fixture would
    // escape BOTH provenance guards below while still reaching the drill.
    expect(PUBLISHED_HOLDS).toEqual([...INVENTED_HOLDS, ...RESEARCHED_HOLDS])
  })

  it('names no fix twice', () => {
    // Two rows under one name is two geometries under one name — the same
    // self-contradiction the CHART_HOLDS check exists for, pointed inward.
    const fixes = PUBLISHED_HOLDS.map((h) => h.fix)
    expect([...new Set(fixes)].sort()).toEqual([...fixes].sort())
  })

  it('every fixture carries geometry the clearance engine can speak', () => {
    for (const hold of PUBLISHED_HOLDS) {
      expect(hold.fix, hold.fix).toMatch(/^[A-Z]{5}$/)
      expect(Number.isInteger(hold.inboundCourse), hold.fix).toBe(true)
      expect(hold.inboundCourse, hold.fix).toBeGreaterThanOrEqual(0)
      expect(hold.inboundCourse, hold.fix).toBeLessThan(360)
      expect(['left', 'right'], hold.fix).toContain(hold.turnDirection)
      expect(['min', 'nm'], hold.fix).toContain(hold.leg.unit)
      expect(Number.isInteger(hold.leg.value), hold.fix).toBe(true)
      expect(hold.leg.value, hold.fix).toBeGreaterThan(0)
    }
  })

  it('no invented fixture lands on a real waypoint', () => {
    // Unchanged in substance and deliberately kept: the ban was wrong as a
    // blanket rule over a mixed pool, and still right over the invented half.
    // An invented hold at a real fix teaches made-up course and turn data for
    // somewhere the student flies. Verified against opennav.com/waypoint/US/
    // <NAME>: CEDES (Livermore), SUNOL and TRACY are real fixes and TRACY sits
    // beside KTCY; WINDY (Newman, CA), DRIFT and TIMBR are the wind-lab
    // repeat of the same defect. The names in INVENTED_HOLDS return none.
    const real = ['CEDES', 'SUNOL', 'TRACY', 'JEMKO', 'WINDY', 'DRIFT', 'TIMBR']
    for (const hold of INVENTED_HOLDS) {
      expect(real, `fixture ${hold.fix}`).not.toContain(hold.fix)
    }
  })
})

/**
 * The real half's geometry, against the file it was researched from.
 *
 * A real fix name is a claim about a real place, and CHART_HOLDS constrains
 * only the four names the written bank happens to carry. For the other ten the
 * dossier is the only witness, so the check is the same shape: the app may not
 * state geometry for a real fix that its own provenance record contradicts.
 */
describe('RESEARCHED_HOLDS agrees with docs/bay-area-holds.md', () => {
  /** The dossier's own confidence legend — the column that marks a hold row. */
  const CONFIDENCE = ['researched', 'CIFP-only', 'approximate', 'invented']

  /** Markdown emphasis and code ticks are formatting, not value. */
  const plain = (cell: string): string => cell.replace(/[`*]/g, '').trim()

  interface DossierRow {
    fix: string
    inboundCourse: number
    turnDirection: string
    leg: { unit: string; value: number }
    confidence: string
  }

  /**
   * Hold rows, keyed off the confidence column rather than off a table caption:
   * the dossier also carries a navaid table, a decode-validation table and a
   * recommendations table, all of which name fixes in their first column.
   *
   * A row that looks like a hold row and will not parse THROWS rather than
   * being skipped — a skip is fail-open, the same way a truncated source scan
   * reads as a clean one.
   */
  const HOLD_ROWS: readonly DossierRow[] = DOSSIER.split('\n').flatMap((line) => {
    const cells = line.split('|')
    if (cells.length !== 10) return []
    const confidence = plain(cells[7]!)
    if (!CONFIDENCE.includes(confidence)) return []
    const course = /^(\d{1,3})°$/.exec(plain(cells[3]!))
    const leg = /^(\d+)\s*(NM|min)$/.exec(plain(cells[5]!))
    const turnDirection = plain(cells[4]!)
    if (!course || !leg || !['left', 'right'].includes(turnDirection)) {
      throw new Error(`unparseable hold row in docs/bay-area-holds.md: ${line}`)
    }
    return [
      {
        fix: plain(cells[1]!),
        inboundCourse: Number(course[1]),
        turnDirection,
        leg: { unit: leg[2]!.toLowerCase(), value: Number(leg[1]) },
        confidence,
      },
    ]
  })

  it('states the researched course, turns and leg for every real fixture', () => {
    expect(RESEARCHED_HOLDS.length).toBeGreaterThan(0)
    for (const hold of RESEARCHED_HOLDS) {
      const rows = HOLD_ROWS.filter((r) => r.fix === hold.fix)
      // Exactly one: the dossier records two geometries for OAK (one per
      // procedure), and shipping a fix whose provenance is ambiguous is the
      // confusion the dossier exists to prevent, so it reds rather than
      // picking a row.
      expect(rows, `${hold.fix} in docs/bay-area-holds.md`).toHaveLength(1)
      const row = rows[0]!
      expect(
        {
          inboundCourse: hold.inboundCourse,
          turnDirection: hold.turnDirection,
          leg: hold.leg,
        },
        hold.fix,
      ).toEqual({
        inboundCourse: row.inboundCourse,
        turnDirection: row.turnDirection,
        leg: row.leg,
      })
      // A real name whose dossier row says the numbers were made up is the
      // original defect wearing the guard's own paperwork.
      expect(row.confidence, hold.fix).not.toBe('invented')
    }
  })
})

/**
 * The station names, against the file their existence was checked in.
 *
 * VOR_NAMES makes a claim the fixture holds do not: that there is a station to
 * tune. Its geometry is drawn per scenario and asserts nothing, so the name is
 * the whole claim — and the dossier's navaid table (presence in CIFP 2608,
 * which is what "still commissioned" means for a navaid) is the witness for it.
 * Same shape as the RESEARCHED_HOLDS check above, one list over: the app may
 * not name a station its own provenance record says is not there.
 */
describe('VOR_NAMES agrees with docs/bay-area-holds.md', () => {
  /** Markdown emphasis, code ticks, and the scare quotes on a non-station. */
  const plain = (cell: string): string => cell.replace(/[`*"]/g, '').trim()

  /**
   * Stations drawn although they no longer exist. Manteca (ECA) was
   * decommissioned 2018-03-29 under VOR MON and shipped here long before this
   * pool went mixed; the decision to keep it is recorded in clearance.ts. The
   * exemption is checked BOTH ways — a name here the pool no longer draws reds
   * too, so it cannot decay into a list excusing stations nobody speaks.
   */
  const RETAINED_DECOMMISSIONED = ['Manteca']

  interface NavaidRow {
    ident: string
    name: string
    status: string
  }

  /**
   * Navaid rows: six cells whose first is a three-letter ident. The dossier's
   * other tables are 2, 3, 4, 8 and 9 cells wide, so nothing else parses as
   * one, and the header and separator rows fail the ident test rather than
   * being skipped by position. A parse that breaks fails CLOSED — every
   * assertion below needs a row in order to pass.
   */
  const NAVAID_ROWS: readonly NavaidRow[] = DOSSIER.split('\n').flatMap((line) => {
    const cells = line.split('|')
    if (cells.length !== 8) return []
    const ident = plain(cells[1]!)
    if (!/^[A-Z]{3}$/.test(ident)) return []
    return [{ ident, name: plain(cells[2]!), status: plain(cells[6]!) }]
  })

  it('names only stations the dossier records as current', () => {
    expect(VOR_NAMES.length).toBeGreaterThan(0)
    for (const name of VOR_NAMES) {
      const rows = NAVAID_ROWS.filter((r) => r.name === name)
      expect(rows, `${name} in docs/bay-area-holds.md`).toHaveLength(1)
      const { status } = rows[0]!
      if (RETAINED_DECOMMISSIONED.includes(name)) {
        expect(status, name).toMatch(/DECOMMISSIONED/)
        continue
      }
      // "in CIFP 2608" is the dossier's phrase for a station that is still
      // there. The two rows lacking it are the decommissioned one and
      // "Stockton", which the plan proposed and which is not a VOR at all.
      expect(status, name).toContain('in CIFP 2608')
    }
  })

  it('excuses only decommissioned stations the pool actually draws', () => {
    for (const name of RETAINED_DECOMMISSIONED) {
      expect(VOR_NAMES, `${name} is excused but no longer shipped`).toContain(name)
    }
  })

  it('invents its NDB names rather than reusing a real station', () => {
    // The other direction, and the reason the NDB list stays invented: no NDB
    // remains in the region, so an NDB name that IS a real station here would
    // be a VOR wearing the wrong kind — bearing-to-the-station phraseology
    // taught at a place that speaks radials.
    expect(NAVAID_ROWS.length, 'dossier navaid table parsed').toBeGreaterThan(0)
    const stations = NAVAID_ROWS.map((r) => r.name)
    for (const name of NDB_NAMES) {
      expect(stations, `${name} is a real station`).not.toContain(name)
    }
  })
})

/**
 * The ad-hoc ATC branch, swept over seeds.
 *
 * Every station name reaches the student inside spoken phraseology, so the
 * sweep checks what an ear would catch — over the WHOLE pool, because a sweep
 * that happens to miss a name certifies nothing about it. The drawn set is
 * asserted equal to the pool rather than merely non-empty, which is the
 * exhaustiveness hole this repo keeps re-finding (TIERS, OVERLAY_ALPHA).
 */
describe('generateClearance — ad-hoc holds at named stations', () => {
  const seeds = Array.from({ length: 1000 }, (_, i) => i)
  const adHoc = seeds.map((s) => generateClearance(s)).filter((r) => r.holdSpec.fixKind !== 'charted')

  it('draws every station in the pool', () => {
    const drawn = new Set(adHoc.map((r) => r.holdSpec.fix))
    expect(drawn).toEqual(new Set<string>([...VOR_NAMES, ...NDB_NAMES]))
  })

  it('speaks every station name cleanly', () => {
    for (const { clearance, holdSpec, expectedFields } of adHoc) {
      // A name is read aloud: words, single-spaced, nothing stray around them.
      expect(holdSpec.fix, JSON.stringify(holdSpec.fix)).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/)
      const station = holdSpec.fixKind === 'NDB' ? 'NDB' : 'VOR'
      expect(clearance.text, holdSpec.fix).toContain(`of the ${holdSpec.fix} ${station} on the `)
      expect(clearance.text, holdSpec.fix).not.toMatch(/ {2}|undefined|NaN/)
      expect(expectedFields.fix, holdSpec.fix).toBe(holdSpec.fix)
    }
  })

  it('assigns its own course, turns and legs rather than a published pattern', () => {
    const coursesByFix = new Map<string, Set<number>>()
    for (const { clearance, holdSpec, expectedFields } of adHoc) {
      expect(clearance.text, holdSpec.fix).not.toContain('as published')
      expect(['radial', 'bearing'], holdSpec.fix).toContain(expectedFields.courseKind)
      expect(expectedFields.leg, holdSpec.fix).not.toBe('published')
      expect(typeof expectedFields.courseDegrees, holdSpec.fix).toBe('number')
      const courses = coursesByFix.get(holdSpec.fix) ?? new Set<number>()
      courses.add(holdSpec.inboundCourse)
      coursesByFix.set(holdSpec.fix, courses)
    }
    // No station may accumulate a de facto published geometry. The realism of
    // an ATC-assigned hold is precisely that the same VOR comes with a
    // different radial every time — a real name with a fixed course would be
    // the app teaching a hold it never researched.
    for (const [fix, courses] of coursesByFix) {
      expect(courses.size, `${fix} always holds on the same course`).toBeGreaterThan(1)
    }
    expect(new Set(adHoc.map((r) => r.holdSpec.turnDirection))).toEqual(new Set(['right', 'left']))
  })
})

describe('PUBLISHED_HOLDS geometry agrees with the written bank', () => {
  // The pool is mixed by design: a fixture MAY carry a real fix name. What it
  // may not do is teach different geometry for a name the written test already
  // charts — two screens contradicting each other under one fix name is worse
  // than approximate data, and no amount of caveating makes it visible. That is
  // the HAIRE defect (docs/content-audit.md): "hold northeast of HAIRE as
  // published" once taught 210°/left against the charted 231°/right.
  //
  // The overlap is real now — OYOSO, HAIRE and UHHUT are in the pool — so the
  // check against the live list below bites. The synthetic cases underneath it
  // stay: they are what keeps the guard honest if the overlap ever empties,
  // and they pin WHICH field disagreed, which the live check alone cannot.
  type Fixture = (typeof PUBLISHED_HOLDS)[number]

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null

  /**
   * Every field a fixture teaches except its name, as dotted paths. Harvested
   * from the object rather than hand-listed: a subset comparison is precisely
   * how one field of a pair drifts while the other stays guarded, so a fifth
   * field added to the fixture shape is compared by default. One level of
   * nesting is flattened, which is all `leg` needs.
   */
  const geometryFields = (hold: Fixture): ReadonlyArray<readonly [string, unknown]> =>
    Object.entries(hold)
      .filter(([key]) => key !== 'fix')
      .flatMap(([key, value]) =>
        isRecord(value)
          ? Object.entries(value).map(([sub, v]) => [`${key}.${sub}`, v] as const)
          : [[key, value] as const],
      )

  const valueAt = (hold: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((v, key) => (isRecord(v) ? v[key] : undefined), hold)

  /** One string per contradicted field, so a mismatch names what disagrees. */
  const geometryConflicts = (fixtures: readonly Fixture[]): string[] => {
    const conflicts: string[] = []
    for (const fixture of fixtures) {
      const charted = CHART_HOLDS.find((h) => h.fix === fixture.fix)
      if (!charted) continue
      for (const [path, value] of geometryFields(fixture)) {
        const chartedValue = valueAt(charted, path)
        if (value !== chartedValue) {
          conflicts.push(
            `${fixture.fix}: ${path} is ${String(value)}, chart says ${String(chartedValue)}`,
          )
        }
      }
    }
    return conflicts
  }

  /**
   * A fixture-shaped copy of a charted hold — the only legal way to reuse a
   * charted name. Built field by field on purpose: `Fixture` is the exact
   * element type, so a field added to the pool reds `tsc` here rather than
   * quietly producing a twin that carries less than the real thing.
   */
  const chartedTwin = (fix: string): Fixture => {
    const charted = CHART_HOLDS.find((h) => h.fix === fix)
    if (!charted) {
      throw new Error(`CHART_HOLDS no longer carries ${fix}; point these cases at another charted fix`)
    }
    return {
      fix: charted.fix,
      inboundCourse: charted.inboundCourse,
      turnDirection: charted.turnDirection,
      leg: { ...charted.leg },
    }
  }

  it('never contradicts a charted hold it shares a name with', () => {
    expect(geometryConflicts(PUBLISHED_HOLDS)).toEqual([])
  })

  it('actually shares a name with a charted hold, so the check above is not vacuous', () => {
    // geometryConflicts([]) is [] — the assertion above passes just as happily
    // over a pool that overlaps CHART_HOLDS nowhere, which is what it did
    // until the real fixtures landed. Naming the overlap is what makes it a
    // guard rather than a comment. OYOSO is the case that motivated the whole
    // invariant: KTCY is this student's home field.
    const charted = new Set(CHART_HOLDS.map((h) => h.fix))
    const overlap = PUBLISHED_HOLDS.filter((h) => charted.has(h.fix)).map((h) => h.fix)
    expect(overlap).toContain('OYOSO')
  })

  it('permits a fixture that reuses a charted name with identical geometry', () => {
    // The invariant that replaces the old blanket name ban: sharing a name is
    // fine, sharing it with different numbers is not. A guard that rejected the
    // overlap outright would red here and make Task 4 impossible.
    expect(geometryConflicts([chartedTwin('OYOSO')])).toEqual([])
  })

  // One mutation per field, not one fixture with everything wrong: a single
  // all-fields-wrong pair still reds a guard that only compares inboundCourse,
  // which is the subset hole these cases exist to close.
  const MISMATCHES: ReadonlyArray<readonly [string, (h: Fixture) => Fixture]> = [
    ['inboundCourse', (h) => ({ ...h, inboundCourse: normalizeDeg(h.inboundCourse + 30) })],
    ['turnDirection', (h) => ({ ...h, turnDirection: h.turnDirection === 'left' ? 'right' : 'left' })],
    ['leg.unit', (h) => ({ ...h, leg: { unit: h.leg.unit === 'nm' ? 'min' : 'nm', value: h.leg.value } })],
    ['leg.value', (h) => ({ ...h, leg: { ...h.leg, value: h.leg.value + 1 } })],
  ]

  it.each(MISMATCHES)('catches a fixture contradicting the chart on %s', (field, contradict) => {
    const conflicts = geometryConflicts([contradict(chartedTwin('OYOSO'))])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toContain(field)
  })

  it('compares every field a fixture carries, not a hand-listed subset', () => {
    for (const hold of PUBLISHED_HOLDS) {
      const compared = new Set(geometryFields(hold).map(([path]) => path.replace(/\..*$/, '')))
      const carried = Object.keys(hold).filter((key) => key !== 'fix')
      expect([...compared].sort(), hold.fix).toEqual(carried.sort())
    }
  })
})
