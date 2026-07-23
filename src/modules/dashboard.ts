// Progress dashboard: per-module readiness against the plan's benchmarks,
// activity stats for the remaining drills, and a checkride map from exam
// phases (written / oral / flight) to the modules and ACS Task III.B
// elements each phase draws on.
//
// All readiness math reads existing store data — the entry benchmark comes
// from store.benchmarkReport (the oracle for Task 7's targets), the exam-sim
// score reuses the written test's own pass threshold, and oral weak areas
// are recovered from the ACS tags already snapshotted into oral misses.

import { ankiExportScreen } from '../app/anki-export'
import type { Screen } from '../app/router'
import {
  averageTimeSeconds,
  benchmarkReport,
  ENTRY_BENCHMARK,
  store as appStore,
  type AppState,
  type Store,
} from '../app/store'
import { ACS_ELEMENTS, ACS_SOURCE, ORAL_ITEMS, type AcsKind } from '../content/oral'
import { clearanceCopyScreen } from './clearance-copy'
import { entryDrillScreen } from './entry-drill'
import { learnScreen } from './learn'
import { oralPrepScreen } from './oral-prep'
import { windLabScreen } from './wind-lab'
import { EXAM_LENGTH, WEAK_TOPIC_THRESHOLD, writtenTestScreen } from './written-test'

export interface ExamReadiness {
  /** Recent exam-sim answers considered (the store window is one full exam). */
  answered: number
  correct: number
  /** Fraction correct over the recent window; null before any answers. */
  score: number | null
  /** Full exam window answered at or above the written pass threshold. */
  met: boolean
}

export function examReadiness(state: AppState): ExamReadiness {
  const recent = state.drills['written-exam']?.recent ?? []
  const correct = recent.filter((r) => r.correct).length
  const score = recent.length > 0 ? correct / recent.length : null
  const met = recent.length >= EXAM_LENGTH && score !== null && score >= WEAK_TOPIC_THRESHOLD
  return { answered: recent.length, correct, score, met }
}

export interface OralReadiness {
  attempts: number
  bankSize: number
  /**
   * At least as many self-test answers recorded as the bank has items. This is
   * NOT item coverage — the store counts answers, not which items were seen, so
   * five items answered four times each also clears the bar.
   */
  bankWorthAnswered: boolean
  totalElements: number
  /** ACS codes tagged on recorded oral misses, in ACS order — weak areas. */
  missedElements: string[]
}

export function oralReadiness(state: AppState): OralReadiness {
  const attempts = state.drills['oral']?.attempts ?? 0
  const missed = new Set<string>()
  for (const miss of state.misses) {
    if (miss.drill !== 'oral') continue
    const acs = (miss.scenario as { acs?: unknown } | null)?.acs
    if (!Array.isArray(acs)) continue
    for (const code of acs) {
      if (typeof code === 'string') missed.add(code)
    }
  }
  return {
    attempts,
    bankSize: ORAL_ITEMS.length,
    bankWorthAnswered: attempts >= ORAL_ITEMS.length,
    totalElements: ACS_ELEMENTS.length,
    missedElements: ACS_ELEMENTS.filter((e) => missed.has(e.code)).map((e) => e.code),
  }
}

export type ExamPhase = 'written' | 'oral' | 'flight'

export interface PhasePrep {
  phase: ExamPhase
  label: string
  /** Modules to drill for this phase (real Screen objects — routes verified by tests). */
  screens: readonly Screen[]
  /** ACS element kinds this phase's prep targets. */
  kinds: readonly AcsKind[]
}

/**
 * Prep map: which modules build which exam phase. Element kinds follow the
 * ACS structure (knowledge / risk management / skills); the module grouping
 * is this app's study plan, not an FAA assignment.
 */
export const PHASE_PREP: readonly PhasePrep[] = [
  {
    phase: 'written',
    label: 'Written test',
    screens: [learnScreen, entryDrillScreen, writtenTestScreen],
    kinds: ['knowledge'],
  },
  {
    phase: 'oral',
    label: 'Oral exam',
    screens: [oralPrepScreen, clearanceCopyScreen, ankiExportScreen],
    kinds: ['knowledge', 'risk'],
  },
  {
    phase: 'flight',
    label: 'Flight test',
    screens: [entryDrillScreen, windLabScreen, clearanceCopyScreen],
    kinds: ['risk', 'skill'],
  },
]

/** ACS element codes for a phase, in ACS order. */
export function phaseElements(prep: PhasePrep): string[] {
  return ACS_ELEMENTS.filter((e) => prep.kinds.includes(e.kind)).map((e) => e.code)
}

