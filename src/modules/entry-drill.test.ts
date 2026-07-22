import { describe, expect, it } from 'vitest'
import { createStore, type Store } from '../app/store'
import { generateClearance } from '../engine/clearance'
import { determineEntry, ENTRIES, type Entry } from '../engine/entry'
import {
  COCKPIT_TARGET_SECONDS,
  createEntryDrill,
  entryDrillScreen,
  generateScenario,
  gradeEntryAnswer,
  renderEntryDrill,
} from './entry-drill'

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

function wrongEntryFor(seed: number): Entry {
  const { result } = generateScenario(seed)
  const acceptable = [result.primary, ...result.alternates]
  const wrong = ENTRIES.find((e) => !acceptable.includes(e))
  expect(wrong).toBeDefined()
  return wrong!
}

describe('generateScenario', () => {
  it('is deterministic: same seed replays the exact scenario', () => {
    expect(generateScenario(42)).toEqual(generateScenario(42))
  })

  it('prompt is the realistic clearance text for the same seed', () => {
    const s = generateScenario(7)
    expect(s.clearanceText).toBe(generateClearance(7).clearance.text)
    expect(s.clearanceText).toMatch(/^Hold /)
    expect(s.clearanceText).toContain('expect further clearance')
  })

  it('heading is an integer in [0, 360)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const { heading } = generateScenario(seed)
      expect(Number.isInteger(heading)).toBe(true)
      expect(heading).toBeGreaterThanOrEqual(0)
      expect(heading).toBeLessThan(360)
    }
  })

  it('covers standard and nonstandard holds and several fix kinds across seeds', () => {
    const turns = new Set<string>()
    const kinds = new Set<string>()
    for (let seed = 0; seed < 200; seed++) {
      const s = generateScenario(seed)
      turns.add(s.holdSpec.turnDirection)
      kinds.add(s.holdSpec.fixKind)
    }
    expect(turns).toEqual(new Set(['right', 'left']))
    expect(kinds.size).toBeGreaterThanOrEqual(3)
  })

  it('answer key comes from the engine (engine is the oracle)', () => {
    for (const seed of [1, 11, 23, 99]) {
      const s = generateScenario(seed)
      expect(s.result).toEqual(determineEntry(s.heading, s.holdSpec))
    }
  })

  it('rejects a non-finite seed', () => {
    expect(() => generateScenario(NaN)).toThrow(RangeError)
    expect(() => generateScenario(Infinity)).toThrow(RangeError)
  })
})

describe('gradeEntryAnswer', () => {
  const hold = { inboundCourse: 340, turnDirection: 'right' as const }

  it('accepts the primary entry', () => {
    const r = determineEntry(340, hold)
    expect(r.primary).toBe('direct')
    expect(gradeEntryAnswer('direct', r)).toBe(true)
  })

  it('accepts boundary alternates within ±5° (AIM 5-3-8 j8)', () => {
    // heading 90 sits exactly on the 110° direct/teardrop divider for course 340
    const r = determineEntry(90, hold)
    expect(r.alternates.length).toBeGreaterThan(0)
    for (const alt of r.alternates) {
      expect(gradeEntryAnswer(alt, r)).toBe(true)
    }
  })

  it('rejects a wrong entry', () => {
    const r = determineEntry(340, hold)
    expect(gradeEntryAnswer('parallel', r)).toBe(false)
    expect(gradeEntryAnswer('teardrop', r)).toBe(false)
  })
})

