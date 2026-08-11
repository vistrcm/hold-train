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
  CDI_ARMING_AIM,
  CDI_ARMING_SOURCE,
  CDI_SCALE_AIM,
  CDI_SCALE_NOTE,
  CLEARANCE_LEAD_ATC,
  CLEARANCE_LEAD_MINUTES,
  CLEARANCE_LEAD_SOURCE,
  COCKPIT_TARGET_SECONDS,
  createEntryDrill,
  entryDrillScreen,
  flyItText,
  generateScenario,
  gradeEntryAnswer,
  LEAD_DISTANCE_NOTE,
  MAX_DISTANCE_NM,
  MIN_DISTANCE_NM,
  NOMINAL_GROUNDSPEED_KT,
  OUTBOUND_TIMING_AIM,
  OUTBOUND_TIMING_NOTE,
  OUTBOUND_TIMING_SOURCE,
  renderEntryDrill,
  SPEED_REDUCTION_AIM,
  SPEED_REDUCTION_MINUTES,
  SPEED_REDUCTION_SOURCE,
} from './entry-drill'
import { courseText, distanceText } from '../format'
import {
  DEVIATION_DOTS,
  FULL_SCALE_NM,
  FULL_SCALE_SOURCE,
  LAYOUT,
  PX_PER_NM,
  renderHSI,
} from '../ui/hsi'

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

