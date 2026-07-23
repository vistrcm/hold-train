// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createStore,
  emptyState,
  ENTRY_BENCHMARK,
  type AppState,
  type DrillResult,
  type DrillStats,
  type Store,
} from '../app/store'
import { ACS_ELEMENTS, ORAL_ITEMS } from '../content/oral'
import {
  dashboardScreen,
  examReadiness,
  oralReadiness,
  PHASE_PREP,
  phaseElements,
  renderDashboard,
} from './dashboard'
import { EXAM_LENGTH, WEAK_TOPIC_THRESHOLD } from './written-test'

function results(n: number, correct: number, timeSeconds = 5): DrillResult[] {
  return Array.from({ length: n }, (_, i) => ({ correct: i < correct, timeSeconds }))
}

function stats(recent: DrillResult[]): DrillStats {
  return {
    attempts: recent.length,
    correct: recent.filter((r) => r.correct).length,
    totalTimeSeconds: recent.reduce((s, r) => s + r.timeSeconds, 0),
    recent,
  }
}

/** In-memory store preloaded with the given state. */
function storeWith(state: AppState): Store {
  const store = createStore({ storage: undefined })
  store.saveState(state)
  return store
}

describe('examReadiness', () => {
  it('empty state → nothing answered, no score, not met', () => {
    const r = examReadiness(emptyState())
    expect(r.answered).toBe(0)
    expect(r.score).toBeNull()
    expect(r.met).toBe(false)
  })

  it('a full exam window at exactly the 70% threshold is met', () => {
    const state = emptyState()
    const correct = Math.ceil(EXAM_LENGTH * WEAK_TOPIC_THRESHOLD)
    state.drills['written-exam'] = stats(results(EXAM_LENGTH, correct))
    const r = examReadiness(state)
    expect(r.answered).toBe(EXAM_LENGTH)
    expect(r.score).toBeCloseTo(correct / EXAM_LENGTH)
    expect(r.met).toBe(true)
  })

  it('a full exam window below the threshold is not met', () => {
    const state = emptyState()
    const correct = Math.ceil(EXAM_LENGTH * WEAK_TOPIC_THRESHOLD) - 1
    state.drills['written-exam'] = stats(results(EXAM_LENGTH, correct))
    expect(examReadiness(state).met).toBe(false)
  })

  it('a perfect but incomplete window is not met', () => {
    const state = emptyState()
    state.drills['written-exam'] = stats(results(EXAM_LENGTH - 1, EXAM_LENGTH - 1))
    const r = examReadiness(state)
    expect(r.score).toBe(1)
    expect(r.met).toBe(false)
  })
})

describe('oralReadiness', () => {
  it('empty state → no attempts, no full pass, no weak elements', () => {
    const r = oralReadiness(emptyState())
    expect(r.attempts).toBe(0)
    expect(r.fullPass).toBe(false)
    expect(r.bankSize).toBe(ORAL_ITEMS.length)
    expect(r.totalElements).toBe(ACS_ELEMENTS.length)
    expect(r.missedElements).toEqual([])
  })

  it('full pass once attempts reach the bank size', () => {
    const state = emptyState()
    state.drills['oral'] = stats(results(1, 1))
    state.drills['oral']!.attempts = ORAL_ITEMS.length
    expect(oralReadiness(state).fullPass).toBe(true)
  })

  it('collects missed ACS codes deduplicated and in ACS order', () => {
    const state = emptyState()
    state.misses.push(
      { drill: 'oral', at: 1, scenario: { acs: ['IR.III.B.R1'] } },
      { drill: 'oral', at: 2, scenario: { acs: ['IR.III.B.K1', 'IR.III.B.R1'] } },
    )
    expect(oralReadiness(state).missedElements).toEqual(['IR.III.B.K1', 'IR.III.B.R1'])
  })

  it('ignores misses from other drills and malformed snapshots', () => {
    const state = emptyState()
    state.misses.push(
      { drill: 'entry', at: 1, scenario: { acs: ['IR.III.B.K1'] } },
      { drill: 'oral', at: 2, scenario: null },
      { drill: 'oral', at: 3, scenario: { acs: 'IR.III.B.K1' } },
      { drill: 'oral', at: 4, scenario: { acs: [42, 'IR.III.B.R2'] } },
    )
    expect(oralReadiness(state).missedElements).toEqual(['IR.III.B.R2'])
  })
})

