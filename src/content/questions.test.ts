import { describe, expect, it } from 'vitest'
import { determineEntry, ENTRIES, type Entry } from '../engine/entry'
import { radialToInboundCourse } from '../engine/geometry'
import {
  CHART_CYCLE,
  CHART_HOLDS,
  entryOptionSet,
  QUESTIONS,
  TOPICS,
  type WrittenQuestion,
} from './questions'

const entryQuestions = QUESTIONS.filter(
  (q): q is WrittenQuestion & Required<Pick<WrittenQuestion, 'entry'>> => q.entry !== undefined,
)

describe('question bank shape', () => {
  it('holds at least 40 questions', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(40)
  })

  it('ids are unique', () => {
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every question has text, ≥3 unique options, a valid key, explanation, FAA source, ACS tag', () => {
    for (const q of QUESTIONS) {
      expect(q.question.trim().length, q.id).toBeGreaterThan(0)
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3)
      expect(new Set(q.options).size, q.id).toBe(q.options.length)
      expect(Number.isInteger(q.answerIndex), q.id).toBe(true)
      expect(q.answerIndex, q.id).toBeGreaterThanOrEqual(0)
      expect(q.answerIndex, q.id).toBeLessThan(q.options.length)
      expect(q.explanation.trim().length, q.id).toBeGreaterThan(0)
      expect(q.source.trim().length, q.id).toBeGreaterThan(0)
      expect(q.acs, q.id).toMatch(/^IR\.III\.B\.(K|R|S)\d+$/)
      expect(TOPICS, q.id).toContain(q.topic)
    }
  })

  it('every topic is represented by at least 3 questions', () => {
    for (const topic of TOPICS) {
      const count = QUESTIONS.filter((q) => q.topic === topic).length
      expect(count, topic).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('entry questions: the engine is the oracle', () => {
  it('exist in force, including chart-based scenarios', () => {
    expect(entryQuestions.length).toBeGreaterThanOrEqual(8)
  })

  it('keyed answer always equals the determineEntry output for the embedded scenario', () => {
    for (const q of entryQuestions) {
      const result = determineEntry(q.entry.heading, q.entry)
      const expected = entryOptionSet(result)
      expect(q.options, q.id).toEqual(expected.options)
      expect(q.answerIndex, q.id).toBe(expected.answerIndex)
    }
  })

  it('dual-keyed options appear exactly when the engine reports a near-boundary heading', () => {
    for (const q of entryQuestions) {
      const result = determineEntry(q.entry.heading, q.entry)
      const keyed = q.options[q.answerIndex]!
      if (result.alternates.length > 0) {
        expect(keyed, q.id).toMatch(/ or /)
      } else {
        expect(keyed, q.id).not.toMatch(/ or /)
      }
    }
  })

  it('single-answer questions never offer a second engine-acceptable distractor', () => {
    for (const q of entryQuestions) {
      const result = determineEntry(q.entry.heading, q.entry)
      if (result.alternates.length > 0) continue
      const acceptable = new Set<Entry>([result.primary, ...result.alternates])
      const distractors = q.options.filter((_, i) => i !== q.answerIndex)
      for (const option of distractors) {
        const asEntry = option.toLowerCase() as Entry
        expect(acceptable.has(asEntry), `${q.id}: ${option}`).toBe(false)
      }
    }
  })

  it('covers all three entries as primaries and at least two boundary (dual-keyed) cases', () => {
    const primaries = new Set<Entry>()
    let boundaries = 0
    for (const q of entryQuestions) {
      const result = determineEntry(q.entry.heading, q.entry)
      primaries.add(result.primary)
      if (result.alternates.length > 0) boundaries += 1
    }
    expect(primaries).toEqual(new Set(ENTRIES))
    expect(boundaries).toBeGreaterThanOrEqual(2)
  })

  it('covers standard and nonstandard patterns', () => {
    const turns = new Set(entryQuestions.map((q) => q.entry.turnDirection))
    expect(turns).toEqual(new Set(['right', 'left']))
  })
})

describe('chart-derived holds (KTCY / KLVK, verified current cycle)', () => {
  it('include the KTCY HAIRE missed hold, OYOSO HILPT, KLVK UHHUT HILPT, and ALTAM missed hold', () => {
    const fixes = CHART_HOLDS.map((h) => h.fix)
    expect(fixes).toEqual(expect.arrayContaining(['HAIRE', 'OYOSO', 'UHHUT', 'ALTAM']))
  })

  it('every chart hold cites its approach plate and the dTPP cycle', () => {
    expect(CHART_CYCLE).toContain('2607')
    for (const h of CHART_HOLDS) {
      expect(h.source, h.fix).toContain('AL-')
      expect(h.source, h.fix).toContain('2607')
      expect(h.inboundCourse, h.fix).toBeGreaterThanOrEqual(0)
      expect(h.inboundCourse, h.fix).toBeLessThan(360)
      expect(h.leg.value, h.fix).toBeGreaterThan(0)
    }
  })

  it('chart hold golden values match the published charts and CIFP records', () => {
    const byFix = new Map(CHART_HOLDS.map((h) => [h.fix, h]))
    expect(byFix.get('HAIRE')).toMatchObject({
      inboundCourse: 231,
      turnDirection: 'right',
      leg: { unit: 'nm', value: 4 },
    })
    expect(byFix.get('OYOSO')).toMatchObject({
      inboundCourse: 116,
      turnDirection: 'left',
      leg: { unit: 'nm', value: 4 },
    })
    expect(byFix.get('UHHUT')).toMatchObject({
      inboundCourse: 255,
      turnDirection: 'right',
      leg: { unit: 'nm', value: 4 },
    })
    expect(byFix.get('ALTAM')).toMatchObject({
      inboundCourse: 240,
      turnDirection: 'left',
      leg: { unit: 'min', value: 1 },
    })
  })

  it('ALTAM inbound course is the reciprocal of the OAK 060 radial (radial FROM vs course TO)', () => {
    const altam = CHART_HOLDS.find((h) => h.fix === 'ALTAM')!
    expect(altam.inboundCourse).toBe(radialToInboundCourse(60))
  })
})
