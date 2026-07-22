// Entry drill: a realistic holding clearance plus the current heading on the
// HSI; the pilot picks direct / teardrop / parallel. Grading, sectors, and
// guidance all come from the engine (`determineEntry` is the oracle).
//
// Two modes:
//   learn   — untimed, thumb band and sector wedges visible (aids are
//             legitimate on the written test per FAA Order 8080.6H)
//   cockpit — no aids, 15 s target per answer; results feed the stored
//             benchmark window (18/20 correct <10 s, 95% <15 s)

import type { Screen } from '../app/router'
import {
  benchmarkReport,
  store as appStore,
  type BenchmarkReport,
  type Store,
} from '../app/store'
import { generateClearance, mulberry32, type HoldSpec } from '../engine/clearance'
import {
  determineEntry,
  ENTRIES,
  entryGuidance,
  type Entry,
  type EntryGuidance,
  type EntryResult,
} from '../engine/entry'
import { renderHSI, type HSIProps } from '../ui/hsi'

export type DrillMode = 'learn' | 'cockpit'

export const COCKPIT_TARGET_SECONDS = 15

/** Cockpit results live under 'entry' — the drill the stored benchmark scores. */
const DRILL_IDS: Record<DrillMode, string> = { cockpit: 'entry', learn: 'entry-learn' }

export interface EntryScenario {
  seed: number
  /** Aircraft heading when the clearance is received. */
  heading: number
  clearanceText: string
  holdSpec: HoldSpec
  /** Engine answer key: primary entry, boundary alternates, sector arcs. */
  result: EntryResult
}

export interface AnswerFeedback {
  correct: boolean
  chosen: Entry
  result: EntryResult
  guidance: EntryGuidance
  timeSeconds: number
  /** Answer took longer than the cockpit target. */
  overTarget: boolean
}

export interface EntryDrillOptions {
  mode?: DrillMode
  seed?: number
  store?: Store
  now?: () => number
}

export interface EntryDrillController {
  readonly mode: DrillMode
  readonly scenario: EntryScenario
  readonly session: { attempts: number; correct: number }
  answer(chosen: Entry): AnswerFeedback
  next(): EntryScenario
  /** Scores the stored cockpit window against the entry benchmark. */
  benchmark(): BenchmarkReport
}

export function generateScenario(seed: number): EntryScenario {
  const { clearance, holdSpec } = generateClearance(seed)
  // Decorrelated stream from the same seed so the heading stays independent
  // of whatever the clearance generator drew.
  const rng = mulberry32(Math.trunc(seed) ^ 0x9e3779b9)
  const heading = Math.floor(rng() * 360)
  return {
    seed,
    heading,
    clearanceText: clearance.text,
    holdSpec,
    result: determineEntry(heading, holdSpec),
  }
}

/** Correct = the engine's primary entry or any ±5° boundary alternate. */
export function gradeEntryAnswer(chosen: Entry, result: EntryResult): boolean {
  return chosen === result.primary || result.alternates.includes(chosen)
}

export function createEntryDrill(options: EntryDrillOptions = {}): EntryDrillController {
  const mode = options.mode ?? 'learn'
  const store = options.store ?? appStore
  const now = options.now ?? (() => Date.now())

  let seed = options.seed ?? Math.floor(Math.random() * 2 ** 31)
  let scenario = generateScenario(seed)
  let shownAt = now()
  let answered = false
  const session = { attempts: 0, correct: 0 }

  return {
    mode,
    get scenario() {
      return scenario
    },
    get session() {
      return session
    },

    answer(chosen: Entry): AnswerFeedback {
      if (answered) {
        throw new Error('scenario already answered; call next()')
      }
      answered = true
      const timeSeconds = (now() - shownAt) / 1000
      const correct = gradeEntryAnswer(chosen, scenario.result)

      session.attempts += 1
      if (correct) {
        session.correct += 1
      }
      const drill = DRILL_IDS[mode]
      store.recordDrillResult(drill, { correct, timeSeconds })
      if (!correct) {
        store.recordMiss(drill, {
          seed: scenario.seed,
          heading: scenario.heading,
          holdSpec: scenario.holdSpec,
          clearanceText: scenario.clearanceText,
          chosen,
          expected: scenario.result.primary,
          alternates: scenario.result.alternates,
        })
      }

      return {
        correct,
        chosen,
        result: scenario.result,
        guidance: entryGuidance(scenario.result.primary, scenario.holdSpec),
        timeSeconds,
        overTarget: timeSeconds > COCKPIT_TARGET_SECONDS,
      }
    },

    next(): EntryScenario {
      seed += 1
      scenario = generateScenario(seed)
      shownAt = now()
      answered = false
      return scenario
    },

    benchmark(): BenchmarkReport {
      return benchmarkReport(store.loadState().drills[DRILL_IDS.cockpit])
    },
  }
}

// --- screen -----------------------------------------------------------------

const ENTRY_LABELS: Record<Entry, string> = {
  direct: 'Direct',
  teardrop: 'Teardrop',
  parallel: 'Parallel',
}

/** Aviation course readout: three digits, 0 shown as 360. */
function course3(deg: number): string {
  const d = Math.round(deg) === 0 ? 360 : Math.round(deg)
  return `${String(d).padStart(3, '0')}°`
}