describe('PHASE_PREP — checkride map to ACS Task III.B', () => {
  it('covers written, oral, and flight phases', () => {
    expect(PHASE_PREP.map((p) => p.phase)).toEqual(['written', 'oral', 'flight'])
  })

  it('every phase maps to real registered screens', () => {
    for (const prep of PHASE_PREP) {
      expect(prep.screens.length).toBeGreaterThan(0)
      for (const screen of prep.screens) {
        expect(screen.path).not.toBe('')
        expect(screen.title).not.toBe('')
        expect(typeof screen.render).toBe('function')
      }
    }
  })

  it('phase elements are valid ACS codes in ACS order', () => {
    const codes = ACS_ELEMENTS.map((e) => e.code)
    for (const prep of PHASE_PREP) {
      const elements = phaseElements(prep)
      expect(elements.length).toBeGreaterThan(0)
      expect(elements).toEqual(codes.filter((c) => elements.includes(c)))
    }
  })

  it('every ACS element appears in at least one phase', () => {
    const all = new Set(PHASE_PREP.flatMap((p) => phaseElements(p)))
    for (const e of ACS_ELEMENTS) {
      expect(all.has(e.code)).toBe(true)
    }
  })
})

describe('renderDashboard', () => {
  let root: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    root = document.querySelector<HTMLElement>('#root')!
  })

  it('empty store → three readiness cards, none ready', () => {
    renderDashboard(root, { store: storeWith(emptyState()) })
    const cards = [...root.querySelectorAll('.dash-card')]
    expect(cards.length).toBe(3)
    expect(cards.every((c) => c.getAttribute('data-ready') === 'false')).toBe(true)
  })

  it('benchmark-meeting state marks all cards ready', () => {
    const state = emptyState()
    state.drills['entry'] = stats(results(ENTRY_BENCHMARK.window, ENTRY_BENCHMARK.window, 5))
    state.drills['written-exam'] = stats(results(EXAM_LENGTH, EXAM_LENGTH))
    state.drills['oral'] = stats(results(1, 1))
    state.drills['oral']!.attempts = ORAL_ITEMS.length
    renderDashboard(root, { store: storeWith(state) })
    const cards = [...root.querySelectorAll('.dash-card')]
    expect(cards.every((c) => c.getAttribute('data-ready') === 'true')).toBe(true)
  })

  it('shows entry benchmark numbers from the store report', () => {
    const state = emptyState()
    state.drills['entry'] = stats(results(ENTRY_BENCHMARK.window, 12, 8))
    renderDashboard(root, { store: storeWith(state) })
    const card = root.querySelector('.dash-card[data-drill="entry"]')!
    expect(card.textContent).toContain(`12/${ENTRY_BENCHMARK.window}`)
    expect(card.textContent).toContain(`${ENTRY_BENCHMARK.minCorrectUnderTarget}`)
  })

  it('lists weak ACS elements from oral misses', () => {
    const state = emptyState()
    state.misses.push({ drill: 'oral', at: 1, scenario: { acs: ['IR.III.B.R2'] } })
    renderDashboard(root, { store: storeWith(state) })
    expect(root.querySelector('.dash-weak')!.textContent).toContain('IR.III.B.R2')
  })

  it('renders each phase with links to its module routes', () => {
    renderDashboard(root, { store: storeWith(emptyState()) })
    const sections = [...root.querySelectorAll('.dash-phase')]
    expect(sections.length).toBe(PHASE_PREP.length)
    for (const [i, prep] of PHASE_PREP.entries()) {
      const hrefs = [...sections[i]!.querySelectorAll('a')].map((a) => a.getAttribute('href'))
      expect(hrefs).toEqual(prep.screens.map((s) => `#/${s.path}`))
      expect(sections[i]!.textContent).toContain(phaseElements(prep)[0]!)
    }
  })

  it('shows activity stats for non-benchmarked drills', () => {
    const state = emptyState()
    state.drills['wind-lab'] = stats(results(4, 2, 30))
    renderDashboard(root, { store: storeWith(state) })
    const row = root.querySelector('.dash-activity tr[data-drill="wind-lab"]')!
    expect(row.textContent).toContain('4')
    expect(row.textContent).toContain('50%')
  })

  it('screen is registered at #/dashboard and renders', () => {
    expect(dashboardScreen.path).toBe('dashboard')
    dashboardScreen.render(root)
    expect(root.querySelectorAll('.dash-card').length).toBe(3)
  })
})