describe('createEntryDrill controller', () => {
  it('grades against the engine and tracks session stats', () => {
    const drill = createEntryDrill({ mode: 'learn', seed: 5, store: testStore(), now: () => 0 })
    const fb = drill.answer(drill.scenario.result.primary)
    expect(fb.correct).toBe(true)
    expect(drill.session).toEqual({ attempts: 1, correct: 1 })
  })

  it('measures time per answer with the injected clock', () => {
    const clock = fakeClock()
    const drill = createEntryDrill({ mode: 'cockpit', seed: 1, store: testStore(), now: clock.now })
    clock.advance(3200)
    const fb = drill.answer(drill.scenario.result.primary)
    expect(fb.timeSeconds).toBeCloseTo(3.2)
    expect(fb.overTarget).toBe(false)
  })

  it(`flags answers over the ${COCKPIT_TARGET_SECONDS} s cockpit target`, () => {
    const clock = fakeClock()
    const drill = createEntryDrill({ mode: 'cockpit', seed: 1, store: testStore(), now: clock.now })
    clock.advance((COCKPIT_TARGET_SECONDS + 1) * 1000)
    const fb = drill.answer(drill.scenario.result.primary)
    expect(fb.overTarget).toBe(true)
  })

  it('records cockpit results under the benchmarked entry drill', () => {
    const store = testStore()
    const drill = createEntryDrill({ mode: 'cockpit', seed: 3, store, now: () => 0 })
    drill.answer(drill.scenario.result.primary)
    const stats = store.loadState().drills['entry']
    expect(stats?.attempts).toBe(1)
    expect(stats?.correct).toBe(1)
  })

  it('records learn results separately so the timed benchmark stays clean', () => {
    const store = testStore()
    const drill = createEntryDrill({ mode: 'learn', seed: 3, store, now: () => 0 })
    drill.answer(drill.scenario.result.primary)
    const state = store.loadState()
    expect(state.drills['entry-learn']?.attempts).toBe(1)
    expect(state.drills['entry']).toBeUndefined()
  })

  it('records a miss with a full scenario snapshot on a wrong answer', () => {
    const store = testStore()
    const seed = 9
    const drill = createEntryDrill({ mode: 'cockpit', seed, store, now: () => 0 })
    const wrong = wrongEntryFor(seed)
    const fb = drill.answer(wrong)
    expect(fb.correct).toBe(false)

    const misses = store.loadState().misses
    expect(misses).toHaveLength(1)
    const scenario = misses[0]!.scenario as Record<string, unknown>
    expect(scenario['heading']).toBe(drill.scenario.heading)
    expect(scenario['holdSpec']).toEqual(drill.scenario.holdSpec)
    expect(scenario['clearanceText']).toBe(drill.scenario.clearanceText)
    expect(scenario['chosen']).toBe(wrong)
    expect(scenario['expected']).toBe(drill.scenario.result.primary)
  })

  it('records no miss for a correct answer', () => {
    const store = testStore()
    const drill = createEntryDrill({ mode: 'learn', seed: 5, store, now: () => 0 })
    drill.answer(drill.scenario.result.primary)
    expect(store.loadState().misses).toHaveLength(0)
  })

  it('rejects a second answer before next()', () => {
    const drill = createEntryDrill({ mode: 'learn', seed: 5, store: testStore(), now: () => 0 })
    drill.answer(drill.scenario.result.primary)
    expect(() => drill.answer('direct')).toThrow()
  })

  it('next() advances deterministically and restarts the answer timer', () => {
    const clock = fakeClock()
    const drill = createEntryDrill({ mode: 'cockpit', seed: 10, store: testStore(), now: clock.now })
    clock.advance(5000)
    drill.answer(drill.scenario.result.primary)

    clock.advance(60_000) // time passes while reading feedback — must not count
    const scenario = drill.next()
    expect(scenario).toEqual(generateScenario(11))

    clock.advance(2000)
    const fb = drill.answer(scenario.result.primary)
    expect(fb.timeSeconds).toBeCloseTo(2)
  })

  it('feedback carries sector overlay, entry guidance, and FAA citation', () => {
    const drill = createEntryDrill({ mode: 'learn', seed: 8, store: testStore(), now: () => 0 })
    const fb = drill.answer(drill.scenario.result.primary)
    expect(fb.result.sectors.direct).toBeDefined()
    expect(fb.result.source).toContain('AIM 5-3-8')
    expect(fb.guidance.entry).toBe(fb.result.primary)
    expect(fb.guidance.source).toContain('AIM 5-3-8')
  })

  it('benchmark() scores the stored cockpit window (18/20 <10 s; 95% <15 s)', () => {
    const store = testStore()
    const clock = fakeClock()
    const drill = createEntryDrill({ mode: 'cockpit', seed: 0, store, now: clock.now })
    for (let i = 0; i < 20; i++) {
      clock.advance(3000)
      drill.answer(drill.scenario.result.primary)
      drill.next()
    }
    const report = drill.benchmark()
    expect(report.attempts).toBe(20)
    expect(report.correctUnderTarget).toBe(20)
    expect(report.met).toBe(true)
  })
})

