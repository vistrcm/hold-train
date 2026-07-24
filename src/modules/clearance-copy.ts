// Clearance copy drill: the clearance is shown briefly, then hidden (like a
// real radio call); the pilot fills a structured field form which is graded
// field by field by the engine (`gradeCopiedClearance` is the oracle). The
// omitted-turn-direction trap (silence means right turns) is surfaced
// distinctly in the review.
//
// TO/FROM micro-drill mode: a radial points FROM the station, a bearing points
// TO it (FAA Pilot/Controller Glossary) — given one or the other, tap which
// side of the station the hold is on.

import type { Screen } from '../app/router'
import { store as appStore, type Store } from '../app/store'
import {
  generateClearance,
  gradeCopiedClearance,
  mulberry32,
  type ClearanceFields,
  type ClearanceGrade,
  type CopiedClearance,
  type GradedField,
  type HoldSpec,
} from '../engine/clearance'
import { cardinalFromCourse, normalizeDeg, reciprocal, type Cardinal } from '../engine/geometry'
import { courseText } from '../format'

export type CopyMode = 'copy' | 'tofrom'

/** Roughly radio speech pace; the clearance stays up about as long as it is spoken. */
export const LISTEN_MS_PER_WORD = 450
export const MIN_LISTEN_MS = 4000

export function listenMillis(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(MIN_LISTEN_MS, words * LISTEN_MS_PER_WORD)
}

// --- copy drill --------------------------------------------------------------

const COPY_DRILL_ID = 'clearance-copy'

export interface CopyScenario {
  seed: number
  clearanceText: string
  holdSpec: HoldSpec
  expected: ClearanceFields
  source: string
}

export interface CopyFeedback {
  correct: boolean
  grade: ClearanceGrade
  timeSeconds: number
}

export interface CopyDrillOptions {
  seed?: number
  store?: Store
  now?: () => number
}

export interface CopyDrillController {
  readonly scenario: CopyScenario
  readonly session: { attempts: number; correct: number }
  submit(user: CopiedClearance): CopyFeedback
  next(): CopyScenario
}

export function generateCopyScenario(seed: number): CopyScenario {
  const { clearance, holdSpec, expectedFields } = generateClearance(seed)
  return {
    seed,
    clearanceText: clearance.text,
    holdSpec,
    expected: expectedFields,
    source: clearance.source,
  }
}

export function createClearanceCopyDrill(options: CopyDrillOptions = {}): CopyDrillController {
  const store = options.store ?? appStore
  const now = options.now ?? (() => Date.now())

  let seed = options.seed ?? Math.floor(Math.random() * 2 ** 31)
  let scenario = generateCopyScenario(seed)
  let shownAt = now()
  let answered = false
  const session = { attempts: 0, correct: 0 }

  return {
    get scenario() {
      return scenario
    },
    get session() {
      return session
    },

    submit(user: CopiedClearance): CopyFeedback {
      if (answered) {
        throw new Error('scenario already graded; call next()')
      }
      answered = true
      const timeSeconds = (now() - shownAt) / 1000
      const grade = gradeCopiedClearance(user, scenario.expected)

      session.attempts += 1
      if (grade.allCorrect) {
        session.correct += 1
      }
      store.recordDrillResult(COPY_DRILL_ID, { correct: grade.allCorrect, timeSeconds })
      if (!grade.allCorrect) {
        store.recordMiss(COPY_DRILL_ID, {
          seed: scenario.seed,
          clearanceText: scenario.clearanceText,
          holdSpec: scenario.holdSpec,
          expected: scenario.expected,
          user,
          wrongFields: grade.fields.filter((f) => !f.correct).map((f) => f.field),
        })
      }

      return {
        correct: grade.allCorrect,
        grade,
        timeSeconds,
      }
    },

    next(): CopyScenario {
      seed += 1
      scenario = generateCopyScenario(seed)
      shownAt = now()
      answered = false
      return scenario
    },
  }
}

// --- TO/FROM micro-drill -----------------------------------------------------

