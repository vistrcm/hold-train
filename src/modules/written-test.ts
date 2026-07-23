// Written test: FAA-IRA-style multiple choice from the question bank.
//
// Two modes:
//   practice — walks the whole (seeded-shuffled) bank; immediate feedback
//              with explanation and FAA citation; misses recorded
//   exam     — fixed-length simulation: no feedback until the end, literal
//              option formats (incl. "Parallel or teardrop"), then a score
//              report with weak topics
//
// Option order is shuffled per run (seeded) — the bank's key positions are
// skewed toward index 0, and a fixed order would leak the answer.
//
// Entry-question keys are engine-generated in the bank itself — this module
// never re-derives or hand-keys an answer.

import type { Screen } from '../app/router'
import { store as appStore, type Store } from '../app/store'
import { mulberry32 } from '../engine/clearance'
import { QUESTIONS, type Topic, type WrittenQuestion } from '../content/questions'
import { renderHSI } from '../ui/hsi'

export type TestMode = 'practice' | 'exam'

export const EXAM_LENGTH = 20

/** Topics scored below this fraction in an exam are reported as weak. */
export const WEAK_TOPIC_THRESHOLD = 0.7

/** Exam results live under 'written-exam'; practice under 'written'. */
const DRILL_IDS: Record<TestMode, string> = { practice: 'written', exam: 'written-exam' }

/**
 * Practice-mode feedback. Exam mode gets null instead, so the key,
 * explanation, and citation cannot leak into the UI mid-exam.
 */
export interface AnswerFeedback {
  correct: boolean
  answerIndex: number
  explanation: string
  source: string
}

export interface ExamReport {
  total: number
  correct: number
  scorePercent: number
  /** Topics answered below WEAK_TOPIC_THRESHOLD accuracy in this run. */
  weakTopics: Topic[]
}

export interface WrittenTestOptions {
  mode?: TestMode
  seed?: number
  store?: Store
  now?: () => number
  bank?: readonly WrittenQuestion[]
}

export interface WrittenTestController {
  readonly mode: TestMode
  /** Questions in this run. */
  readonly length: number
  readonly index: number
  readonly finished: boolean
  readonly question: WrittenQuestion
  /** Practice: graded feedback. Exam: null (no leak until the report). */
  answer(choice: number): AnswerFeedback | null
  /** Advances; returns the next question or null when the run is finished. */
  next(): WrittenQuestion | null
  /** Scores a finished run; throws while questions remain. */
  report(): ExamReport
}

/** Seeded Fisher–Yates draw of `length` distinct questions from the bank. */
export function selectExamQuestions(
  bank: readonly WrittenQuestion[],
  seed: number,
  length: number,
): WrittenQuestion[] {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`seed must be a finite number, got ${seed}`)
  }
  const rng = mulberry32(Math.trunc(seed))
  const pool = [...bank]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = pool[i]!
    pool[i] = pool[j]!
    pool[j] = tmp
  }
  return pool.slice(0, Math.min(length, pool.length))
}

/**
 * Seeded per-run shuffle of a question's options (key position remapped).
 * The bank keys most static questions at index 0; without this, "always
 * pick A" would score far above chance in exam mode.
 */
function shuffleOptions(q: WrittenQuestion, rng: () => number): WrittenQuestion {
  const order = q.options.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = order[i]!
    order[i] = order[j]!
    order[j] = tmp
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]!),
    answerIndex: order.indexOf(q.answerIndex),
  }
}

export function createWrittenTest(options: WrittenTestOptions = {}): WrittenTestController {
  const mode = options.mode ?? 'practice'
  const store = options.store ?? appStore
  const now = options.now ?? (() => Date.now())
  const bank = options.bank ?? QUESTIONS
  if (bank.length === 0) {
    // An empty run finishes immediately and scores 0/0 — NaN percent, no report.
    throw new RangeError('question bank is empty')
  }
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31)
  // +1 keeps the option stream independent of the selection stream.
  const optionRng = mulberry32(Math.trunc(seed) + 1)
  const run = selectExamQuestions(bank, seed, mode === 'exam' ? EXAM_LENGTH : bank.length).map(
    (q) => shuffleOptions(q, optionRng),
  )
  const drill = DRILL_IDS[mode]

  let index = 0
  let answered = false
  let shownAt = now()
  const results: Array<{ question: WrittenQuestion; correct: boolean }> = []

  const finished = (): boolean => index >= run.length

  function current(): WrittenQuestion {
    const q = run[index]
    if (q === undefined) {
      throw new Error('test is finished; no current question')
    }
    return q
  }

  return {
    mode,
    length: run.length,
    get index() {
      return index
    },
    get finished() {
      return finished()
    },
    get question() {
      return current()
    },

    answer(choice: number): AnswerFeedback | null {
      const q = current()
      if (answered) {
        throw new Error('question already answered; call next()')
      }
      if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) {
        throw new RangeError(`choice must be 0..${q.options.length - 1}, got ${choice}`)
      }
      answered = true
      const correct = choice === q.answerIndex
      const timeSeconds = (now() - shownAt) / 1000
      results.push({ question: q, correct })
      store.recordDrillResult(drill, { correct, timeSeconds })
      if (!correct) {
        store.recordMiss(drill, {
          questionId: q.id,
          topic: q.topic,
          question: q.question,
          chosen: q.options[choice],
          correctOption: q.options[q.answerIndex],
          explanation: q.explanation,
          source: q.source,
        })
      }
      if (mode === 'exam') {
        return null
      }
      return {
        correct,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
        source: q.source,
      }
    },

    next(): WrittenQuestion | null {
      if (finished()) {
        return null
      }
      if (!answered) {
        throw new Error('answer the current question before calling next()')
      }
      index += 1
      answered = false
      shownAt = now()
      return finished() ? null : current()
    },

    report(): ExamReport {
      if (!finished()) {
        throw new Error('report is available only after the last question')
      }
      const byTopic = new Map<Topic, { attempts: number; correct: number }>()
      let correct = 0
      for (const r of results) {
        correct += r.correct ? 1 : 0
        const t = byTopic.get(r.question.topic) ?? { attempts: 0, correct: 0 }
        t.attempts += 1
        t.correct += r.correct ? 1 : 0
        byTopic.set(r.question.topic, t)
      }
      const weakTopics = [...byTopic.entries()]
        .filter(([, t]) => t.correct / t.attempts < WEAK_TOPIC_THRESHOLD)
        .map(([topic]) => topic)
      return {
        total: run.length,
        correct,
        scorePercent: Math.round((100 * correct) / run.length),
        weakTopics,
      }
    },
  }
}