describe('renderEntryDrill screen', () => {
  function setup(mode: 'learn' | 'cockpit', seed = 42) {
    const el = document.createElement('div')
    const store = testStore()
    const clock = fakeClock()
    renderEntryDrill(el, { mode, seed, store, now: clock.now })
    return { el, store, clock }
  }

  function answerButton(el: HTMLElement, entry: Entry): HTMLButtonElement {
    const btn = el.querySelector<HTMLButtonElement>(`.entry-answer[data-entry="${entry}"]`)
    expect(btn).not.toBeNull()
    return btn!
  }

  it('shows the clearance text, HSI at the scenario heading, and three answer buttons', () => {
    const { el } = setup('learn')
    const scenario = generateScenario(42)
    expect(el.querySelector('.entry-clearance')!.textContent).toContain(scenario.clearanceText)
    expect(el.querySelector('svg.hsi')).not.toBeNull()
    const buttons = el.querySelectorAll('.entry-answer')
    expect(buttons).toHaveLength(3)
    for (const entry of ENTRIES) {
      expect(answerButton(el, entry).disabled).toBe(false)
    }
  })

  it('learn mode shows thumb and sector aids before answering', () => {
    const { el } = setup('learn')
    expect(el.querySelector('.hsi-thumb')).not.toBeNull()
    expect(el.querySelector('.hsi-sector-direct')).not.toBeNull()
  })

  it('cockpit mode hides the aids before answering', () => {
    const { el } = setup('cockpit')
    expect(el.querySelector('.hsi-thumb')).toBeNull()
    expect(el.querySelector('.hsi-sector-direct')).toBeNull()
  })

  it('correct answer: instant feedback with sector overlay and citation, answers locked', () => {
    const { el } = setup('cockpit')
    answerButton(el, generateScenario(42).result.primary).click()

    const feedback = el.querySelector('.entry-feedback')!
    expect(feedback.textContent).toContain('Correct')
    expect(feedback.textContent).toContain('AIM 5-3-8')
    expect(el.querySelector('.hsi-sector-direct')).not.toBeNull()
    for (const entry of ENTRIES) {
      expect(answerButton(el, entry).disabled).toBe(true)
    }
  })

  it('wrong answer: names the expected entry and records the miss', () => {
    const { el, store } = setup('cockpit')
    const scenario = generateScenario(42)
    answerButton(el, wrongEntryFor(42)).click()

    const feedback = el.querySelector('.entry-feedback')!
    expect(feedback.textContent!.toLowerCase()).toContain(scenario.result.primary)
    expect(store.loadState().misses).toHaveLength(1)
  })

  it('next shows a new scenario and re-enables the answers', () => {
    const { el } = setup('learn')
    answerButton(el, generateScenario(42).result.primary).click()
    el.querySelector<HTMLButtonElement>('.entry-next')!.click()

    expect(el.querySelector('.entry-clearance')!.textContent).toContain(
      generateScenario(43).clearanceText,
    )
    expect(el.querySelector('.entry-feedback')!.textContent).toBe('')
    for (const entry of ENTRIES) {
      expect(answerButton(el, entry).disabled).toBe(false)
    }
  })

  it('mode toggle switches to cockpit and drops the aids', () => {
    const { el } = setup('learn')
    expect(el.querySelector('.hsi-thumb')).not.toBeNull()
    el.querySelector<HTMLButtonElement>('.entry-mode[data-mode="cockpit"]')!.click()
    expect(el.querySelector('.hsi-thumb')).toBeNull()
    expect(
      el.querySelector('.entry-mode[data-mode="cockpit"]')!.getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('shows session and cockpit-benchmark stats', () => {
    const { el } = setup('cockpit')
    answerButton(el, generateScenario(42).result.primary).click()
    const stats = el.querySelector('.entry-stats')!.textContent!
    expect(stats).toContain('1/1')
    expect(stats).toContain('18/20')
  })
})

describe('entryDrillScreen', () => {
  it('registers under entry-drill and renders', () => {
    expect(entryDrillScreen.path).toBe('entry-drill')
    expect(entryDrillScreen.title.length).toBeGreaterThan(0)
    const el = document.createElement('div')
    entryDrillScreen.render(el)
    expect(el.querySelector('.entry-drill')).not.toBeNull()
  })
})