// --- screen -----------------------------------------------------------------

/** Non-benchmarked drills shown as plain activity stats. */
const ACTIVITY: readonly { id: string; label: string }[] = [
  { id: 'entry-learn', label: 'Entry drill — learn mode' },
  { id: 'written', label: 'Written practice' },
  { id: 'wind-lab', label: 'Wind & Timing Lab' },
  { id: 'clearance-copy', label: 'Clearance copy' },
  { id: 'to-from', label: 'TO/FROM micro-drill' },
]

export interface DashboardOptions {
  store?: Store
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

function seconds(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} s`
}

function card(
  drill: string,
  title: string,
  ready: boolean,
  lines: string[],
  weak?: string,
): string {
  const items = lines.map((l) => `<li>${l}</li>`).join('')
  return `
    <article class="dash-card" data-drill="${drill}" data-ready="${ready}">
      <h2>${title}</h2>
      <p class="dash-status">${ready ? 'Ready ✓' : 'Keep drilling'}</p>
      <ul>${items}</ul>
      ${weak ? `<p class="dash-weak">${weak}</p>` : ''}
    </article>
  `
}

export function renderDashboard(el: HTMLElement, options: DashboardOptions = {}): void {
  const store = options.store ?? appStore
  const state = store.loadState()
  const b = ENTRY_BENCHMARK

  const entry = benchmarkReport(state.drills['entry'])
  const exam = examReadiness(state)
  const oral = oralReadiness(state)

  const entryCard = card('entry', 'Entry drill — cockpit', entry.met, [
    `${entry.correctUnderTarget}/${b.window} correct under ${b.targetSeconds} s (need ${b.minCorrectUnderTarget})`,
    `median time ${seconds(entry.medianTimeSeconds)}`,
    `${pct(b.minFractionUnderMax)} under ${b.maxSeconds} s: ${entry.speedMet ? 'yes' : 'no'}`,
  ])

  const examCard = card('written-exam', 'Written exam sim', exam.met, [
    `last ${exam.answered} answers: ${exam.score === null ? '—' : pct(exam.score)}`,
    `target ${pct(WEAK_TOPIC_THRESHOLD)} over a full ${EXAM_LENGTH}-question exam`,
  ])

  const oralCard = card(
    'oral',
    'Oral prep',
    oral.bankWorthAnswered,
    [
      `${oral.attempts} self-test answers (bank: ${oral.bankSize} items, ${oral.totalElements} ACS elements)`,
      `a bank’s worth of answers: ${oral.bankWorthAnswered ? 'yes' : 'not yet'}` +
        ' — which items you saw is not tracked, so work the weak elements below',
    ],
    oral.missedElements.length > 0
      ? `Weak elements to re-drill: ${oral.missedElements.join(', ')}`
      : 'No missed elements recorded.',
  )

  const activityRows = ACTIVITY.map(({ id, label }) => {
    const stats = state.drills[id]
    const attempts = stats?.attempts ?? 0
    const correct = attempts > 0 ? pct((stats?.correct ?? 0) / attempts) : '—'
    return `
      <tr data-drill="${id}">
        <td>${label}</td><td>${attempts}</td><td>${correct}</td>
        <td>${seconds(averageTimeSeconds(stats))}</td>
      </tr>
    `
  }).join('')

  const phases = PHASE_PREP.map(
    (prep) => `
      <section class="dash-phase" data-phase="${prep.phase}">
        <h3>${prep.label}</h3>
        <p class="dash-modules">
          ${prep.screens.map((s) => `<a href="#/${s.path}">${s.title}</a>`).join(' · ')}
        </p>
        <p class="dash-elements">${phaseElements(prep).join(', ')}</p>
      </section>
    `,
  ).join('')

  el.innerHTML = `
    <section class="dashboard">
      <h1>Progress</h1>
      <div class="dash-cards">${entryCard}${examCard}${oralCard}</div>
      <h2>Other drills</h2>
      <table class="dash-activity">
        <thead><tr><th>Drill</th><th>Attempts</th><th>Correct</th><th>Avg time</th></tr></thead>
        <tbody>${activityRows}</tbody>
      </table>
      <h2>Checkride map</h2>
      <p class="dash-source"><cite>${ACS_SOURCE}</cite></p>
      ${phases}
    </section>
  `
}

export const dashboardScreen: Screen = {
  path: 'dashboard',
  title: 'Progress',
  render(el) {
    renderDashboard(el)
  },
}
