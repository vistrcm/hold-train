// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { LESSONS } from '../content/lessons'
import { learnScreen, renderLearn } from './learn'

let root: HTMLElement

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  root = document.querySelector<HTMLElement>('#root')!
})

describe('lesson list', () => {
  it('lists every lesson title in instructional order', () => {
    renderLearn(root)
    const titles = [...root.querySelectorAll('.lesson-link')].map((a) => a.textContent?.trim())
    expect(titles).toEqual(LESSONS.map((l) => l.title))
  })

  it('screen is registered at #/learn and renders the list', () => {
    expect(learnScreen.path).toBe('learn')
    learnScreen.render(root)
    expect(root.querySelectorAll('.lesson-link').length).toBe(LESSONS.length)
  })
})

describe('lesson page', () => {
  const lesson = LESSONS[0]!

  it('opens a lesson from the list', () => {
    renderLearn(root)
    root.querySelector<HTMLButtonElement>('.lesson-link')!.click()
    expect(root.querySelector('h1')?.textContent).toBe(lesson.title)
  })

  it('renders every paragraph with its FAA source citation', () => {
    renderLearn(root, { lessonId: lesson.id })
    const paragraphs = [...root.querySelectorAll('.lesson-paragraph')]
    expect(paragraphs.length).toBe(lesson.paragraphs.length)
    for (const [i, p] of lesson.paragraphs.entries()) {
      expect(paragraphs[i]!.textContent).toContain(p.text)
      expect(paragraphs[i]!.querySelector('cite')?.textContent).toContain(p.source)
    }
  })

  it('links to the lesson’s drill route', () => {
    renderLearn(root, { lessonId: lesson.id })
    const drill = root.querySelector<HTMLAnchorElement>('.lesson-drill')!
    expect(drill.getAttribute('href')).toBe(`#/${lesson.drillPath}`)
    expect(drill.textContent).toContain(lesson.drillLabel)
  })

  it('returns to the list via the back control', () => {
    renderLearn(root, { lessonId: lesson.id })
    root.querySelector<HTMLButtonElement>('.lesson-back')!.click()
    expect(root.querySelectorAll('.lesson-link').length).toBe(LESSONS.length)
  })

  it('links to the next lesson in order, and the last lesson has no next link', () => {
    renderLearn(root, { lessonId: lesson.id })
    root.querySelector<HTMLButtonElement>('.lesson-next')!.click()
    expect(root.querySelector('h1')?.textContent).toBe(LESSONS[1]!.title)

    renderLearn(root, { lessonId: LESSONS[LESSONS.length - 1]!.id })
    expect(root.querySelector('.lesson-next')).toBeNull()
  })

  it('unknown lesson id falls back to the list', () => {
    renderLearn(root, { lessonId: 'no-such-lesson' })
    expect(root.querySelectorAll('.lesson-link').length).toBe(LESSONS.length)
  })
})
