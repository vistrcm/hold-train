import { describe, expect, it } from 'vitest'
import { ACS_ELEMENTS, ACS_SOURCE, ORAL_ITEMS } from './oral'

const CODES = ACS_ELEMENTS.map((e) => e.code)

describe('ACS Task III.B element list', () => {
  it('contains exactly the FAA-S-ACS-8C Task III.B codes: K1, R1–R4, S1–S8 with S3a', () => {
    expect(CODES).toEqual([
      'IR.III.B.K1',
      'IR.III.B.R1',
      'IR.III.B.R2',
      'IR.III.B.R3',
      'IR.III.B.R4',
      'IR.III.B.S1',
      'IR.III.B.S2',
      'IR.III.B.S3',
      'IR.III.B.S3a',
      'IR.III.B.S4',
      'IR.III.B.S5',
      'IR.III.B.S6',
      'IR.III.B.S7',
      'IR.III.B.S8',
    ])
  })

  it('every element has a kind matching its code letter and non-empty text', () => {
    for (const e of ACS_ELEMENTS) {
      expect(e.text.trim().length, e.code).toBeGreaterThan(0)
      const letter = e.code.replace('IR.III.B.', '')[0]
      const expected = letter === 'K' ? 'knowledge' : letter === 'R' ? 'risk' : 'skill'
      expect(e.kind, e.code).toBe(expected)
    }
  })

  it('cites the ACS as the source of the element list', () => {
    expect(ACS_SOURCE).toContain('FAA-S-ACS-8C')
    expect(ACS_SOURCE).toContain('Task B')
  })
})

describe('oral item shape', () => {
  it('ids are unique', () => {
    const ids = ORAL_ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every item has a question, model answer, FAA source, and ≥1 valid ACS element tag', () => {
    for (const item of ORAL_ITEMS) {
      expect(item.question.trim().length, item.id).toBeGreaterThan(0)
      expect(item.answer.trim().length, item.id).toBeGreaterThan(0)
      expect(item.source.trim().length, item.id).toBeGreaterThan(0)
      expect(item.acs.length, item.id).toBeGreaterThanOrEqual(1)
      for (const code of item.acs) {
        expect(CODES, `${item.id}: ${code}`).toContain(code)
      }
      expect(new Set(item.acs).size, item.id).toBe(item.acs.length)
    }
  })

  it('every Task III.B element is covered by at least one item', () => {
    for (const code of CODES) {
      const covering = ORAL_ITEMS.filter((i) => i.acs.includes(code))
      expect(covering.length, code).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('required content presence', () => {
  function findByText(needle: RegExp): number {
    return ORAL_ITEMS.filter((i) => needle.test(`${i.question} ${i.answer}`)).length
  }

  it('covers G1000 hold behavior (SUSP and OBS) as Q&A content', () => {
    expect(findByText(/SUSP/)).toBeGreaterThanOrEqual(1)
    expect(findByText(/OBS/)).toBeGreaterThanOrEqual(1)
  })

  it('G1000 items are flagged software-version dependent via a caveat', () => {
    const g1000 = ORAL_ITEMS.filter((i) => /G1000/.test(`${i.question} ${i.answer}`))
    expect(g1000.length).toBeGreaterThanOrEqual(2)
    for (const item of g1000) {
      expect(item.caveat, item.id).toBeDefined()
      expect(item.caveat!, item.id).toMatch(/software|version/i)
    }
  })

  it('covers clearance elements, reports, lost comm, protected side, max speeds, and Avianca fuel ADM', () => {
    expect(findByText(/expect further clearance|EFC/i)).toBeGreaterThanOrEqual(1)
    expect(findByText(/91\.185/)).toBeGreaterThanOrEqual(1)
    expect(findByText(/holding side|protected/i)).toBeGreaterThanOrEqual(1)
    expect(findByText(/200 KIAS/)).toBeGreaterThanOrEqual(1)
    expect(findByText(/Avianca/)).toBeGreaterThanOrEqual(1)
  })

  it('triple-drift wind correction carries the double-drift field-technique caveat', () => {
    const wind = ORAL_ITEMS.filter((i) => /triple/i.test(i.answer))
    expect(wind.length).toBeGreaterThanOrEqual(1)
    for (const item of wind) {
      expect(item.caveat, item.id).toMatch(/double/i)
    }
  })

  it('fact items cite FAA primary sources (AIM, CFR, ACS, JO 7110.65, or NTSB)', () => {
    for (const item of ORAL_ITEMS) {
      const cited = /AIM|14 CFR|FAA-S-ACS-8C|7110\.65|NTSB|P\/CG|Garmin/.test(item.source)
      expect(cited, `${item.id}: ${item.source}`).toBe(true)
    }
  })
})

describe('content-audit regressions (Task 17, verified against FAA sources)', () => {
  const byId = (id: string) => ORAL_ITEMS.find((i) => i.id === id)!

  it('entries item carries the ±5° boundary caveat in AIM j8(d) framing', () => {
    const item = byId('entries')
    expect(item.caveat).toMatch(/±5°|5°/)
    expect(item.caveat).toMatch(/good operating limits/)
    expect(item.source).toContain('j8(d)')
  })

  it('turn-direction items state the full AIM i5 conditional, not "only left"', () => {
    for (const id of ['clearance-elements', 'standard-vs-nonstandard']) {
      const item = byId(id)
      expect(item.answer, id).toMatch(/left turns are to be made/)
      expect(item.answer, id).toMatch(/requests|considers it necessary/)
      expect(item.answer, id).not.toMatch(/only when left turns/)
    }
  })

  it('clearance elements follow the verbatim AIM 5-3-8 i list', () => {
    const item = byId('clearance-elements')
    expect(item.answer).toMatch(/eight cardinal compass points/)
    expect(item.answer).toMatch(/leg length in miles if DME or RNAV/i)
    expect(item.answer).toMatch(/EFC/)
  })
})
