import { describe, expect, it } from 'vitest'
import { createStore, type Store } from '../app/store'
import { angleDiff } from '../engine/geometry'
import {
  HOLD_TAS_KT,
  MAX_OUTBOUND_SECONDS,
  flyCircuit,
  textbookDecisions,
} from '../engine/sim'
import { groundSpeeds, inboundCrab, outboundHeading, outboundTimeSeconds } from '../engine/wind'
import { CHART_HOLDS } from '../content/questions'
import {
  ACS_SOURCE,
  FIXES,
  createWindLab,
  generateWindScenario,
  renderWindLab,
  windLabScreen,
  type PilotNumbers,
  type WindLabDebrief,
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

/**
 * The adjustment is only withheld on an incomplete circuit, so asserting the
 * circuit closed is what earns the non-null — the tests below all fly one.
 */
function suggestion(d: WindLabDebrief): number {
  expect(d.sim.completed).toBe(true)
  expect(d.nextOutboundSeconds).not.toBeNull()
  return d.nextOutboundSeconds as number
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

  // Same defect class as the CEDES/SUNOL/TRACY fix in docs/content-audit.md, at
  // the one fixture list that had no guard. generateWindScenario invents the
  // course, turn direction and legs; if the name is a fix the student actually
  // flies, repeated drilling memorizes invented data for a real hold. WINDY is
  // a real waypoint at Newman, CA — beside KTCY, this student's home field.
  it('no fixture reuses a real waypoint name', () => {
    // Verified against opennav.com/waypoint/US/<NAME> on 2026-07-23: WINDY
    // (Newman, CA), DRIFT and TIMBR (Timber, OR) return waypoint records; the
    // names now in FIXES return none.
    const real = ['WINDY', 'DRIFT', 'TIMBR', 'CEDES', 'SUNOL', 'TRACY', 'JEMKO']
    for (const fix of FIXES) {
      expect(real, `fixture ${fix}`).not.toContain(fix)
    }
  })

  it('no fixture collides with a hold charted in the written bank', () => {
    const charted = new Set(CHART_HOLDS.map((h) => h.fix))
    for (const fix of FIXES) {
      expect(charted.has(fix), fix).toBe(false)
    }
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
    // Direction and magnitude, not the formula re-typed: a long inbound means
    // the outbound leg was too long, so the suggestion must come down, scaled
    // by the ground-speed ratio. (That the number actually works is the next
    // test — it flies the suggestion and checks the inbound closes to 60 s.)
    const gs = groundSpeeds(s.hold.inboundCourse, s.wind, HOLD_TAS_KT)
    const correction = suggestion(d) - numbers.outboundSeconds
    expect(Math.sign(correction)).toBe(Math.sign(60 - d.sim.inboundSeconds))
    expect(Math.abs(correction)).toBeCloseTo(
      (Math.abs(60 - d.sim.inboundSeconds) * gs.inboundKt) / gs.outboundKt,
      0,
    )
  })

  it('never suggests an outbound time the sim would reject', () => {
    // The suggestion is the pilot's next input, so it has to satisfy the same
    // bounds flyCircuit enforces. Rolling out already past the abeam line
    // (large crab off a long leg) reads inboundSeconds ≈ 0, which drives the
    // AIM j4 correction term maximally positive.
    const lab = createWindLab({ seed: 76, store: testStore() })
    const d = lab.fly({ outboundHeading: 0, crab: -45, outboundSeconds: 600 })
    expect(d.sim.inboundSeconds).toBeLessThan(1)
    const next = suggestion(d)
    expect(next).toBeGreaterThanOrEqual(1)
    expect(next).toBeLessThanOrEqual(MAX_OUTBOUND_SECONDS)
    expect(() => lab.fly({ ...d.numbers, outboundSeconds: next })).not.toThrow()
  })

  it('debriefs a circuit that never made it back to the fix', () => {
    // sim.completed === false is a real UI path: the verdict names it and the
    // inbound row reads "never reached the fix" instead of a time.
    const numbers = { ...textbookNumbers(1), outboundSeconds: 600 }
    const lab = createWindLab({ seed: 1, store: testStore() })
    const d = lab.fly(numbers)
    expect(d.sim.completed).toBe(false)
    expect(d.correct).toBe(false)
    const el = document.createElement('div')
    renderWindLab(el, { seed: 1, store: testStore() })
    el.querySelector<HTMLInputElement>('.lab-input-heading')!.value =
      String(numbers.outboundHeading)
    el.querySelector<HTMLInputElement>('.lab-input-crab')!.value = String(numbers.crab)
    el.querySelector<HTMLInputElement>('.lab-input-time')!.value = '600'
    el.querySelector<HTMLButtonElement>('.lab-fly')!.click()
    const debrief = el.querySelector<HTMLElement>('.lab-debrief')!
    expect(debrief.textContent).toContain('never made it back to the fix')
    expect(debrief.textContent).toContain('never reached the fix')
    // No inbound leg was flown, so there is no inbound time to correct from.
    // Printing a concrete "fly N s outbound" here hands the pilot a number
    // derived from where the sim gave up, not from a measured circuit.
    expect(debrief.textContent).not.toMatch(/next circuit fly \d/)
  })

  it('offers no next-circuit time when the circuit never reached the fix', () => {
    // sim.inboundSeconds on an incomplete circuit is MAX_SIM_SECONDS minus the
    // turn and outbound time — a truncation artifact. The AIM j4 adjustment
    // scales the *inbound* error, so it has nothing to work from here.
    const lab = createWindLab({ seed: 1, store: testStore() })
    const d = lab.fly({ ...textbookNumbers(1), outboundSeconds: 600 })
    expect(d.sim.completed).toBe(false)
    expect(d.nextOutboundSeconds).toBeNull()
  })

  it('flying the suggested time next circuit closes the inbound to ~60 s', () => {
    const lab = createWindLab({ seed: 13, store: testStore() })
    const numbers = textbookNumbers(13)
    const first = lab.fly(numbers)
    const second = lab.fly({ ...numbers, outboundSeconds: suggestion(first) })
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

  // The scenario line states course, turns and legs for a named fix and the map
  // draws it north-up like a plate, but every one of those numbers is invented.
  // entry-drill's chartNote labels the same shape fictitious; this one must too.
  it('labels the scenario line as a practice fixture, not charted data', () => {
    for (const seed of [0, 5, 17, 42]) {
      const { el } = setup(seed)
      const line = el.querySelector<HTMLElement>('.lab-scenario')!.textContent ?? ''
      expect(line, `seed ${seed}`).toMatch(/practice fixture/i)
      expect(line, `seed ${seed}`).toMatch(/fictitious/i)
    }
  })

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

  it('blank inputs get the fill-in prompt, not a raw engine error', () => {
    const { el, store } = setup(5)
    // leave all three fields empty
    el.querySelector<HTMLButtonElement>('.lab-fly')!.click()
    const debrief = el.querySelector('.lab-debrief')!
    expect(debrief.textContent).toBe('Enter all three numbers before flying.')
    expect(debrief.classList.contains('is-error')).toBe(true)
    expect(store.loadState().drills['wind-lab']).toBeUndefined()
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

  // The graded outbound time is the ground-speed-ratio value, which is NOT the
  // AIM j4 rule — j4 has you fly the FIRST outbound at 1 minute, then adjust
  // (see `timing-adjust-outbound` in the written bank). For 21 of the first 40
  // seeds that ratio is more than 10 s from 60, so a student answering the
  // written bank's rule here is marked wrong. The screen must state the ask and
  // carry the j4 caveat rather than calling the ratio "the rule".
  it('states what outbound time it asks for and carries the AIM j4 caveat', () => {
    const { el } = setup(5)
    const prompt = el.textContent!
    expect(prompt).toMatch(/60 s inbound|inbound leg 60 s|60 s inbound leg/i)
    expect(prompt).toMatch(/first outbound leg .*1 minute|initial outbound.*1 minute/i)
    expect(prompt).toMatch(/AIM 5-3-8 j4/)
  })

  it('never presents the ground-speed-ratio time as "the rule"', () => {
    const { el } = setup(5)
    // a wrong-by-plan flight, so the timing verdict line renders
    fill(el, { ...textbookNumbers(5), outboundSeconds: 5 })
    el.querySelector<HTMLButtonElement>('.lab-fly')!.click()
    const debrief = el.querySelector('.lab-debrief')!.textContent!
    expect(debrief).toMatch(/outbound time/i)
    expect(debrief).not.toMatch(/\brule\b/i)
  })

  it('grades 60 s as a miss only against a stated ratio ask, and says so', () => {
    // seed 1: course 000, wind 350@25 -> ratio target 34.2 s, so 60 s is >10 s off
    const s = generateWindScenario(1)
    expect(Math.abs(60 - s.target.outboundSeconds)).toBeGreaterThan(10)
    const el = document.createElement('div')
    renderWindLab(el, { seed: 1, store: testStore() })
    fill(el, { ...textbookNumbers(1), outboundSeconds: 60 })
    el.querySelector<HTMLButtonElement>('.lab-fly')!.click()
    const debrief = el.querySelector('.lab-debrief')!.textContent!
    // the student is told WHY 60 is not the answer to this question
    expect(debrief).toMatch(/ground-speed ratio|ratio/i)
  })

  it('registers as a routed screen', () => {
    expect(windLabScreen.path).toBe('wind-lab')
    expect(typeof windLabScreen.render).toBe('function')
  })
})
