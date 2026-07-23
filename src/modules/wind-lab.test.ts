import { describe, expect, it } from 'vitest'
import { createStore, type Store } from '../app/store'
import { angleDiff } from '../engine/geometry'
import { flyCircuit, textbookDecisions } from '../engine/sim'
import { groundSpeeds, inboundCrab, outboundHeading, outboundTimeSeconds } from '../engine/wind'
import {
  ACS_SOURCE,
  HOLD_TAS_KT,
  createWindLab,
  generateWindScenario,
  renderWindLab,
  windLabScreen,
  type PilotNumbers,
} from './wind-lab'

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

function textbookNumbers(seed: number): PilotNumbers {
  const s = generateWindScenario(seed)
  const d = textbookDecisions(s.hold, s.wind)
  return { outboundHeading: d.outboundHeading, crab: d.inboundCrab, outboundSeconds: d.outboundSeconds }
}

describe('generateWindScenario', () => {
  it('is deterministic: same seed replays the exact scenario', () => {
    expect(generateWindScenario(42)).toEqual(generateWindScenario(42))
  })

  it('stays in trainer ranges: 5°-step courses, 10°-step wind, 5–25 kt', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = generateWindScenario(seed)
      expect(s.hold.inboundCourse % 5).toBe(0)
      expect(s.hold.inboundCourse).toBeGreaterThanOrEqual(0)
      expect(s.hold.inboundCourse).toBeLessThan(360)
      expect(s.wind.directionFrom % 10).toBe(0)
      expect(s.wind.directionFrom).toBeLessThan(360)
      expect(s.wind.speedKt).toBeGreaterThanOrEqual(5)
      expect(s.wind.speedKt).toBeLessThanOrEqual(25)
      expect(s.hold.leg).toEqual({ unit: 'min', value: 1 })
      expect(s.hold.fix).toMatch(/^[A-Z]{5}$/)
    }
  })

  it('covers both turn directions across seeds', () => {
    const turns = new Set<string>()
    for (let seed = 0; seed < 50; seed++) {
      turns.add(generateWindScenario(seed).hold.turnDirection)
    }
    expect(turns).toEqual(new Set(['right', 'left']))
  })

  it('targets are the wind engine verbatim (engine is the oracle)', () => {
    for (const seed of [1, 7, 23]) {
      const s = generateWindScenario(seed)
      const c = s.hold.inboundCourse
      expect(s.target.crab).toBeCloseTo(inboundCrab(c, s.wind, HOLD_TAS_KT), 10)
      expect(s.target.outboundHeading).toBeCloseTo(outboundHeading(c, s.wind, HOLD_TAS_KT), 10)
      expect(s.target.outboundSeconds).toBeCloseTo(outboundTimeSeconds(c, s.wind, HOLD_TAS_KT), 10)
    }
  })

  it('rejects a non-finite seed', () => {
    expect(() => generateWindScenario(NaN)).toThrow(RangeError)
  })
})

