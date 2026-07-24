// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import README from '../../README.md?raw'
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
import { createClearanceCopyDrill, createToFromDrill } from './clearance-copy'
import { createEntryDrill } from './entry-drill'
import { createOralPrep } from './oral-prep'
import { createWindLab } from './wind-lab'
import { createWrittenTest } from './written-test'
import {
  dashboardScreen,
  examReadiness,
  oralReadiness,
  PHASE_PREP,
  phaseElements,
  renderDashboard,
  type ExamPhase,
} from './dashboard'
import { EXAM_LENGTH, EXAM_PASS_FRACTION } from './written-test'

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
    const correct = Math.ceil(EXAM_LENGTH * EXAM_PASS_FRACTION)
    state.drills['written-exam'] = stats(results(EXAM_LENGTH, correct))
    const r = examReadiness(state)
    expect(r.answered).toBe(EXAM_LENGTH)
    expect(r.score).toBeCloseTo(correct / EXAM_LENGTH)
    expect(r.met).toBe(true)
  })

  it('a full exam recorded through the store reaches the readiness bar', () => {
    // Not a hand-built window: recordDrillResult caps `recent` at RECENT_WINDOW,
    // so an EXAM_LENGTH above that cap would make `met` permanently unreachable
    // while every fabricated-state test above stayed green.
    const store = createStore({ storage: undefined })
    const correct = Math.ceil(EXAM_LENGTH * EXAM_PASS_FRACTION)
    for (let i = 0; i < EXAM_LENGTH; i++) {
      store.recordDrillResult('written-exam', { correct: i < correct, timeSeconds: 5 })
    }
    const r = examReadiness(store.loadState())
    expect(r.answered).toBe(EXAM_LENGTH)
    expect(r.met).toBe(true)
  })

  it('a full exam window below the threshold is not met', () => {
    const state = emptyState()
    const correct = Math.ceil(EXAM_LENGTH * EXAM_PASS_FRACTION) - 1
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
  it('empty state → no attempts, no bank-worth of answers, no weak elements', () => {
    const r = oralReadiness(emptyState())
    expect(r.attempts).toBe(0)
    expect(r.bankWorthAnswered).toBe(false)
    expect(r.bankSize).toBe(ORAL_ITEMS.length)
    expect(r.totalElements).toBe(ACS_ELEMENTS.length)
    expect(r.missedElements).toEqual([])
  })

  it('a bank’s worth of answers once attempts reach the bank size', () => {
    const state = emptyState()
    state.drills['oral'] = stats(results(1, 1))
    state.drills['oral']!.attempts = ORAL_ITEMS.length
    expect(oralReadiness(state).bankWorthAnswered).toBe(true)
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

describe('README module → exam-phase table', () => {
  // The README table and PHASE_PREP are two hand-written copies of the same
  // study plan, and they had already drifted apart on four of eight rows.
  it('matches PHASE_PREP row for row', () => {
    const phases: ExamPhase[] = ['written', 'oral', 'flight']
    const documented = new Map<string, string[]>()
    for (const [, route, marks] of README.matchAll(
      /^\| `#\/([\w-]+)` \| [^|]+ \|([^|]*\|[^|]*\|[^|]*)\|\s*$/gm,
    )) {
      // The Progress screen reports on the phases rather than prepping one, so
      // it has no PHASE_PREP entry and its README row spans the columns.
      if (route === 'dashboard') continue
      const cells = marks!.split('|').map((c: string) => c.trim())
      documented.set(
        route!,
        phases.filter((_, i) => cells[i] === '✓'),
      )
    }
    expect(documented.size).toBeGreaterThan(0)

    const actual = new Map<string, string[]>()
    for (const prep of PHASE_PREP) {
      for (const screen of prep.screens) {
        actual.set(screen.path, [...(actual.get(screen.path) ?? []), prep.phase])
      }
    }
    for (const [route, phasesForRoute] of actual) {
      expect(documented.get(route), `README row for #/${route}`).toEqual(phasesForRoute)
    }
    expect([...documented.keys()].filter((r) => !actual.has(r))).toEqual([])
  })
})

describe('drill ids are matched by string in more than one place', () => {
  // CLAUDE.md: a drill id lives in the store, in ACTIVITY here, and in
  // missesToCards. Nothing in the type system connects them, so a new drill is
  // silently invisible on the dashboard. Read the ids back out of the modules
  // that record them rather than restating the list a third time.
  /** Answers one question in every drill and returns the keys it wrote. */
  function recordedIds(): string[] {
    const store = createStore({ storage: undefined })
    const seed = 7

    for (const mode of ['cockpit', 'learn'] as const) {
      createEntryDrill({ mode, seed, store }).answer('direct')
    }
    for (const mode of ['practice', 'exam'] as const) {
      createWrittenTest({ mode, seed, store }).answer(0)
    }
    const oral = createOralPrep({ store })
    oral.reveal()
    oral.grade('missed')
    const lab = createWindLab({ seed, store })
    lab.fly({ outboundHeading: 0, crab: 0, outboundSeconds: 60 })
    const copy = createClearanceCopyDrill({ seed, store })
    const e = copy.scenario.expected
    copy.submit({
      direction: e.direction,
      fix: e.fix,
      courseKind: e.courseKind,
      leg: e.leg === 'unstated' ? { unit: 'min', value: 1 } : e.leg,
      turnDirection: e.turnDirection === 'left' ? 'left' : 'right',
      efc: e.efc,
      ...(e.courseDegrees === undefined ? {} : { courseDegrees: e.courseDegrees }),
    })
    const toFrom = createToFromDrill({ seed, store })
    toFrom.answer(toFrom.scenario.answer)

    return Object.keys(store.loadState().drills).sort()
  }

  it('drives every drill and finds the eight documented ids', () => {
    expect(recordedIds()).toEqual([
      'clearance-copy',
      'entry',
      'entry-learn',
      'oral',
      'to-from',
      'wind-lab',
      'written',
      'written-exam',
    ])
  })

  it('every recorded drill id appears on the dashboard', () => {
    document.body.innerHTML = '<div id="dash-root"></div>'
    const el = document.querySelector<HTMLElement>('#dash-root')!
    renderDashboard(el, { store: storeWith(emptyState()) })
    const shown = new Set(
      [...el.querySelectorAll('[data-drill]')].map((n) => n.getAttribute('data-drill')),
    )
    for (const id of recordedIds()) {
      expect(shown.has(id), `dashboard has no row or card for '${id}'`).toBe(true)
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

  it('never claims bank coverage it cannot measure', () => {
    // The store counts oral attempts, not which items were answered, so
    // answering one item 21 times clears the bar. The card must not read as
    // "you have seen the whole bank" — false readiness on a checkride app.
    const state = emptyState()
    state.drills['oral'] = stats(results(1, 1))
    state.drills['oral']!.attempts = ORAL_ITEMS.length
    renderDashboard(root, { store: storeWith(state) })
    const card = root.querySelector('.dash-card[data-drill="oral"]')!
    expect(card.textContent).not.toContain('full pass')
    expect(card.textContent).toContain('not tracked')
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