// --- screen -----------------------------------------------------------------

const TOPIC_LABELS: Record<Topic, string> = {
  entry: 'entry procedures',
  speeds: 'maximum speeds',
  timing: 'timing and DME legs',
  reports: 'required reports',
  'lost-comm': 'lost communications',
  pattern: 'pattern basics',
  chart: 'chart scenarios',
}

export function renderWrittenTest(el: HTMLElement, options: WrittenTestOptions = {}): void {
  const mode = options.mode ?? 'practice'
  const test = createWrittenTest({ ...options, mode })

  el.innerHTML = `
    <section class="written-test">
      <h1>Written Test</h1>
      <div class="written-modes" role="group" aria-label="Test mode">
        <button class="written-mode" data-mode="practice" aria-pressed="${mode === 'practice'}">Practice</button>
        <button class="written-mode" data-mode="exam" aria-pressed="${mode === 'exam'}">Exam · ${EXAM_LENGTH} questions</button>
      </div>
      <p class="written-progress"></p>
      <p class="written-question"></p>
      <div class="written-figure" hidden></div>
      <div class="written-options"></div>
      <div class="written-panel" aria-live="polite"></div>
      <button class="written-next" hidden>Next</button>
    </section>
  `

  const progressEl = el.querySelector<HTMLElement>('.written-progress')!
  const questionEl = el.querySelector<HTMLElement>('.written-question')!
  const figureEl = el.querySelector<HTMLElement>('.written-figure')!
  const optionsEl = el.querySelector<HTMLElement>('.written-options')!
  const panelEl = el.querySelector<HTMLElement>('.written-panel')!
  const nextBtn = el.querySelector<HTMLButtonElement>('.written-next')!

  function showQuestion(): void {
    const q = test.question
    progressEl.textContent = `Question ${test.index + 1} of ${test.length}`
    questionEl.textContent = q.question
    // Entry questions show the cockpit picture (heading-up HSI, course pointer
    // on the inbound course) — no overlays, so no answer leaks.
    figureEl.hidden = q.entry === undefined
    figureEl.innerHTML = ''
    if (q.entry !== undefined) {
      renderHSI(figureEl, { heading: q.entry.heading, course: q.entry.inboundCourse })
    }
    optionsEl.innerHTML = q.options
      .map((o, i) => `<button class="written-option" data-index="${i}">${o}</button>`)
      .join('')
    panelEl.innerHTML = ''
    nextBtn.hidden = true
    for (const btn of optionsEl.querySelectorAll<HTMLButtonElement>('.written-option')) {
      btn.addEventListener('click', () => {
        onAnswer(Number(btn.dataset['index']), btn)
      })
    }
  }

  function onAnswer(choice: number, chosenBtn: HTMLButtonElement): void {
    const fb = test.answer(choice)
    for (const btn of optionsEl.querySelectorAll<HTMLButtonElement>('.written-option')) {
      btn.disabled = true
    }
    chosenBtn.classList.add('is-chosen')
    // Exam mode: null — no verdict, key, or citation until the report.
    if (fb !== null) {
      const verdict = fb.correct
        ? 'Correct.'
        : `Not quite — correct answer: ${test.question.options[fb.answerIndex]}.`
      panelEl.innerHTML = `
        <div class="written-feedback ${fb.correct ? 'is-correct' : 'is-wrong'}">
          <p class="written-verdict">${verdict}</p>
          <p class="written-explanation">${fb.explanation}</p>
          <p class="written-source"><cite>${fb.source}</cite></p>
        </div>
      `
    }
    nextBtn.hidden = false
  }

  function showReport(): void {
    const r = test.report()
    const weak =
      r.weakTopics.length > 0
        ? `Weak topics to drill: ${r.weakTopics.map((t) => TOPIC_LABELS[t]).join(', ')}.`
        : 'Strong across all topics.'
    progressEl.textContent = ''
    questionEl.textContent = ''
    optionsEl.innerHTML = ''
    nextBtn.hidden = true
    panelEl.innerHTML = `
      <div class="written-report">
        <p class="written-score">${mode === 'exam' ? 'Exam' : 'Practice'} complete: ${r.correct}/${r.total} — ${r.scorePercent}%.</p>
        <p class="written-weak">${weak}</p>
      </div>
    `
  }

  nextBtn.addEventListener('click', () => {
    if (test.next() === null) {
      showReport()
      return
    }
    showQuestion()
  })
  for (const btn of el.querySelectorAll<HTMLButtonElement>('.written-mode')) {
    btn.addEventListener('click', () => {
      renderWrittenTest(el, { ...options, mode: btn.dataset['mode'] as TestMode })
    })
  }

  showQuestion()
}

export const writtenTestScreen: Screen = {
  path: 'written-test',
  title: 'Written Test',
  render(el) {
    renderWrittenTest(el)
  },
}