describe('createWindLab fly → debrief', () => {
  it('textbook numbers grade correct; result recorded, no miss', () => {
    const store = testStore()
    const lab = createWindLab({ seed: 5, store })
    const d = lab.fly(textbookNumbers(5))

    expect(d.headingErrorDeg).toBeCloseTo(0, 6)
    expect(d.crabErrorDeg).toBeCloseTo(0, 6)
    expect(d.headingWithinAcs).toBe(true)
    expect(d.crabWithinAcs).toBe(true)
    expect(d.timingPlanOk).toBe(true)
    expect(d.correct).toBe(true)
    expect(d.sim.completed).toBe(true)

    const state = store.loadState()
    expect(state.drills['wind-lab']?.attempts).toBe(1)
    expect(state.drills['wind-lab']?.correct).toBe(1)
    expect(state.misses).toHaveLength(0)
    expect(lab.session).toEqual({ attempts: 1, correct: 1 })
  })

  it('heading 20° off: outside ACS ±10°, miss recorded with full snapshot', () => {
    const store = testStore()
    const lab = createWindLab({ seed: 9, store })
    const good = textbookNumbers(9)
    const bad = { ...good, outboundHeading: (good.outboundHeading + 20) % 360 }
    const d = lab.fly(bad)

    expect(d.headingErrorDeg).toBeCloseTo(20, 6)
    expect(d.headingWithinAcs).toBe(false)
    expect(d.correct).toBe(false)

    const state = store.loadState()
    expect(state.drills['wind-lab']?.correct).toBe(0)
    expect(state.misses).toHaveLength(1)
    const snapshot = state.misses[0]!.scenario as Record<string, unknown>
    expect(snapshot['seed']).toBe(9)
    expect(snapshot['numbers']).toEqual(bad)
    expect(snapshot['target']).toEqual(lab.scenario.target)
    expect(snapshot['measured']).toMatchObject({ completed: true })
  })

  it('debrief measures against the 60 s inbound and suggests the exact correction', () => {
    const lab = createWindLab({ seed: 11, store: testStore() })
    const s = lab.scenario
    const numbers = textbookNumbers(11)
    const d = lab.fly(numbers)

    expect(d.timingErrorSeconds).toBeCloseTo(d.sim.inboundSeconds - 60, 6)
    const gs = groundSpeeds(s.hold.inboundCourse, s.wind, HOLD_TAS_KT)
    const exact =
      numbers.outboundSeconds + ((60 - d.sim.inboundSeconds) * gs.inboundKt) / gs.outboundKt
    // clamped to ≥1 s so the suggestion is always flyable
    expect(d.nextOutboundSeconds).toBe(Math.max(1, Math.round(exact)))
  })

  it('flying the suggested time next circuit closes the inbound to ~60 s', () => {
    const lab = createWindLab({ seed: 13, store: testStore() })
    const numbers = textbookNumbers(13)
    const first = lab.fly(numbers)
    const second = lab.fly({ ...numbers, outboundSeconds: first.nextOutboundSeconds })
    expect(Math.abs(second.sim.inboundSeconds - 60)).toBeLessThanOrEqual(3)
  })

  it('ghost track is the textbook circuit flown by the sim', () => {
    const lab = createWindLab({ seed: 3, store: testStore() })
    const s = lab.scenario
    const d = lab.fly(textbookNumbers(3))
    expect(d.ghost).toEqual(flyCircuit(s.hold, textbookDecisions(s.hold, s.wind), s.wind).track)
  })

  it('only the first circuit per scenario is scored (refly is practice)', () => {
    const store = testStore()
    const lab = createWindLab({ seed: 9, store })
    const good = textbookNumbers(9)
    lab.fly({ ...good, outboundHeading: (good.outboundHeading + 20) % 360 })
    lab.fly(good)
    const state = store.loadState()
    expect(state.drills['wind-lab']?.attempts).toBe(1)
    expect(state.misses).toHaveLength(1)
    expect(lab.session).toEqual({ attempts: 1, correct: 0 })
  })

  it('next() advances to a fresh scored scenario', () => {
    const store = testStore()
    const lab = createWindLab({ seed: 5, store })
    lab.fly(textbookNumbers(5))
    const before = lab.scenario
    const after = lab.next()
    expect(after.seed).toBe(before.seed + 1)
    lab.fly(textbookNumbers(after.seed))
    expect(store.loadState().drills['wind-lab']?.attempts).toBe(2)
  })

  it('records the prediction time from the injected clock', () => {
    const store = testStore()
    const clock = fakeClock()
    const lab = createWindLab({ seed: 5, store, now: clock.now })
    clock.advance(5000)
    lab.fly(textbookNumbers(5))
    expect(store.loadState().drills['wind-lab']?.totalTimeSeconds).toBeCloseTo(5, 6)
  })

  it('signed heading error follows angleDiff (right = positive)', () => {
    const lab = createWindLab({ seed: 21, store: testStore() })
    const good = textbookNumbers(21)
    const flown = (good.outboundHeading + 360 - 8) % 360
    const d = lab.fly({ ...good, outboundHeading: flown })
    expect(d.headingErrorDeg).toBeCloseTo(angleDiff(good.outboundHeading, flown), 6)
    expect(d.headingErrorDeg).toBeCloseTo(-8, 6)
    expect(d.headingWithinAcs).toBe(true)
  })

  it('cites FAA sources in the debrief', () => {
    const lab = createWindLab({ seed: 5, store: testStore() })
    const d = lab.fly(textbookNumbers(5))
    expect(ACS_SOURCE).toMatch(/FAA-S-ACS-8C/)
    expect(d.sources.acs).toBe(ACS_SOURCE)
    expect(d.sources.wind).toMatch(/AIM 5-3-8/)
    expect(d.sources.timing).toMatch(/AIM 5-3-8/)
  })
})

