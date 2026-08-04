import { describe, expect, it } from 'vitest'
import { LESSONS } from './lessons'

describe('lesson ordering', () => {
  it('follows the instructional order: why → anatomy → entries → timing/wind → reports', () => {
    expect(LESSONS.map((l) => l.id)).toEqual([
      'why-hold',
      'anatomy',
      'entries',
      'timing-wind',
      'reports',
    ])
  })

  it('ids and titles are unique', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length)
    expect(new Set(LESSONS.map((l) => l.title)).size).toBe(LESSONS.length)
  })
})

describe('lesson shape and sources', () => {
  it('every lesson has a title, ≥1 paragraph, and a labeled drill link', () => {
    for (const lesson of LESSONS) {
      expect(lesson.title.trim().length, lesson.id).toBeGreaterThan(0)
      expect(lesson.paragraphs.length, lesson.id).toBeGreaterThanOrEqual(1)
      expect(lesson.drillPath.trim().length, lesson.id).toBeGreaterThan(0)
      expect(lesson.drillLabel.trim().length, lesson.id).toBeGreaterThan(0)
    }
  })

  it('every factual paragraph carries an FAA source citation', () => {
    for (const lesson of LESSONS) {
      for (const p of lesson.paragraphs) {
        expect(p.text.trim().length, lesson.id).toBeGreaterThan(0)
        expect(p.source.trim().length, lesson.id).toBeGreaterThan(0)
        expect(
          /AIM|14 CFR|FAA-S-ACS-8C|7110\.65|P\/CG/.test(p.source),
          `${lesson.id}: ${p.source}`,
        ).toBe(true)
      }
    }
  })

  // AIM 5-3-8 j5 captions its two DME figures by the INBOUND course:
  // "Inbound Toward NAVAID" is the 10 NM fix with 5 NM legs ending at 15 DME;
  // "Inbound Leg Away from NAVAID" is the 28 NM fix with 8 NM legs ending at
  // 20 DME. Labelling them the other way round teaches the figure titles
  // backwards, which is how a student misreads the plate on the checkride.
  it('pairs the DME worked examples with the AIM inbound-course labels', () => {
    const lesson = LESSONS.find((l) => l.id === 'timing-wind')!
    const dme = lesson.paragraphs.find((p) => p.text.includes('DME'))
    expect(dme).toBeDefined()
    const [towardHalf = '', awayHalf = ''] = dme!.text.split(';')

    expect(towardHalf).toContain('toward')
    expect(towardHalf).toContain('10 DME')
    expect(towardHalf).toContain('15 DME')

    expect(awayHalf).toContain('away')
    expect(awayHalf).toContain('28 DME')
    expect(awayHalf).toContain('20 DME')
  })

  // Drill links are validated against the REAL route registry in
  // src/main.test.ts — a hand-copied path list here would go stale silently.
})

describe('required lesson content', () => {
  function lessonText(id: string): string {
    const lesson = LESSONS.find((l) => l.id === id)
    expect(lesson, id).toBeDefined()
    return lesson!.paragraphs.map((p) => p.text).join(' ')
  }

  it('entries lesson teaches the thumb method and the ±5° tolerance', () => {
    const text = lessonText('entries')
    expect(text).toMatch(/thumb/i)
    expect(text).toMatch(/±5°|5°/)
    expect(text).toMatch(/mirror/i)
  })

  it('timing/wind lesson gives the AIM triple-drift answer with the double-drift field caveat', () => {
    const text = lessonText('timing-wind')
    expect(text).toMatch(/triple/i)
    expect(text).toMatch(/double/i)
    expect(text).toMatch(/abeam/i)
  })

  it('anatomy lesson covers max speeds and the omitted-turn-direction trap', () => {
    const text = lessonText('anatomy')
    expect(text).toMatch(/200 KIAS/)
    expect(text).toMatch(/right turns/i)
  })

  it('reports lesson covers required reports and lost comm', () => {
    const text = lessonText('reports')
    expect(text).toMatch(/91\.185/)
    expect(text).toMatch(/time and altitude/i)
  })

  it('anatomy clearance paragraph follows the verbatim AIM 5-3-8 i element list', () => {
    const text = lessonText('anatomy')
    expect(text).toMatch(/eight cardinal compass points/)
    expect(text).toMatch(/left turns are to be made/)
    expect(text).toMatch(/requests|considers it necessary/)
    expect(text).not.toMatch(/only when left turns/)
  })

  it('entries lesson states the ±5° rule in AIM j8(d) heading-tolerance framing', () => {
    const lesson = LESSONS.find((l) => l.id === 'entries')!
    const boundary = lesson.paragraphs.find((p) => /±5°|5° of a sector/.test(p.text))!
    expect(boundary.text).toMatch(/good operating limits/)
    expect(boundary.source).toContain('j8(d)')
  })

  // The parallel rejoin turns AGAINST the pattern; the evidence is in
  // docs/parallel-entry-evidence.md and must not be re-derived from the AIM
  // sentence, which is ambiguous. The AIM's own clause is quoted verbatim here
  // and legitimately contains "in the direction of the holding pattern", so the
  // negatives below anchor on the gloss wording, never on the quotation.
  it('entries lesson glosses the parallel rejoin as opposite the pattern', () => {
    const text = lessonText('entries')
    expect(text).toContain('turn in the direction of the holding pattern through more than 180°')
    expect(text).toMatch(/opposite the pattern/i)
    expect(text).toMatch(/crosses back over the holding course|onto the holding side/i)
    expect(text).not.toMatch(/same way the pattern|follows the pattern|only that direction/i)
  })

  it('entries lesson names the two-turns-against structure of the parallel entry', () => {
    const text = lessonText('entries')
    expect(text).toMatch(/first two turns/i)
    expect(text).toMatch(/only the turn on reaching the fix/i)
  })

  // Both sides of the holding course are protected (FAA Order 8260.3G
  // ¶16-3-2 / Table 16-6-1; docs/holding-protected-airspace.md). Every
  // content bank carries this scan — the guarded siblings did not stop the
  // unguarded one from shipping the folklore model.
  it('no lesson teaches a one-side-protected model', () => {
    // Every user-visible string of the lesson, not just paragraph text:
    // title renders as the heading, source next to each paragraph,
    // drillLabel as the practice link.
    for (const lesson of LESSONS) {
      const strings = [
        lesson.title,
        lesson.drillLabel,
        ...lesson.paragraphs.flatMap((p) => [p.text, p.source]),
      ]
      for (const s of strings) {
        expect(s, lesson.id).not.toMatch(/unprotected/i)
        expect(s, lesson.id).not.toMatch(/protected side/i)
      }
    }
  })
})
