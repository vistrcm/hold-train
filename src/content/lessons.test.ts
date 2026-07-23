import { describe, expect, it } from 'vitest'
import { ankiExportScreen } from '../app/anki-export'
import { clearanceCopyScreen } from '../modules/clearance-copy'
import { entryDrillScreen } from '../modules/entry-drill'
import { oralPrepScreen } from '../modules/oral-prep'
import { windLabScreen } from '../modules/wind-lab'
import { writtenTestScreen } from '../modules/written-test'
import { LESSONS } from './lessons'

/** Route paths actually registered in main.ts (the registry lives there). */
const REGISTERED_PATHS = [
  entryDrillScreen,
  writtenTestScreen,
  oralPrepScreen,
  windLabScreen,
  clearanceCopyScreen,
  ankiExportScreen,
].map((s) => s.path)

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

  it('every drill link resolves to a registered screen route', () => {
    for (const lesson of LESSONS) {
      expect(REGISTERED_PATHS, `${lesson.id}: ${lesson.drillPath}`).toContain(lesson.drillPath)
    }
  })
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
})