export function renderEntryDrill(el: HTMLElement, options: EntryDrillOptions = {}): void {
  const mode = options.mode ?? 'learn'
  const drill = createEntryDrill({ ...options, mode })

  el.innerHTML = `
    <section class="entry-drill">
      <h1>Entry Drill</h1>
      <div class="entry-modes" role="group" aria-label="Drill mode">
        <button class="entry-mode" data-mode="learn" aria-pressed="${mode === 'learn'}">Learn</button>
        <button class="entry-mode" data-mode="cockpit" aria-pressed="${mode === 'cockpit'}">Cockpit · ${COCKPIT_TARGET_SECONDS} s</button>
      </div>
      <p class="entry-clearance"></p>
      <div class="entry-hsi"></div>
      <div class="entry-answers">
        ${ENTRIES.map(
          (e) => `<button class="entry-answer" data-entry="${e}">${ENTRY_LABELS[e]}</button>`,
        ).join('')}
      </div>
      <div class="entry-feedback" aria-live="polite"></div>
      <button class="entry-next" hidden>Next</button>
      <p class="entry-stats"></p>
    </section>
  `

  const clearanceEl = el.querySelector<HTMLElement>('.entry-clearance')!
  const hsiEl = el.querySelector<HTMLElement>('.entry-hsi')!
  const feedbackEl = el.querySelector<HTMLElement>('.entry-feedback')!
  const nextBtn = el.querySelector<HTMLButtonElement>('.entry-next')!
  const statsEl = el.querySelector<HTMLElement>('.entry-stats')!
  const answerBtns = [...el.querySelectorAll<HTMLButtonElement>('.entry-answer')]

  function drawHSI(showSectors: boolean): void {
    const { heading, holdSpec, result } = drill.scenario
    const props: HSIProps = { heading, course: holdSpec.inboundCourse }
    if (mode === 'learn') {
      props.thumbOverlay = holdSpec.turnDirection
    }
    if (mode === 'learn' || showSectors) {
      props.sectorOverlay = result.sectors
    }
    renderHSI(hsiEl, props)
  }

  function updateStats(): void {
    const { attempts, correct } = drill.session
    const b = drill.benchmark()
    const median = b.medianTimeSeconds === null ? '—' : `${b.medianTimeSeconds.toFixed(1)} s`
    statsEl.textContent =
      `Session ${correct}/${attempts}. Cockpit benchmark (18/20 correct under 10 s, ` +
      `95% under 15 s): ${b.correctUnderTarget}/${b.attempts} under target, median ${median} — ` +
      `${b.met ? 'met' : 'not yet met'}.`
  }

  function showScenario(): void {
    clearanceEl.textContent = `“${drill.scenario.clearanceText}”`
    drawHSI(false)
    feedbackEl.textContent = ''
    feedbackEl.className = 'entry-feedback'
    nextBtn.hidden = true
    for (const btn of answerBtns) {
      btn.disabled = false
    }
    updateStats()
  }

  function showFeedback(fb: AnswerFeedback): void {
    drawHSI(true)
    const primary = ENTRY_LABELS[fb.result.primary]
    const alternates = fb.result.alternates.map((a) => ENTRY_LABELS[a]).join(' or ')
    const alternateNote = alternates
      ? ` ${alternates} also acceptable — within 5° of a sector boundary.`
      : ''
    const verdict = fb.correct
      ? `Correct — ${primary} entry.${alternateNote}`
      : `Not quite — you chose ${ENTRY_LABELS[fb.chosen]}; correct answer: ${primary}.${alternateNote}`
    const g = fb.guidance
    const timing =
      `Answered in ${fb.timeSeconds.toFixed(1)} s` +
      (mode === 'cockpit' && fb.overTarget ? ` — over the ${COCKPIT_TARGET_SECONDS} s target` : '')

    feedbackEl.className = `entry-feedback ${fb.correct ? 'is-correct' : 'is-wrong'}`
    feedbackEl.innerHTML = `
      <p class="entry-verdict">${verdict}</p>
      <p class="entry-guidance">Fly it: cross the fix, outbound heading ${course3(g.outboundHeading)}
        on the ${g.side} side, then ${g.turnToInbound} turn back to the inbound course.</p>
      <p class="entry-timing">${timing}</p>
      <p class="entry-source"><cite>${fb.result.source}</cite></p>
    `
    for (const btn of answerBtns) {
      btn.disabled = true
    }
    nextBtn.hidden = false
    updateStats()
  }

  for (const btn of answerBtns) {
    btn.addEventListener('click', () => {
      showFeedback(drill.answer(btn.dataset['entry'] as Entry))
    })
  }
  nextBtn.addEventListener('click', () => {
    drill.next()
    showScenario()
  })
  for (const btn of el.querySelectorAll<HTMLButtonElement>('.entry-mode')) {
    btn.addEventListener('click', () => {
      renderEntryDrill(el, { ...options, mode: btn.dataset['mode'] as DrillMode })
    })
  }

  showScenario()
}

export const entryDrillScreen: Screen = {
  path: 'entry-drill',
  title: 'Entry Drill',
  render(el) {
    renderEntryDrill(el)
  },
}