describe('scenario distance to the fix', () => {
  /**
   * Regression pin, captured BEFORE `distanceNm` existed.
   *
   * A stored miss and the Anki card exported from it are keyed by seed alone
   * (`store.recordMiss` here, `missesToCards` in src/app/anki-export.ts), so
   * what a seed produces is history rather than an implementation detail:
   * shifting the RNG stream would silently rewrite every card already in a
   * user's deck to a different question. The distance draw is therefore
   * APPENDED after the heading draw, and this is what pins that.
   *
   * Both halves are hand-derived, not only read back:
   *  - headings, from `mulberry32(seed ^ 0x9e3779b9)` — seed 7 → 353,
   *    seed 42 → 173;
   *  - answers, from the heading against the fixture hold. Seed 7 is inbound
   *    080 with right turns, and 353 − 080 = 273°, inside the 180°–290°
   *    parallel sector of a standard pattern. Seed 42 is inbound 250 with left
   *    turns, and 173 − 250 = 283°, inside the mirrored 250°–360° direct
   *    sector. That is also the plan's before/after check on the answer key:
   *    distance is display state and must not reach `determineEntry`.
   */
  it('keeps every existing seed on its original heading and answer', () => {
    const a = generateScenario(7)
    expect(a.heading).toBe(353)
    expect(a.result.primary).toBe('parallel')

    const b = generateScenario(42)
    expect(b.heading).toBe(173)
    expect(b.result.primary).toBe('direct')
  })

  it('places the aircraft inside the ATC lead window on every seed', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { distanceNm } = generateScenario(seed)
      expect(distanceNm).toBeGreaterThanOrEqual(MIN_DISTANCE_NM)
      expect(distanceNm).toBeLessThanOrEqual(MAX_DISTANCE_NM)
    }
  })

  it('spans the window between the two verified timings', () => {
    // Ordering first: the speed-reduction point is inside the lead time, which
    // is the whole reason the two bracket a window rather than name a point.
    expect(SPEED_REDUCTION_MINUTES).toBeLessThan(CLEARANCE_LEAD_MINUTES)
    expect(MIN_DISTANCE_NM).toBeLessThan(MAX_DISTANCE_NM)
    // Hand check, deliberately not a restatement of the formula: 3 and 5
    // minutes at 120 kt is 6 and 10 NM — single-digit miles, which is the scale
    // of picture the panel draws. The defect these bounds exist to catch is the
    // unit slip the derivation invites: drop the ÷ 60 and the window becomes
    // 360–600 NM, which still passes every range assertion above because those
    // are stated against the same constants.
    //
    // ⚠️ The upper bound is a unit-slip guard and nothing more. It used to be
    // justified here as "well inside the 30 NM at which a GPS arms terminal CDI
    // scaling (AIM 1-1-17 b.5(e))" — a comparison between distance to a holding
    // fix and distance to an airport reference point, which is not a comparison
    // at all. That inference is withdrawn (see `CDI_ARMING_AIM`); do not restore
    // it by reading 30 as an airspace or avionics threshold. Any bound that
    // catches 360–600 NM would do.
    expect(MIN_DISTANCE_NM).toBeGreaterThan(1)
    expect(MAX_DISTANCE_NM).toBeLessThan(30)
    expect(NOMINAL_GROUNDSPEED_KT).toBeGreaterThan(0)
  })

  it('spreads across the window rather than parking on one end', () => {
    const seen = new Set<number>()
    for (let seed = 0; seed < 200; seed++) {
      seen.add(generateScenario(seed).distanceNm)
    }
    expect(seen.size).toBeGreaterThan(20)
    const mid = (MIN_DISTANCE_NM + MAX_DISTANCE_NM) / 2
    expect([...seen].some((d) => d < mid)).toBe(true)
    expect([...seen].some((d) => d > mid)).toBe(true)
  })

  it('quantises to the resolution distanceText renders', () => {
    // The status line shows one decimal. A stored 7.3365 would put "7.3 NM" on
    // the panel beside a needle computed from a different number — small, but
    // it is the same class of two-roundings-disagree defect `distanceText`
    // itself exists to prevent.
    for (let seed = 0; seed < 60; seed++) {
      const { distanceNm } = generateScenario(seed)
      expect(Number(distanceNm.toFixed(1))).toBe(distanceNm)
      expect(distanceText(distanceNm)).toBe(`${distanceNm.toFixed(1)} NM`)
    }
  })

  it('cites both timings at sub-paragraph granularity', () => {
    expect(CLEARANCE_LEAD_SOURCE).toBe('FAA JO 7110.65BB 4-6-1 c.4')
    expect(SPEED_REDUCTION_SOURCE).toBe('AIM 5-3-8 d')
  })

  // The quoted sentences are verbatim FAA text, so they are NOT templated from
  // the constants — a quotation with an interpolation in it is not a quotation.
  // The agreement is asserted instead: retune either constant and the sentence
  // rendered beside the distance stops supporting the number it explains, which
  // is the failure mode of a source quoted next to a value it no longer governs.
  it('quotes timings that still say what the generator’s constants claim', () => {
    expect(CLEARANCE_LEAD_ATC).toContain(`at least ${CLEARANCE_LEAD_MINUTES} minutes`)
    expect(SPEED_REDUCTION_AIM).toContain(`${SPEED_REDUCTION_MINUTES} minutes or less`)
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

  // The answer row sits directly under the G1000 panel, which is a filled rect
  // that fills its whole viewBox — flush against it, the buttons read as part of
  // the instrument (a softkey strip) rather than as the answer input. The label
  // is the first half of the separation: it gives the row a page voice, and it
  // is what the detaching margin hangs on in styles.css (on the label, not on
  // .entry-answers, so the gap opens above the group and not inside it).
  it('names the answer row in the page’s voice, immediately above the buttons', () => {
    const { el } = setup('learn')
    const answers = el.querySelector<HTMLElement>('.entry-answers')!
    const label = el.querySelector<HTMLElement>('.entry-answers-label')!
    expect(label).not.toBeNull()
    expect(label.textContent!.trim().length).toBeGreaterThan(0)
    // `hidden` reflects the HTML attribute and nothing else. Every screen-reader-only
    // technique is CSS (`display: none`, `position: absolute` + `clip`), so this
    // assertion cannot see the one that matters and must not claim to: an
    // out-of-flow label leaves .entry-answers following .entry-hsi with nothing
    // between them, buttons flush against the panel again. That half is guarded
    // where it is visible — `separates the answer group…` in styles.test.ts reads
    // the label's rule and refuses one that takes it out of flow.
    expect(label.hidden, 'the label is not hidden by attribute').toBe(false)
    // Immediately before: any element between them would take the margin's gap
    // and be read as the thing the label names.
    expect(answers.previousElementSibling).toBe(label)
    // And the other side of the same adjacency, which the whole spacing guard
    // rests on and nothing asserted: the margin in styles.css detaches the group
    // from whatever precedes the label, so it only closes this defect while that
    // is the instrument. Move the panel below the row, or slip a hint line
    // between them, and the buttons are flush against the G1000 rect again with
    // both the DOM test above and the stylesheet ratio still green.
    const above = label.previousElementSibling
    expect(above?.className, 'the separating margin must land against the HSI').toBe('entry-hsi')
  })

  // .entry-modes has carried role/aria-label since it shipped; .entry-answers
  // carried neither, so a screen reader met three ungrouped, unexplained
  // buttons. The visible label doubles as the accessible name.
  it('groups the answer buttons and names them by the visible label', () => {
    const { el } = setup('learn')
    const answers = el.querySelector<HTMLElement>('.entry-answers')!
    const label = el.querySelector<HTMLElement>('.entry-answers-label')!
    expect(answers.getAttribute('role')).toBe('group')
    const named = answers.getAttribute('aria-labelledby')
    expect(named).not.toBeNull()
    // The id must actually resolve, and to *that* label — an aria-labelledby
    // pointing at nothing leaves the group anonymous with the markup looking right.
    expect(el.querySelector(`#${named}`)).toBe(label)
  })

  // One template serves both modes, so this is a regression guard rather than a
  // second behaviour: a future mode-specific branch must not drop the label from
  // the timed view, where the row is the only thing the student touches.
  it('labels and groups the row in cockpit mode too', () => {
    const { el } = setup('cockpit')
    const answers = el.querySelector<HTMLElement>('.entry-answers')!
    const label = el.querySelector<HTMLElement>('.entry-answers-label')!
    expect(label.textContent!.trim().length).toBeGreaterThan(0)
    expect(answers.previousElementSibling).toBe(label)
    expect(answers.getAttribute('role')).toBe('group')
    expect(el.querySelector(`#${answers.getAttribute('aria-labelledby')}`)).toBe(label)
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

    const next = generateScenario(43)
    expect(el.querySelector('.entry-clearance')!.textContent).toContain(next.clearanceText)
    expect(el.querySelector('.entry-feedback')!.textContent).toBe('')
    for (const entry of ENTRIES) {
      expect(answerButton(el, entry).disabled).toBe(false)
    }
  })

  // The clearance is not the whole prompt: the scenario line and the panel's
  // nav data are the aircraft's POSITION, and they are rendered from separate
  // reads of `drill.scenario`. Checking the clearance alone leaves a Next that
  // advances the answer key while the position stays on the previous scenario —
  // a needle and a distance describing an aircraft the question is not about.
  // Asserted against a seed pair that actually differs in each field, so the
  // assertion cannot pass by the two scenarios coinciding.
  it('next moves the position too, not just the clearance', () => {
    const before = generateScenario(42)
    const after = generateScenario(43)
    expect(after.distanceNm, 'seeds 42/43 must differ for this to bind').not.toBe(before.distanceNm)

    const { el } = setup('learn')
    expect(el.querySelector('.hsi-nav-distance')!.textContent).toBe(distanceText(before.distanceNm))

    answerButton(el, before.result.primary).click()
    el.querySelector<HTMLButtonElement>('.entry-next')!.click()

    expect(el.querySelector('.entry-scenario')!.textContent).toContain(
      distanceText(after.distanceNm),
    )
    expect(el.querySelector('.entry-scenario')!.textContent).toContain(after.holdSpec.fix)
    expect(el.querySelector('.hsi-nav-distance')!.textContent).toBe(distanceText(after.distanceNm))
    expect(el.querySelector('.hsi-nav-fix')!.textContent).toBe(after.holdSpec.fix)
    expect(el.querySelector('.hsi-hdg-value')!.textContent).toBe(courseText(after.heading))
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

  // --- the aircraft's position reaches the panel ------------------------------
  //
  // Every scenario used to imply the aircraft was overhead the fix: the drill
  // carried no position and the HSI got heading and course only. These pin the
  // wiring that ends that, from the screen side — `hsi.ts` cannot see its own
  // consumers, and its no-nav contract is silent by design, so a drill that
  // stopped passing `nav` would draw the written test's picture with the whole
  // HSI suite still green.

  it('gives the panel the fix, the distance and a bug parked on the nose', () => {
    const { el } = setup('cockpit')
    const s = generateScenario(42)
    expect(el.querySelector('.hsi-nav-fix')!.textContent).toBe(s.holdSpec.fix)
    expect(el.querySelector('.hsi-nav-distance')!.textContent).toBe(distanceText(s.distanceNm))
    // The bug is parked on the current heading, so the HDG box reads it back —
    // see the note on HSIProps.headingBug: same number three times, on purpose.
    expect(el.querySelector('.hsi-bug')).not.toBeNull()
    expect(el.querySelector('.hsi-hdg-value')!.textContent).toBe(courseText(s.heading))
  })

  // `fix`, `distanceNm` and `headingBug` above are what the panel draws AROUND
  // the picture. `heading` and `course` ARE the picture: they set the card
  // rotation, the pointer, the CRS box, which way the bar deflects and the
  // TO/FROM word. A drawHSI that hands over the reciprocal course, or swaps the
  // two, still draws a well-formed panel — of a different aircraft — and every
  // assertion above it stays green. All three mutations passed 732/732 before
  // this test existed.
  //
  // The goldens are STATED, not re-read out of `s`: an expectation built from
  // `s.holdSpec.inboundCourse` agrees by construction with a drawHSI reading
  // that same field wrongly, which is the consumer-vs-oracle tautology the
  // parallel-entry rule in CLAUDE.md warns about one screen over.
  it('draws the card on the scenario heading and the pointer on the inbound course', () => {
    // Seed 42: heading 173, hold 250° left turns, 9.9 NM out. `keeps every
    // existing seed on its original heading and answer` is what holds these.
    const s = generateScenario(42)
    expect([s.heading, s.holdSpec.inboundCourse], 'seed 42 goldens moved').toEqual([173, 250])

    const { el } = setup('cockpit')
    expect(el.querySelector('.hsi-heading-readout')!.textContent).toBe('173°')
    expect(el.querySelector('.hsi-crs-value')!.textContent).toBe('250°')

    // TO/FROM hand-derived from the drawn picture rather than from
    // `courseDeviation`, which would flip along with the renderer: tracking
    // direct, the aircraft sits 9.9 NM out on the 353 bearing from Delta, and
    // 173 lies 77° off the 250 course — inside the 90° abeam boundary — so
    // flying 250 from here closes on the fix. TO. Cross-track is
    // −9.9·sin(−77°) = +9.6 NM, i.e. right of course, so the bar (which shows
    // where the course is, not where you are) pegs LEFT of the centreline.
    expect(el.querySelector('.hsi-nav-sense')!.textContent).toBe('TO')
    expect(el.querySelector('.hsi-tofrom')!.getAttribute('data-sense')).toBe('to')
    expect(Number(el.querySelector('.hsi-cdi-bar')!.getAttribute('x1'))).toBeLessThan(LAYOUT.cx)
  })

  it('shows the deviation indication the written-test figure suppresses', () => {
    // The bar, the dots and the flag are exactly what `hsi.ts` drops when there
    // is no position, so their presence here is the assertion that the position
    // arrived — not that the panel merely rendered.
    const { el } = setup('cockpit')
    expect(el.querySelector('.hsi-cdi-bar')).not.toBeNull()
    expect(el.querySelectorAll('.hsi-cdi-dot')).toHaveLength(DEVIATION_DOTS * 2)
    expect(el.querySelector('.hsi-tofrom')).not.toBeNull()
    expect(el.querySelector('.hsi-status')).not.toBeNull()
  })

  it('renders the distance in prose through distanceText, not a second rounding', () => {
    // A bare `${distanceNm} NM` agrees with distanceText on 8.4 and disagrees on
    // a whole mile ("9 NM" vs "9.0 NM"), so a whole-mile seed is the only one
    // that can catch the second rounding rule distanceText exists to prevent.
    // Found rather than hard-coded: the generator's window may be re-tuned.
    const seeds = [...Array(200).keys()]
    const wholeSeed = seeds.find((s) => Number.isInteger(generateScenario(s).distanceNm))
    expect(wholeSeed, 'no whole-mile distance in the first 200 seeds').toBeDefined()

    for (const seed of [42, wholeSeed!]) {
      const { el } = setup('learn', seed)
      const s = generateScenario(seed)
      const line = el.querySelector('.entry-scenario')!.textContent!
      expect(line, `seed ${seed}`).toContain(distanceText(s.distanceNm))
      expect(line, `seed ${seed}`).toContain(s.holdSpec.fix)
      // The direct-to assumption is what makes the panel's TO/FROM flag true
      // (see the docblock on courseDeviation); the student is told it, not left
      // to infer it from a needle.
      expect(line, `seed ${seed}`).toMatch(/tracking direct/i)
    }
  })

  it('names the fix in the scenario line exactly as the clearance names it', () => {
    // One ident on the radio call, in the prose and on the panel. Two spellings
    // of one fix on one screen would read as two fixes.
    for (const seed of [0, 1, 42, DUAL_KEYED_SEED, CHARTED_SEED]) {
      const { el } = setup('learn', seed)
      const { holdSpec } = generateScenario(seed)
      expect(el.querySelector('.entry-clearance')!.textContent, `seed ${seed}`).toContain(
        holdSpec.fix,
      )
      expect(el.querySelector('.entry-scenario')!.textContent, `seed ${seed}`).toContain(
        holdSpec.fix,
      )
      expect(el.querySelector('.hsi-nav-fix')!.textContent, `seed ${seed}`).toBe(holdSpec.fix)
    }
  })

  it('quotes both timings verbatim with their sources, derivation kept outside', () => {
    const { el } = setup('cockpit')
    const lead = el.querySelector('.entry-lead')!
    // Each quoted span CLOSES on the FAA sentence — asserted with the quotation
    // marks, not merely with `toContain`. The two constants not containing each
    // other (below) is a weaker claim than it looks: the template could still
    // set the closing mark after the derivation and present the assumption as
    // quoted text, with every plain `toContain` still passing.
    expect(lead.textContent).toContain(`“${CLEARANCE_LEAD_ATC}”`)
    expect(lead.textContent).toContain(`“${SPEED_REDUCTION_AIM}”`)
    expect(lead.textContent).toContain(LEAD_DISTANCE_NOTE)
    expect([...lead.querySelectorAll('cite')].map((c) => c.textContent)).toEqual([
      CLEARANCE_LEAD_SOURCE,
      SPEED_REDUCTION_SOURCE,
    ])
    // The miles are a derivation from an assumed groundspeed, and the FAA says
    // nothing about groundspeed here. Folding it into either cited span would
    // present the assumption as the citation — the failure the outbound-timing
    // split above exists to prevent, repeated for the distance.
    expect(CLEARANCE_LEAD_ATC).not.toContain(LEAD_DISTANCE_NOTE)
    expect(SPEED_REDUCTION_AIM).not.toContain(LEAD_DISTANCE_NOTE)
    expect(LEAD_DISTANCE_NOTE).toContain(`${NOMINAL_GROUNDSPEED_KT} kt`)
    expect(LEAD_DISTANCE_NOTE.toLowerCase()).toContain('assumption')
    expect(CLEARANCE_LEAD_ATC).not.toMatch(/kt|groundspeed/i)
    expect(SPEED_REDUCTION_AIM).not.toMatch(/kt|groundspeed/i)
  })

  // The scale is the one aviation fact on this screen a student reads off the
  // instrument rather than out of the prose: two dots a side means each is worth
  // half of FULL_SCALE_NM. That makes it a user-visible fact under the citation
  // convention, and a `source` constant nothing renders satisfies none of it —
  // `FULL_SCALE_SOURCE` had no consumer at all before this.
  it('cites the CDI scale beside the needle, with the mode caveat outside the quote', () => {
    const { el } = setup('cockpit')
    const cdi = el.querySelector('.entry-cdi')!
    expect(cdi.textContent).toContain(`“${CDI_SCALE_AIM}”`)
    expect(cdi.textContent).toContain(`“${CDI_ARMING_AIM}”`)
    expect(cdi.textContent).toContain(CDI_SCALE_NOTE)
    expect([...cdi.querySelectorAll('cite')].map((c) => c.textContent)).toEqual([
      FULL_SCALE_SOURCE,
      CDI_ARMING_SOURCE,
    ])

    // ⚠️ Sub-paragraph granularity is the convention, and the arming sentence is
    // one level deeper than the citation used to claim. Walking the `<ol>`
    // nesting of the fetched AIM page puts "…'arm' annunciation 30 NM straight
    // line distance…" at path [2, 5, 5, 3] over levels one→four = b.5(e)(3);
    // `b.5(e)` alone is the ~10-item list "Procedures for Accomplishing GPS
    // Approaches", so a student following the `<cite>` landed on the list. This
    // pins the DEPTH rather than the string: flattening it back to the container
    // is the regression, and it is exactly what the shape check catches.
    expect(CDI_ARMING_SOURCE, 'cite the sub-item, not the list containing it').toMatch(
      /^AIM 1-1-17 b\.5\(e\)\(\d+\)$/,
    )

    // The AIM sentences cite the VALUE and the arming CONDITIONS. Terminal mode
    // for a hold is this drill's assumption — the AIM is talking about departures
    // and DPs — so it stays outside both quoted spans, exactly as
    // LEAD_DISTANCE_NOTE does for the groundspeed and OUTBOUND_TIMING_NOTE does
    // for the per-entry split.
    expect(CDI_SCALE_AIM).not.toContain(CDI_SCALE_NOTE)
    expect(CDI_ARMING_AIM).not.toContain(CDI_SCALE_NOTE)
    expect(CDI_SCALE_AIM).not.toMatch(/hold|assum/i)
    expect(CDI_ARMING_AIM).not.toMatch(/hold|assum/i)
    expect(CDI_SCALE_NOTE.toLowerCase()).toContain('assumption')
  })

  // The withdrawn inference (docs/content-audit.md, 2026-08-07). The screen used
  // to justify terminal scaling by "the 6–10 NM window sits well inside the 30 NM
  // at which terminal scaling arms" — comparing distance to a HOLDING FIX against
  // b.5(e)'s distance to an AIRPORT/HELIPORT REFERENCE POINT, with the approach
  // loaded and armed. Neither condition follows from the drill's distance, so the
  // claim was false and uncited, and a student reads it off the screen.
  //
  // This guards the *shape* of the correction, not just the deleted words: the
  // 30 NM may only appear tied to its reference point, and the drill's own window
  // may not be offered as the reason the mode is honest.
  //
  // Scanned off the RENDERED paragraph, not off the two constants it was built
  // from: the screen composes `.entry-cdi` from five strings, so a scan of two
  // of them lets the withdrawn claim back in through a sixth — a scope narrower
  // than the claim, which is the failure mode CLAUDE.md records for the prose
  // and README globs. What a student reads is the unit under test.
  it('does not offer the drill’s distance as a reason for terminal scaling', () => {
    const { el } = setup('cockpit')
    const prose = el.querySelector('.entry-cdi')!.textContent ?? ''
    expect(prose.length, 'the CDI footnote rendered empty').toBeGreaterThan(200)
    expect(prose).not.toMatch(/sits well inside/i)
    // Every mention of the threshold carries what it is measured from.
    for (const m of prose.matchAll(/30 NM/gi)) {
      const after = prose.slice(m.index!, m.index! + 120)
      expect(after).toMatch(/airport(\/heliport)? reference point/i)
    }
    // The quotation is the only place the arming conditions are asserted, and it
    // is verbatim: the note may restate them but must not be the sole carrier.
    expect(CDI_ARMING_AIM).toMatch(/airport\/heliport reference point/)
    expect(CDI_ARMING_AIM).toMatch(/loaded in the navigation system/)
    expect(CDI_ARMING_AIM).toMatch(/Without arming/)
  })

  // The quotation carries a number, so it can fall out of step with the constant
  // it is cited for — the same drift `quotes timings that still say what the
  // generator’s constants claim` guards on the lead-time side.
  //
  // Which side of that drift each line catches matters here. `CDI_SCALE_AIM` is
  // a fixed literal, so re-reading `FULL_SCALE_NM` against it binds. But
  // `CDI_SCALE_NOTE` is BUILT from these constants, so the three lines that once
  // re-read `FULL_SCALE_NM`, `FULL_SCALE_NM / DEVIATION_DOTS` and the window
  // against it restated the template and could not fail — the ledger credited
  // them with catching a `DEVIATION_DOTS` re-tune, which no expression built
  // from `DEVIATION_DOTS` can do. Hand-written literals instead, so re-tuning
  // any of the four constants reds this test and forces the prose to be
  // re-derived deliberately (it also catches a re-tune that renders a raw float:
  // at 110 kt the window interpolates as "5.5–9.166666666666666 NM").
  it('quotes a scale the instrument still draws on', () => {
    expect(CDI_SCALE_AIM).toContain(`±${FULL_SCALE_NM} NM`)
    expect(CDI_SCALE_NOTE).toContain('±1 NM')
    expect(CDI_SCALE_NOTE).toContain('2 dots a side')
    expect(CDI_SCALE_NOTE).toContain('0.5 NM')
    expect(CDI_SCALE_NOTE).toContain('6–10 NM')
  })

  // "Expect it pegged across this drill's 6–10 NM window: unless you are nearly
  // on the inbound course or its reciprocal, it is" is a claim about the DRAWN
  // needle, and the test above only string-matches numbers. Re-tune
  // `FULL_SCALE_NM` to the en route ±5 NM the withdrawn docblock once
  // contemplated and the needle is essentially never pegged in this window while
  // the screen goes on telling the student to expect it — negative training with
  // the suite green. Asserted against the rendered bar, and both ways round, so
  // it also fails a clamp that pegs everything and never lets go.
  it('draws the pegged needle its own prose tells the student to expect', () => {
    const course = 90
    const full = FULL_SCALE_NM * PX_PER_NM
    const deflection = (heading: number, distanceNm: number): number => {
      const el = document.createElement('div')
      renderHSI(el, { heading, course, nav: { fix: PUBLISHED_HOLDS[0]!.fix, distanceNm } })
      return Math.abs(Number(el.querySelector('.hsi-cdi-bar')!.getAttribute('x1')) - LAYOUT.cx)
    }
    // "nearly on the course or its reciprocal" is asin(full scale / distance),
    // widest at the near edge of the window. The note claims a narrow band.
    const band = (Math.asin(FULL_SCALE_NM / MIN_DISTANCE_NM) * 180) / Math.PI
    expect(band, 'the note promises a pegged needle, not a lively one').toBeLessThan(15)

    for (const distanceNm of [MIN_DISTANCE_NM, MAX_DISTANCE_NM]) {
      // every heading well clear of 090 and 270 pegs, either side
      for (const heading of [0, 60, 120, 180, 240, 300]) {
        expect(deflection(heading, distanceNm), `heading ${heading} at ${distanceNm} NM`).toBeCloseTo(
          full,
          6,
        )
      }
      // and on the course it is genuinely centred, so the peg is the geometry
      // rather than a bar stuck on the outer dot
      expect(deflection(course, distanceNm), `on course at ${distanceNm} NM`).toBeCloseTo(0, 6)
    }
  })

  it('keeps the learn/cockpit aid gating unchanged now the panel carries nav data', () => {
    const learn = setup('learn')
    expect(learn.el.querySelector('.hsi-thumb')).not.toBeNull()
    expect(learn.el.querySelector('.hsi-sector-direct')).not.toBeNull()

    const cockpit = setup('cockpit')
    expect(cockpit.el.querySelector('.hsi-thumb')).toBeNull()
    expect(cockpit.el.querySelector('.hsi-sector-direct')).toBeNull()

    // Feedback reveals the sectors — and only the sectors. The thumb band is a
    // learn-mode aid; answering does not earn it.
    answerButton(cockpit.el, generateScenario(42).result.primary).click()
    expect(cockpit.el.querySelector('.hsi-sector-direct')).not.toBeNull()
    expect(cockpit.el.querySelector('.hsi-thumb')).toBeNull()

    // The nav picture is not an aid: it is the situation, so it survives the
    // re-render that drops and restores the overlays.
    expect(cockpit.el.querySelector('.hsi-status')).not.toBeNull()
    expect(learn.el.querySelector('.hsi-status')).not.toBeNull()
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