const TOFROM_DRILL_ID = 'to-from'
const TOFROM_SOURCE = 'FAA Pilot/Controller Glossary: RADIAL, BEARING; AIM 5-3-8 i'

export type StatedCourseKind = 'radial' | 'bearing'

/**
 * Which side of the station the hold is on. A radial points FROM the station,
 * so the hold sits out along it; a bearing points TO the station, so the hold
 * lies on the reciprocal side.
 */
export function holdSide(kind: StatedCourseKind, degrees: number): Cardinal {
  const d = normalizeDeg(degrees)
  return cardinalFromCourse(kind === 'radial' ? d : reciprocal(d))
}

export interface ToFromScenario {
  seed: number
  kind: StatedCourseKind
  degrees: number
  prompt: string
  answer: Cardinal
  explanation: string
  source: string
}

export function generateToFromScenario(seed: number): ToFromScenario {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`seed must be finite, got ${seed}`)
  }
  const rng = mulberry32(Math.trunc(seed))
  const kind: StatedCourseKind = rng() < 0.5 ? 'radial' : 'bearing'
  // Courses in 10° steps read naturally on the radio; 360 spoken, not 000.
  const degrees = 10 + 10 * Math.floor(rng() * 36)
  const answer = holdSide(kind, degrees)
  const spoken = kind === 'radial' ? 'radial' : 'bearing to the station'
  const inbound = kind === 'radial' ? reciprocal(normalizeDeg(degrees)) : normalizeDeg(degrees)
  const explanation =
    kind === 'radial'
      ? `A radial points FROM the station: the hold sits out along the ` +
        `${courseText(degrees)} radial, ${answer} of the station, ` +
        `inbound course ${courseText(inbound)}.`
      : `A bearing points TO the station: ${courseText(degrees)} is the inbound course, ` +
        `so the hold lies on the reciprocal side — ${answer} of the station.`
  return {
    seed,
    kind,
    degrees,
    prompt:
      `“Hold on the ${courseText(degrees)} ${spoken}.” ` +
      `Which side of the station is the hold?`,
    answer,
    explanation,
    source: TOFROM_SOURCE,
  }
}

export interface ToFromFeedback {
  correct: boolean
  chosen: Cardinal
  answer: Cardinal
  explanation: string
  source: string
  timeSeconds: number
}

export interface ToFromDrillController {
  readonly scenario: ToFromScenario
  readonly session: { attempts: number; correct: number }
  answer(chosen: Cardinal): ToFromFeedback
  next(): ToFromScenario
}

export function createToFromDrill(options: CopyDrillOptions = {}): ToFromDrillController {
  const store = options.store ?? appStore
  const now = options.now ?? (() => Date.now())

  let seed = options.seed ?? Math.floor(Math.random() * 2 ** 31)
  let scenario = generateToFromScenario(seed)
  let shownAt = now()
  let answered = false
  const session = { attempts: 0, correct: 0 }

  return {
    get scenario() {
      return scenario
    },
    get session() {
      return session
    },

    answer(chosen: Cardinal): ToFromFeedback {
      if (answered) {
        throw new Error('scenario already answered; call next()')
      }
      answered = true
      const timeSeconds = (now() - shownAt) / 1000
      const correct = chosen === scenario.answer

      session.attempts += 1
      if (correct) {
        session.correct += 1
      }
      store.recordDrillResult(TOFROM_DRILL_ID, { correct, timeSeconds })
      if (!correct) {
        store.recordMiss(TOFROM_DRILL_ID, {
          seed: scenario.seed,
          kind: scenario.kind,
          degrees: scenario.degrees,
          prompt: scenario.prompt,
          chosen,
          answer: scenario.answer,
          explanation: scenario.explanation,
        })
      }

      return {
        correct,
        chosen,
        answer: scenario.answer,
        explanation: scenario.explanation,
        source: scenario.source,
        timeSeconds,
      }
    },

    next(): ToFromScenario {
      seed += 1
      scenario = generateToFromScenario(seed)
      shownAt = now()
      answered = false
      return scenario
    },
  }
}

