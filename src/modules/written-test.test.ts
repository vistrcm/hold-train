import { describe, expect, it } from 'vitest'
import { createStore, type Store } from '../app/store'
import { QUESTIONS, type WrittenQuestion } from '../content/questions'
import {
  createWrittenTest,
  EXAM_LENGTH,
  renderWrittenTest,
  selectExamQuestions,
  writtenTestScreen,
} from './written-test'

/** In-memory store so tests never touch jsdom localStorage. */
function testStore(): Store {
  return createStore({ storage: undefined, now: () => 1234 })
}

function fakeClock(startMs = 0): { now: () => number; advance: (ms: number) => void } {
  let t = startMs
  return {
    now: () => t,
    advance(ms: number) {
      t += ms
    },
  }
}

function wrongIndex(q: WrittenQuestion): number {
  return (q.answerIndex + 1) % q.options.length
}

describe('selectExamQuestions', () => {
  it('same seed selects the same fixed-length exam', () => {
    const a = selectExamQuestions(QUESTIONS, 42, EXAM_LENGTH)
    const b = selectExamQuestions(QUESTIONS, 42, EXAM_LENGTH)
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
    expect(a).toHaveLength(EXAM_LENGTH)
  })

  it('different seeds shuffle differently and questions are distinct', () => {
    const a = selectExamQuestions(QUESTIONS, 1, EXAM_LENGTH)
    const b = selectExamQuestions(QUESTIONS, 2, EXAM_LENGTH)
    expect(new Set(a.map((q) => q.id)).size).toBe(EXAM_LENGTH)
    expect(a.map((q) => q.id)).not.toEqual(b.map((q) => q.id))
  })

  it('caps at the bank size and rejects a non-finite seed', () => {
    expect(selectExamQuestions(QUESTIONS, 3, 10_000)).toHaveLength(QUESTIONS.length)
    expect(() => selectExamQuestions(QUESTIONS, NaN, 5)).toThrow(RangeError)
  })
})

describe('practice mode', () => {
  it('gives immediate feedback with explanation and citation', () => {
    const test = createWrittenTest({ mode: 'practice', seed: 7, store: testStore() })
    const q = test.question
    const fb = test.answer(q.answerIndex)!
    expect(fb.correct).toBe(true)
    expect(fb.answerIndex).toBe(q.answerIndex)
    expect(fb.explanation).toBe(q.explanation)
    expect(fb.source).toBe(q.source)
  })

  it('records results and misses (with a question snapshot) in the store', () => {
    const store = testStore()
    const clock = fakeClock()
    const test = createWrittenTest({ mode: 'practice', seed: 7, store, now: clock.now })
    const first = test.question
    clock.advance(4000)
    test.answer(wrongIndex(first))
    test.next()
    test.answer(test.question.answerIndex)

    const state = store.loadState()
    expect(state.drills['written']).toMatchObject({ attempts: 2, correct: 1 })
    expect(state.drills['written']!.recent[0]).toMatchObject({ correct: false, timeSeconds: 4 })
    expect(state.misses).toHaveLength(1)
    expect(state.misses[0]!.scenario).toMatchObject({
      questionId: first.id,
      chosen: first.options[wrongIndex(first)],
      correctOption: first.options[first.answerIndex],
    })
  })

  it('walks the whole bank without repeating and finishes', () => {
    const test = createWrittenTest({ mode: 'practice', seed: 1, store: testStore() })
    const seen = new Set<string>()
    while (!test.finished) {
      seen.add(test.question.id)
      test.answer(0)
      test.next()
    }
    expect(seen.size).toBe(QUESTIONS.length)
  })
})