describe('renderWindLab (screen)', () => {
  function setup(seed = 5) {
    const el = document.createElement('div')
    const store = testStore()
    renderWindLab(el, { seed, store })
    return { el, store }
  }

  function fill(el: HTMLElement, numbers: PilotNumbers): void {
    el.querySelector<HTMLInputElement>('.lab-input-heading')!.value = String(
      numbers.outboundHeading,
    )
    el.querySelector<HTMLInputElement>('.lab-input-crab')!.value = String(numbers.crab)
    el.querySelector<HTMLInputElement>('.lab-input-time')!.value = String(numbers.outboundSeconds)
  }

  it('shows the scenario without leaking the target numbers', () => {
    const { el } = setup(5)
    const s = generateWindScenario(5)
    const text = el.querySelector('.lab-scenario')!.textContent!
    expect(text).toContain(s.hold.fix)
    expect(text).toContain(`${s.wind.speedKt} kt`)
    // predict-first: the pilot fills every number before the engine reveals any
    expect(el.querySelector<HTMLInputElement>('.lab-input-heading')!.value).toBe('')
    expect(el.querySelector<HTMLInputElement>('.lab-input-crab')!.value).toBe('')
    expect(el.querySelector<HTMLInputElement>('.lab-input-time')!.value).toBe('')
    expect(el.querySelector('svg.mapview')).toBeTruthy()
    expect(el.querySelector('.map-track')).toBeNull()
  })

  it('fly renders the debrief with both tracks and the timing suggestion', () => {
    const { el, store } = setup(5)
    fill(el, textbookNumbers(5))
    el.querySelector<HTMLButtonElement>('.lab-fly')!.click()

    expect(el.querySelector('.map-track')).toBeTruthy()
    expect(el.querySelector('.map-ghost-track')).toBeTruthy()
    const debrief = el.querySelector('.lab-debrief')!.textContent!
    expect(debrief).toContain('Inbound leg')
    expect(debrief).toContain('next circuit')
    expect(debrief).toContain('AIM 5-3-8')
    expect(store.loadState().drills['wind-lab']?.attempts).toBe(1)
  })

  it('invalid input shows an error instead of throwing', () => {
    const { el, store } = setup(5)
    const numbers = textbookNumbers(5)
    fill(el, { ...numbers, crab: 60 })
    el.querySelector<HTMLButtonElement>('.lab-fly')!.click()
    expect(el.querySelector('.lab-debrief')!.textContent).toMatch(/±45/)
    expect(store.loadState().drills['wind-lab']).toBeUndefined()
  })

  it('next button moves to a new scenario and clears the flown track', () => {
    const { el } = setup(5)
    fill(el, textbookNumbers(5))
    el.querySelector<HTMLButtonElement>('.lab-fly')!.click()
    const before = el.querySelector('.lab-scenario')!.textContent
    el.querySelector<HTMLButtonElement>('.lab-next')!.click()
    expect(el.querySelector('.lab-scenario')!.textContent).not.toBe(before)
    expect(el.querySelector('.map-track')).toBeNull()
    expect(el.querySelector('.lab-debrief')!.textContent).toBe('')
  })

  it('registers as a routed screen', () => {
    expect(windLabScreen.path).toBe('wind-lab')
    expect(typeof windLabScreen.render).toBe('function')
  })
})