// --- screen ------------------------------------------------------------------

const CARDINALS: readonly Cardinal[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const FIELD_LABELS: Record<GradedField, string> = {
  direction: 'Hold direction',
  fix: 'Fix',
  holdingCourse: 'Holding course',
  legLength: 'Leg length',
  turnDirection: 'Turns',
  efc: 'EFC',
}

/** Human answer for a field, unstated fields resolved by rule. */
function expectedText(field: GradedField, expected: ClearanceFields): string {
  switch (field) {
    case 'direction':
      return expected.direction
    case 'fix':
      return expected.fix
    case 'holdingCourse':
      // courseDegrees is set whenever courseKind is radial/bearing: speakCourse
      // throws on a missing one, so the clearance could not have been spoken.
      return expected.courseKind === 'published'
        ? 'as published'
        : `${courseText(expected.courseDegrees!)} ${expected.courseKind === 'radial' ? 'radial' : 'bearing to the station'}`
    case 'legLength':
      if (expected.leg === 'published') {
        return 'per chart'
      }
      if (expected.leg === 'unstated') {
        return '1 minute (standard, not stated)'
      }
      return `${expected.leg.value} ${expected.leg.unit === 'nm' ? 'mile' : 'minute'}`
    case 'turnDirection':
      if (expected.courseKind === 'published') {
        return 'per chart'
      }
      return expected.turnDirection === 'left' ? 'left' : 'right (not stated)'
    case 'efc':
      return `${expected.efc}Z`
  }
}

function readCopiedClearance(root: HTMLElement): CopiedClearance | null {
  const turn = root.querySelector<HTMLInputElement>('input[name="turn"]:checked')
  if (turn === null) {
    return null
  }
  const courseKind = root.querySelector<HTMLInputElement>('input[name="courseKind"]:checked')!
    .value as CopiedClearance['courseKind']
  const legUnit = root.querySelector<HTMLSelectElement>('[data-field="legUnit"]')!.value
  const user: CopiedClearance = {
    direction: root.querySelector<HTMLSelectElement>('[data-field="direction"]')!
      .value as Cardinal,
    fix: root.querySelector<HTMLInputElement>('[data-field="fix"]')!.value,
    courseKind,
    leg:
      legUnit === 'published'
        ? 'published'
        : {
            unit: legUnit as 'min' | 'nm',
            value: Number(root.querySelector<HTMLInputElement>('[data-field="legValue"]')!.value),
          },
    turnDirection: turn.value as CopiedClearance['turnDirection'],
    efc: root.querySelector<HTMLInputElement>('[data-field="efc"]')!.value,
  }
  // Empty input coerces to 0, which normalizes equal to a spoken 360 — only a
  // typed number counts as copied.
  const raw = root.querySelector<HTMLInputElement>('[data-field="degrees"]')!.value.trim()
  if (courseKind !== 'published' && raw !== '' && Number.isFinite(Number(raw))) {
    user.courseDegrees = Number(raw)
  }
  return user
}

function renderCopyMode(pane: HTMLElement, options: CopyDrillOptions): void {
  const drill = createClearanceCopyDrill(options)

  pane.innerHTML = `
    <p class="copy-clearance"></p>
    <button class="copy-gotit">Got it — copy</button>
    <form class="copy-form" hidden>
      <label>Hold direction
        <select data-field="direction">
          ${CARDINALS.map((c) => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </label>
      <label>Fix <input data-field="fix" autocomplete="off"></label>
      <fieldset>
        <legend>Holding course</legend>
        <label><input type="radio" name="courseKind" value="radial" checked> Radial (FROM)</label>
        <label><input type="radio" name="courseKind" value="bearing"> Bearing (TO the station)</label>
        <label><input type="radio" name="courseKind" value="published"> As published</label>
        <label>Degrees <input data-field="degrees" type="number" inputmode="numeric"></label>
      </fieldset>
      <label>Leg length
        <select data-field="legUnit">
          <option value="min">minutes</option>
          <option value="nm">miles</option>
          <option value="published">as published</option>
        </select>
      </label>
      <label>Leg value <input data-field="legValue" type="number" inputmode="numeric" value="1"></label>
      <fieldset>
        <legend>Turns</legend>
        <label><input type="radio" name="turn" value="right"> Right</label>
        <label><input type="radio" name="turn" value="left"> Left</label>
      </fieldset>
      <label>EFC (zulu) <input data-field="efc" inputmode="numeric" autocomplete="off"></label>
      <p class="copy-error" aria-live="polite"></p>
      <button class="copy-submit" type="button">Grade my copy</button>
    </form>
    <div class="copy-review" aria-live="polite"></div>
    <button class="copy-next" hidden>Next</button>
    <p class="copy-stats"></p>
  `

  const clearanceEl = pane.querySelector<HTMLElement>('.copy-clearance')!
  const gotitBtn = pane.querySelector<HTMLButtonElement>('.copy-gotit')!
  const form = pane.querySelector<HTMLFormElement>('.copy-form')!
  const errorEl = pane.querySelector<HTMLElement>('.copy-error')!
  const reviewEl = pane.querySelector<HTMLElement>('.copy-review')!
  const nextBtn = pane.querySelector<HTMLButtonElement>('.copy-next')!
  const statsEl = pane.querySelector<HTMLElement>('.copy-stats')!
  const submitBtn = pane.querySelector<HTMLButtonElement>('.copy-submit')!
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  function updateStats(): void {
    const { attempts, correct } = drill.session
    statsEl.textContent = `Session ${correct}/${attempts} clearances copied clean.`
  }

  function hideClearance(): void {
    clearTimeout(hideTimer)
    clearanceEl.textContent = '…frequency quiet. Copy what you heard.'
    gotitBtn.hidden = true
    form.hidden = false
  }

  function showListening(): void {
    // Fresh scenario, fresh copy: markup defaults back (turn radios unchecked
    // so the standard-turns trap regrades honestly every time).
    form.reset()
    clearanceEl.textContent = `“${drill.scenario.clearanceText}”`
    gotitBtn.hidden = false
    form.hidden = true
    errorEl.textContent = ''
    reviewEl.innerHTML = ''
    nextBtn.hidden = true
    submitBtn.disabled = false
    updateStats()
    clearTimeout(hideTimer)
    hideTimer = setTimeout(hideClearance, listenMillis(drill.scenario.clearanceText))
  }

  function showReview(fb: CopyFeedback): void {
    form.hidden = true
    // The scenario is graded once; a second submit would throw out of the click
    // handler and wedge the drill.
    submitBtn.disabled = true
    const rows = fb.grade.fields
      .map((f) => {
        const cls = ['copy-row', f.correct ? 'is-correct' : 'is-wrong', f.trap ? 'is-trap' : '']
          .filter(Boolean)
          .join(' ')
        const note = f.note ? ` ${f.note}` : ''
        return (
          `<li class="${cls}" data-field="${f.field}">` +
          `${f.correct ? '✓' : '✗'} <strong>${FIELD_LABELS[f.field]}:</strong> ` +
          `${expectedText(f.field, drill.scenario.expected)}.${note}</li>`
        )
      })
      .join('')
    const verdict = fb.correct
      ? 'Clean copy — readback ready.'
      : `${fb.grade.fields.filter((f) => f.correct).length} of ${fb.grade.fields.length} fields correct.`
    reviewEl.innerHTML = `
      <p class="copy-verdict ${fb.correct ? 'is-correct' : 'is-wrong'}">${verdict}</p>
      <ul class="copy-rows">${rows}</ul>
      <p class="copy-spoken">As spoken: “${drill.scenario.clearanceText}”</p>
      <p class="copy-source"><cite>${drill.scenario.source}</cite></p>
    `
    nextBtn.hidden = false
    updateStats()
  }

  gotitBtn.addEventListener('click', hideClearance)
  submitBtn.addEventListener('click', () => {
    const user = readCopiedClearance(form)
    if (user === null) {
      errorEl.textContent = 'Pick a turn direction — silence from ATC still means one of them.'
      return
    }
    errorEl.textContent = ''
    showReview(drill.submit(user))
  })
  nextBtn.addEventListener('click', () => {
    drill.next()
    showListening()
  })

  showListening()
}

function renderToFromMode(pane: HTMLElement, options: CopyDrillOptions): void {
  const drill = createToFromDrill(options)

  pane.innerHTML = `
    <p class="tofrom-prompt"></p>
    <div class="tofrom-answers">
      ${CARDINALS.map((c) => `<button class="tofrom-answer" data-cardinal="${c}">${c}</button>`).join('')}
    </div>
    <div class="tofrom-feedback" aria-live="polite"></div>
    <button class="tofrom-next" hidden>Next</button>
    <p class="tofrom-stats"></p>
  `

  const promptEl = pane.querySelector<HTMLElement>('.tofrom-prompt')!
  const feedbackEl = pane.querySelector<HTMLElement>('.tofrom-feedback')!
  const nextBtn = pane.querySelector<HTMLButtonElement>('.tofrom-next')!
  const statsEl = pane.querySelector<HTMLElement>('.tofrom-stats')!
  const answerBtns = [...pane.querySelectorAll<HTMLButtonElement>('.tofrom-answer')]

  function showScenario(): void {
    promptEl.textContent = drill.scenario.prompt
    feedbackEl.innerHTML = ''
    feedbackEl.className = 'tofrom-feedback'
    nextBtn.hidden = true
    for (const btn of answerBtns) {
      btn.disabled = false
    }
    const { attempts, correct } = drill.session
    statsEl.textContent = `Session ${correct}/${attempts}.`
  }

  function showFeedback(fb: ToFromFeedback): void {
    feedbackEl.className = `tofrom-feedback ${fb.correct ? 'is-correct' : 'is-wrong'}`
    const verdict = fb.correct
      ? `Correct — ${fb.answer} of the station.`
      : `Not quite — you chose ${fb.chosen}; the hold is ${fb.answer} of the station.`
    feedbackEl.innerHTML = `
      <p class="tofrom-verdict">${verdict}</p>
      <p>${fb.explanation}</p>
      <p class="tofrom-source"><cite>${fb.source}</cite></p>
    `
    for (const btn of answerBtns) {
      btn.disabled = true
    }
    nextBtn.hidden = false
  }

  for (const btn of answerBtns) {
    btn.addEventListener('click', () => {
      showFeedback(drill.answer(btn.dataset['cardinal'] as Cardinal))
    })
  }
  nextBtn.addEventListener('click', () => {
    drill.next()
    showScenario()
  })

  showScenario()
}

export interface RenderCopyOptions extends CopyDrillOptions {
  mode?: CopyMode
}

export function renderClearanceCopy(el: HTMLElement, options: RenderCopyOptions = {}): void {
  const mode = options.mode ?? 'copy'

  el.innerHTML = `
    <section class="clearance-copy">
      <h1>Clearance Copy</h1>
      <div class="copy-modes" role="group" aria-label="Drill mode">
        <button class="copy-mode" data-mode="copy" aria-pressed="${mode === 'copy'}">Copy</button>
        <button class="copy-mode" data-mode="tofrom" aria-pressed="${mode === 'tofrom'}">TO/FROM</button>
      </div>
      <div class="copy-pane"></div>
    </section>
  `

  const pane = el.querySelector<HTMLElement>('.copy-pane')!
  if (mode === 'copy') {
    renderCopyMode(pane, options)
  } else {
    renderToFromMode(pane, options)
  }

  for (const btn of el.querySelectorAll<HTMLButtonElement>('.copy-mode')) {
    btn.addEventListener('click', () => {
      renderClearanceCopy(el, { ...options, mode: btn.dataset['mode'] as CopyMode })
    })
  }
}

export const clearanceCopyScreen: Screen = {
  path: 'clearance-copy',
  title: 'Clearance Copy',
  render(el) {
    renderClearanceCopy(el)
  },
}