describe('exam mode', () => {
  it('is fixed-length and never leaks the key or explanation while running', () => {
    const test = createWrittenTest({ mode: 'exam', seed: 9, store: testStore() })
    expect(test.length).toBe(EXAM_LENGTH)
    expect(test.answer(0)).toBeNull()
  })

  it('refuses an empty question bank rather than scoring 0/0', () => {
    expect(() => createWrittenTest({ bank: [], store: testStore() })).toThrow(/empty/)
  })

  it('report throws until the exam is finished', () => {
    const test = createWrittenTest({ mode: 'exam', seed: 9, store: testStore() })
    expect(() => test.report()).toThrow()
  })

  it('scores the exam and reports weak topics (accuracy below 70%)', () => {
    const store = testStore()
    const test = createWrittenTest({ mode: 'exam', seed: 5, store })
    const answered: Array<{ topic: string; correct: boolean }> = []
    while (!test.finished) {
      const q = test.question
      // Miss every 'speeds' question; answer everything else correctly.
      const miss = q.topic === 'speeds'
      answered.push({ topic: q.topic, correct: !miss })
      test.answer(miss ? wrongIndex(q) : q.answerIndex)
      test.next()
    }
    // Pin the fixture: both topic assertions below go vacuous if seed 5's exam
    // happens to draw no 'speeds' question (nothing missed, so weakTopics is
    // trivially empty) or no 'timing' question (trivially absent).
    expect(answered.filter((a) => a.topic === 'speeds').length).toBeGreaterThan(0)
    expect(answered.filter((a) => a.topic === 'timing').length).toBeGreaterThan(0)

    const report = test.report()
    const expectedCorrect = answered.filter((a) => a.correct).length
    expect(report.total).toBe(EXAM_LENGTH)
    expect(report.correct).toBe(expectedCorrect)
    expect(report.scorePercent).toBe(Math.round((100 * expectedCorrect) / EXAM_LENGTH))
    const missedTopics = new Set(answered.filter((a) => !a.correct).map((a) => a.topic))
    for (const topic of missedTopics) {
      expect(report.weakTopics).toContain(topic)
    }
    expect(report.weakTopics).not.toContain('timing')
  })

  it('records exam results under written-exam and misses with snapshots', () => {
    const store = testStore()
    const test = createWrittenTest({ mode: 'exam', seed: 5, store })
    let missed = 0
    while (!test.finished) {
      const q = test.question
      const miss = q.topic === 'entry'
      if (miss) missed += 1
      test.answer(miss ? wrongIndex(q) : q.answerIndex)
      test.next()
    }
    const state = store.loadState()
    expect(state.drills['written-exam']!.attempts).toBe(EXAM_LENGTH)
    expect(state.drills['written-exam']!.correct).toBe(EXAM_LENGTH - missed)
    expect(state.misses).toHaveLength(missed)
    expect(state.misses.every((m) => m.drill === 'written-exam')).toBe(true)
  })
})

describe('option shuffling (no answer-position signal)', () => {
  function walk(test: ReturnType<typeof createWrittenTest>): WrittenQuestion[] {
    const seen: WrittenQuestion[] = []
    while (!test.finished) {
      seen.push(test.question)
      test.answer(0)
      test.next()
    }
    return seen
  }

  it('shuffles options per run but keeps the keyed option text correct', () => {
    const byId = new Map(QUESTIONS.map((q) => [q.id, q]))
    const run = walk(createWrittenTest({ mode: 'practice', seed: 5, store: testStore() }))
    let reordered = 0
    for (const q of run) {
      const bankQ = byId.get(q.id)!
      // same options as the bank (as a set), key still points at the same text
      expect([...q.options].sort()).toEqual([...bankQ.options].sort())
      expect(q.options[q.answerIndex]).toBe(bankQ.options[bankQ.answerIndex])
      if (q.options.join('|') !== bankQ.options.join('|')) {
        reordered += 1
      }
    }
    // The bank keys 23/32 static questions at index 0; the shuffle must
    // actually move options, not just be a no-op permutation.
    expect(reordered).toBeGreaterThan(QUESTIONS.length / 4)
  })

  it('is deterministic for a given seed', () => {
    const a = walk(createWrittenTest({ mode: 'practice', seed: 8, store: testStore() }))
    const b = walk(createWrittenTest({ mode: 'practice', seed: 8, store: testStore() }))
    expect(a.map((q) => q.options)).toEqual(b.map((q) => q.options))
  })
})

