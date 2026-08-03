import { describe, expect, it } from 'vitest'
import { createStore, type Store } from '../app/store'
import { generateClearance, PUBLISHED_HOLDS } from '../engine/clearance'
import {
  determineEntry,
  ENTRIES,
  entryGuidance,
  type Entry,
  type HoldCourse,
} from '../engine/entry'
import { normalizeDeg } from '../engine/geometry'
import {
  COCKPIT_TARGET_SECONDS,
  createEntryDrill,
  entryDrillScreen,
  flyItText,
  generateScenario,
  gradeEntryAnswer,
  OUTBOUND_TIMING_AIM,
  OUTBOUND_TIMING_NOTE,
  OUTBOUND_TIMING_SOURCE,
  renderEntryDrill,
} from './entry-drill'
import { courseText } from '../format'

/** First seed whose generated clearance is a charted "as published" hold. */
const CHARTED_SEED = 4

/** Seed whose heading lands within 5° of a sector boundary: primary parallel, alternate direct. */
const DUAL_KEYED_SEED = 3

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

  // A ±5° alternate is a correct answer (AIM 5-3-8 j8(d)), so the "fly it"
  // instructions must describe the entry the pilot actually chose. Handing a
  // pilot who correctly answered Direct the parallel's turn-through-180° script
  // is negative training at the one heading where the choice is subtlest.
  it('guides the chosen entry, not the primary, when a ±5° alternate is answered', () => {
    const drill = createEntryDrill({
      mode: 'learn',
      seed: DUAL_KEYED_SEED,
      store: testStore(),
      now: () => 0,
    })
    const { result } = drill.scenario
    expect(result.primary).toBe('parallel')
    expect(result.alternates).toContain('direct')

    const fb = drill.answer('direct')
    expect(fb.correct).toBe(true)
    expect(fb.guidance.entry).toBe('direct')
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

// The parallel entry is the only entry whose FIRST turn — the one across the fix
// onto outbound — opposes the pattern, and the drill never named it. A learner who
// only reads "then right turn through more than 180°" cannot see that a left-turn
// hold is flown with TWO right turns; the shape is what the corrected geometry is
// for. See docs/parallel-entry-evidence.md.
describe('flyItText', () => {
  const GOLDEN: HoldCourse = { inboundCourse: 140, turnDirection: 'left' }
  const STANDARD: HoldCourse = { inboundCourse: 0, turnDirection: 'right' }
  /** STANDARD's mirror — same course, opposite pattern. */
  const NONSTANDARD: HoldCourse = { inboundCourse: 0, turnDirection: 'left' }

  it('golden case: heading 251 into a left-turn hold is a parallel flown with two RIGHT turns', () => {
    expect(determineEntry(251, GOLDEN).primary).toBe('parallel')
    const text = flyItText(entryGuidance('parallel', GOLDEN), 251)
    expect(text).toContain('turn right onto 320°')
    expect(text).toContain('nonholding side')
    expect(text).toContain('right turn through more than 180°')
    expect(text).toContain('both turns opposite the pattern')
    // A left-turn hold, yet not one left turn in the entry until back at the fix.
    expect(text).not.toContain('left')
  })

  it('standard hold mirrors it: a right-turn hold is entered with two LEFT turns', () => {
    // heading 250 is mid-sector for inbound 000 / right turns.
    expect(determineEntry(250, STANDARD).primary).toBe('parallel')
    const text = flyItText(entryGuidance('parallel', STANDARD), 250)
    expect(text).toContain('turn left onto 180°')
    expect(text).toContain('nonholding side')
    expect(text).toContain('left turn through more than 180°')
    expect(text).toContain('both turns opposite the pattern')
    expect(text).not.toContain('right')
  })

  it('A1: the named fix-crossing turn matches the rejoin across the parallel sector', () => {
    for (const inboundCourse of [0, 45, 90, 135, 180, 225, 270, 315, 140]) {
      for (const turnDirection of ['right', 'left'] as const) {
        const hold = { inboundCourse, turnDirection }
        const g = entryGuidance('parallel', hold)
        const opposed = turnDirection === 'right' ? 'left' : 'right'
        expect(g.turnToInbound).toBe(opposed)
        // sweep the sector interior (d = 185…285 measured pattern-ward), not just
        // one heading: the fix-crossing turn is heading-dependent, so a single
        // sample cannot show it holds throughout.
        for (const d of [185, 200, 235, 270, 285]) {
          const m = turnDirection === 'right' ? d : -d
          const heading = normalizeDeg(inboundCourse + m)
          expect(determineEntry(heading, hold).primary, `${inboundCourse} ${d}`).toBe('parallel')
          expect(flyItText(g, heading), `${inboundCourse} ${d}`).toContain(
            `turn ${opposed} onto ${courseText(g.outboundHeading)}`,
          )
        }
      }
    }
  })

  // The ±5° boundary band (AIM 5-3-8 j8(d)) is where parallel is an ACCEPTED
  // answer but the aircraft is already all but aligned with outbound, so the
  // fix-crossing turn runs the other way. Naming the opposed turn here would
  // teach a turn the pilot must not make.
  it('at the teardrop/parallel boundary the named turn follows the heading, not the pattern', () => {
    const r = determineEntry(177, STANDARD)
    expect(r.primary).toBe('teardrop')
    expect(r.alternates).toContain('parallel') // parallel is graded correct here
    const text = flyItText(entryGuidance('parallel', STANDARD), 177)
    expect(text).toContain('turn right onto 180°') // 177 → 180 is 3° RIGHT
    expect(text).not.toContain('both turns opposite the pattern')
    expect(text).toContain('left turn through more than 180°') // the rejoin is unchanged
  })

  it('exactly aligned with outbound: no fix-crossing turn is named at all', () => {
    const text = flyItText(entryGuidance('parallel', STANDARD), 180)
    expect(text).toContain('roll out on 180°')
    expect(text).not.toContain('turn right onto')
    expect(text).not.toContain('turn left onto')
    expect(text).not.toContain('both turns opposite the pattern')
  })

  // The two cases above are the entire reason flyItText takes `heading` rather
  // than deriving the first turn from `turnToInbound`, and both were covered for
  // a standard hold only. Sign-convention mirrors are this repo's top bug class
  // and "both turns opposite the pattern" is itself a sign comparison, so a
  // mirror-only regression in the suppression logic would ship silently.
  it('the boundary band mirrors: a left-turn hold names the heading-driven turn too', () => {
    const r = determineEntry(183, NONSTANDARD) // mirror of 177 into STANDARD
    expect(r.primary).toBe('teardrop')
    expect(r.alternates).toContain('parallel')
    const text = flyItText(entryGuidance('parallel', NONSTANDARD), 183)
    expect(text).toContain('turn left onto 180°') // 183 → 180 is 3° LEFT
    expect(text).toContain('right turn through more than 180°') // the rejoin is unchanged
    // The fix-crossing turn follows the pattern here, so the gloss must not claim
    // both turns oppose it — the claim is false of this scenario.
    expect(text).not.toContain('both turns opposite the pattern')
  })

  it('exactly aligned mirrors: a left-turn hold names no fix-crossing turn either', () => {
    const text = flyItText(entryGuidance('parallel', NONSTANDARD), 180)
    expect(text).toContain('roll out on 180°')
    expect(text).not.toContain('turn right onto')
    expect(text).not.toContain('turn left onto')
    expect(text).not.toContain('both turns opposite the pattern')
  })

  it('teardrop keeps the pattern direction and the holding side, with no >180° script', () => {
    const text = flyItText(entryGuidance('teardrop', STANDARD), 130)
    // 180 outbound offset 30° toward the holding side (east of a 000 inbound).
    expect(text).toContain('outbound heading 150°')
    expect(text).toContain('on the holding side') // not satisfied by 'nonholding side'
    expect(text).toContain('right turn')
    expect(text).not.toContain('more than 180°')
  })

  it('direct turns with the pattern at the fix and gets no >180° script', () => {
    const text = flyItText(entryGuidance('direct', STANDARD), 30)
    expect(text).toContain('outbound heading 180°')
    expect(text).toContain('right turn')
    expect(text).not.toContain('more than 180°')
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

  // The plan-view picture of the entry is the thing an HSI cannot show — you
  // cannot see a teardrop's 30° offset or a parallel's >180° reintercept on a
  // compass rose. mapview builds and tests it; until it is rendered here the
  // student never sees it.
  it('feedback draws the plan view of the entry actually flown', () => {
    const { el } = setup('cockpit')
    const scenario = generateScenario(42)
    expect(el.querySelector('.map-entry'), 'no entry path before answering').toBeNull()

    answerButton(el, scenario.result.primary).click()
    const group = el.querySelector('.map-entry')
    expect(group).not.toBeNull()
    expect(group!.classList.contains(`map-entry-${scenario.result.primary}`)).toBe(true)
  })

  it('a wrong answer illustrates the correct entry, not the one chosen', () => {
    const { el } = setup('cockpit')
    const scenario = generateScenario(42)
    const wrong = ENTRIES.find(
      (e) => e !== scenario.result.primary && !scenario.result.alternates.includes(e),
    )!
    answerButton(el, wrong).click()
    const group = el.querySelector('.map-entry')!
    expect(group.classList.contains(`map-entry-${scenario.result.primary}`)).toBe(true)
    expect(group.classList.contains(`map-entry-${wrong}`)).toBe(false)
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

  it('correct ±5° alternate: the verdict names what the pilot chose, not the primary', () => {
    const { el } = setup('learn', DUAL_KEYED_SEED)
    answerButton(el, 'direct').click()

    const verdict = el.querySelector('.entry-verdict')!.textContent!
    expect(verdict).toContain('Correct — Direct entry')
    expect(verdict).toContain('Parallel also acceptable')
    // The parallel's signature instruction must not be attached to a direct entry.
    expect(el.querySelector('.entry-guidance')!.textContent).not.toContain('more than 180°')
  })

  it('renders the engine-derived fly-it line verbatim, naming the fix-crossing turn', () => {
    const { el } = setup('learn', DUAL_KEYED_SEED)
    const scenario = generateScenario(DUAL_KEYED_SEED)
    expect(scenario.result.primary).toBe('parallel')
    answerButton(el, 'parallel').click()

    const guidance = el.querySelector('.entry-guidance')!.textContent!
    expect(guidance).toBe(flyItText(entryGuidance('parallel', scenario.holdSpec), scenario.heading))
    expect(guidance).toMatch(/cross the fix, turn (left|right) onto/)
  })

  // The AIM states ONE timing rule for all three entries. The familiar
  // "parallel and teardrop time from the fix, direct times from abeam" split is a
  // derivation from it, so it may be explained but never cited as the rule.
  it('quotes the AIM outbound-timing sentence verbatim for every entry, with its citation', () => {
    for (const seed of [42, DUAL_KEYED_SEED, CHARTED_SEED]) {
      const { el } = setup('learn', seed)
      answerButton(el, generateScenario(seed).result.primary).click()
      const timing = el.querySelector('.entry-outbound-timing')!.textContent!
      expect(timing).toContain(OUTBOUND_TIMING_AIM)
      expect(timing).toContain(OUTBOUND_TIMING_SOURCE)
      // The derivation must render in full and OUTSIDE the cited span: matching
      // the bare word 'derivation' would pass even if the note were folded into
      // the quotation, which is the thing the split exists to prevent.
      expect(timing).toContain(OUTBOUND_TIMING_NOTE)
      expect(OUTBOUND_TIMING_AIM).not.toContain(OUTBOUND_TIMING_NOTE)
      expect(OUTBOUND_TIMING_NOTE.toLowerCase()).toContain('derivation')
    }
    expect(OUTBOUND_TIMING_SOURCE).toBe('AIM 5-3-8 j4(b)')
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

  it('shows the plate line for an "as published" clearance', () => {
    const { el } = setup('cockpit', CHARTED_SEED)
    const chart = el.querySelector<HTMLElement>('.entry-chart')!
    expect(chart.hidden).toBe(false)
    expect(chart.textContent).toContain(generateScenario(CHARTED_SEED).chartNote!)
  })

  it('hides the plate line when the clearance states course and turns', () => {
    const { el } = setup('cockpit', 0)
    expect(el.querySelector<HTMLElement>('.entry-chart')!.hidden).toBe(true)
  })

  it('shows session and cockpit-benchmark stats', () => {
    const { el } = setup('cockpit')
    answerButton(el, generateScenario(42).result.primary).click()
    const stats = el.querySelector('.entry-stats')!.textContent!
    expect(stats).toContain('1/1')
    expect(stats).toContain('18/20')
  })
})

// Regression: an "as published" clearance is legitimately silent on inbound
// course and turn direction (JO 7110.65 4-6-4) — the pilot reads them off the
// plate. Cockpit mode shows no thumb overlay, so without the plate line the
// left-turn charted fixtures graded a correct "silence means right turns"
// inference as wrong: negative training on the one rule that must be reflexive.
describe('every scenario is answerable from what the pilot is shown', () => {
  /** Turn direction a pilot could read off the prompt alone. */
  function turnDirectionShown(seed: number): 'left' | 'right' {
    const s = generateScenario(seed)
    const shown = `${s.clearanceText} ${s.chartNote ?? ''}`
    return /left turns/.test(shown) ? 'left' : 'right'
  }

  it('the turn direction the prompt implies is the one the answer key uses', () => {
    for (let seed = 0; seed < 500; seed++) {
      const { holdSpec } = generateScenario(seed)
      expect(turnDirectionShown(seed), `seed ${seed}`).toBe(holdSpec.turnDirection)
    }
  })

  it('charted holds carry the plate line; spoken clearances do not need one', () => {
    for (let seed = 0; seed < 500; seed++) {
      const s = generateScenario(seed)
      if (s.holdSpec.fixKind === 'charted') {
        expect(s.chartNote, `seed ${seed}`).toContain(courseText(s.holdSpec.inboundCourse))
        expect(s.chartNote, `seed ${seed}`).toContain(`${s.holdSpec.turnDirection} turns`)
      } else {
        expect(s.chartNote, `seed ${seed}`).toBeUndefined()
      }
    }
  })

  // The plate line is the one place the drill shows course/turn/leg data as if
  // it came off a chart, but PUBLISHED_HOLDS is invented practice data. Fixture
  // names have collided with real waypoints before (CEDES, SUNOL and TRACY are
  // real NorCal fixes, TRACY beside KTCY), so the rendered line must say it is
  // fictitious — a student must never memorize invented data for a fix they fly.
  it('marks the plate line as a practice plate, never as a real chart', () => {
    for (let seed = 0; seed < 500; seed++) {
      const s = generateScenario(seed)
      if (s.holdSpec.fixKind === 'charted') {
        expect(s.chartNote, `seed ${seed}`).toMatch(/practice plate/i)
        expect(s.chartNote, `seed ${seed}`).toMatch(/fictitious/i)
      }
    }
  })

  it('no fixture reuses a real NorCal fix name the student might fly', () => {
    // Verified against opennav.com: CEDES (Livermore), SUNOL and TRACY are real
    // waypoints; the remaining fixture names return no waypoint record.
    const real = ['CEDES', 'SUNOL', 'TRACY', 'JEMKO']
    for (const h of PUBLISHED_HOLDS) {
      expect(real, `fixture ${h.fix}`).not.toContain(h.fix)
    }
  })

  it('the spoken text still omits course and turns for a charted hold', () => {
    // The clearance itself must stay faithful to ATC phraseology.
    const s = generateScenario(CHARTED_SEED)
    expect(s.clearanceText).toContain('as published')
    expect(s.clearanceText).not.toContain('left turns')
    expect(s.clearanceText).not.toContain('radial')
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