describe('controller guards', () => {
  it('rejects answering twice, out-of-range choices, and next() before answering', () => {
    const test = createWrittenTest({ mode: 'practice', seed: 3, store: testStore() })
    expect(() => test.next()).toThrow()
    expect(() => test.answer(99)).toThrow(RangeError)
    test.answer(0)
    expect(() => test.answer(0)).toThrow()
  })

  it('next() past the last question keeps finished state and question access throws', () => {
    const bank = QUESTIONS.slice(0, 2)
    const test = createWrittenTest({ mode: 'practice', seed: 3, store: testStore(), bank })
    test.answer(0)
    test.next()
    test.answer(0)
    expect(test.next()).toBeNull()
    expect(test.finished).toBe(true)
    expect(() => test.question).toThrow()
  })
})

describe('renderWrittenTest (jsdom)', () => {
  it('practice: renders a question, shows feedback with citation on answer, advances on next', () => {
    const el = document.createElement('div')
    renderWrittenTest(el, { mode: 'practice', seed: 11, store: testStore() })
    const firstText = el.querySelector('.written-question')!.textContent
    expect(firstText!.trim().length).toBeGreaterThan(0)
    const option = el.querySelector<HTMLButtonElement>('.written-option')!
    option.click()
    expect(el.querySelector('.written-feedback')!.textContent).toMatch(/AIM|CFR|JO 7110|AL-|ACS/)
    el.querySelector<HTMLButtonElement>('.written-next')!.click()
    expect(el.querySelector('.written-question')!.textContent).not.toBe(firstText)
  })

  it('exam: shows progress, no feedback mid-exam, and a score report at the end', () => {
    const el = document.createElement('div')
    renderWrittenTest(el, { mode: 'exam', seed: 11, store: testStore() })
    expect(el.textContent).toContain(`1 of ${EXAM_LENGTH}`)
    for (let i = 0; i < EXAM_LENGTH; i++) {
      el.querySelector<HTMLButtonElement>('.written-option')!.click()
      expect(el.querySelector('.written-feedback')).toBeNull()
      el.querySelector<HTMLButtonElement>('.written-next')!.click()
    }
    const report = el.querySelector('.written-report')!
    expect(report.textContent).toMatch(/%/)
    expect(report.textContent).toMatch(/weak|Weak|strong|Strong|all topics/i)
  })

  // showReport clears the question, options and progress; the figure is only
  // reset by showQuestion, so an entry question as the last item left its HSI
  // hanging above the score — a heading rose the student can no longer act on.
  it('clears the HSI figure when the score report replaces the question', () => {
    const entryBank = QUESTIONS.filter((q) => q.entry !== undefined)
    const el = document.createElement('div')
    renderWrittenTest(el, { mode: 'practice', seed: 1, store: testStore(), bank: entryBank })
    const figure = el.querySelector<HTMLElement>('.written-figure')!
    expect(figure.hidden).toBe(false) // entry question → rose is up

    // answer through the end of the bank
    while (el.querySelector('.written-report') === null) {
      el.querySelector<HTMLButtonElement>('.written-option')!.click()
      el.querySelector<HTMLButtonElement>('.written-next')!.click()
    }
    expect(figure.hidden).toBe(true)
    expect(figure.querySelector('svg.hsi')).toBeNull()
  })

  it('shows an HSI figure for entry questions and none otherwise', () => {
    const entryBank = QUESTIONS.filter((q) => q.entry !== undefined)
    const el = document.createElement('div')
    renderWrittenTest(el, { mode: 'practice', seed: 1, store: testStore(), bank: entryBank })
    const figure = el.querySelector<HTMLElement>('.written-figure')!
    expect(figure.hidden).toBe(false)
    expect(figure.querySelector('svg.hsi')).not.toBeNull()

    const plainBank = QUESTIONS.filter((q) => q.entry === undefined)
    const el2 = document.createElement('div')
    renderWrittenTest(el2, { mode: 'practice', seed: 1, store: testStore(), bank: plainBank })
    expect(el2.querySelector<HTMLElement>('.written-figure')!.hidden).toBe(true)
  })

  it('registers as a screen', () => {
    expect(writtenTestScreen.path).toBe('written-test')
    expect(writtenTestScreen.title.length).toBeGreaterThan(0)
  })
})

describe('createWrittenTest input validation', () => {
  it('rejects an empty bank instead of reporting NaN percent', () => {
    // An empty run is "finished" at construction, so report() would divide by
    // zero and hand the dashboard a NaN score.
    expect(() => createWrittenTest({ bank: [], store: testStore() })).toThrow(RangeError)
  })
})
