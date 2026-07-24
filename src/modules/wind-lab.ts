// Wind & Timing Lab: predict → fly → debrief (the CFI Notebook exercise).
// The pilot commits to their numbers first — outbound heading, inbound crab,
// outbound time — then the sim flies those decisions through the wind and the
// debrief compares them with the wind engine's textbook circuit (the ghost
// track on the map).
//
// Grading targets the decisions, not the first-circuit outcome: even perfect
// AIM-rule numbers can leave the first inbound leg 10+ s off in strong wind,
// because wind keeps drifting the pattern during the two 1-minute turns. The
// measured inbound instead drives the next-circuit suggestion — exactly the
// AIM 5-3-8 j4 loop ("adjust subsequent outbound legs"). Heading and crab are
// framed by the ACS holding skill tolerance (selected headings ±10°).
//
// Only the first circuit per scenario is scored; re-flying the same wind with
// adjusted numbers is the practice loop, not a new attempt.

import type { Screen } from '../app/router'
import { store as appStore, type Store } from '../app/store'
import { mulberry32, type LegSpec } from '../engine/clearance'
import type { TurnDirection } from '../engine/entry'
import { angleDiff, normalizeDeg } from '../engine/geometry'
import {
  HOLD_TAS_KT,
  MAX_OUTBOUND_SECONDS,
  flyCircuit,
  textbookDecisions,
  type SimPoint,
  type SimResult,
} from '../engine/sim'
import { TIMING_SOURCE, WIND_SOURCE, groundSpeeds, type Wind } from '../engine/wind'
import { renderMap } from '../ui/mapview'
import { courseText } from '../format'


export const ACS_SOURCE = 'FAA-S-ACS-8C Task III.B (maintain selected headings ±10°)'

/** ACS holding skill: selected headings ±10° — applied to outbound and crab. */
const HEADING_TOLERANCE_DEG = 10
/** Lab standard for the outbound-time plan vs the AIM-rule number. */
const TIMING_PLAN_TOLERANCE_S = 10
const TARGET_INBOUND_S = 60

/**
 * Practice fixtures — not real fixes.
 *
 * The scenario invents course, turns and legs for whichever name is drawn, so a
 * name must return no waypoint record at opennav.com/waypoint/US/<NAME>. The
 * earlier list failed that: WINDY is a fix at Newman, CA — beside KTCY — and
 * DRIFT and TIMBR are real too. Guarded by tests in wind-lab.test.ts.
 */
export const FIXES = ['ZORVU', 'QUIBO', 'GUSTO', 'VAXNU', 'CRABB'] as const

export interface WindLabHold {
  fix: string
  /** Inbound holding course TO the fix, degrees magnetic in [0, 360). */
  inboundCourse: number
  turnDirection: TurnDirection
  leg: LegSpec
}

export interface WindLabScenario {
  seed: number
  hold: WindLabHold
  wind: Wind
  /** Engine oracle: the AIM-rule numbers for this hold and wind. */
  target: { crab: number; outboundHeading: number; outboundSeconds: number }
}

/** The pilot's committed prediction for one circuit. */
export interface PilotNumbers {
  outboundHeading: number
  /** Signed degrees: positive = crab right. */
  crab: number
  outboundSeconds: number
}

export interface WindLabDebrief {
  numbers: PilotNumbers
  target: WindLabScenario['target']
  sim: SimResult
  /** Textbook circuit flown by the same sim, for the map's dashed ghost. */
  ghost: SimPoint[]
  /** Signed shortest turn from the textbook heading to the flown one. */
  headingErrorDeg: number
  crabErrorDeg: number
  /** Measured inbound minus the 60 s target. */
  timingErrorSeconds: number
  headingWithinAcs: boolean
  crabWithinAcs: boolean
  timingPlanOk: boolean
  correct: boolean
  /**
   * Exact AIM j4 adjustment for the next circuit, whole seconds, ≥1 — or null
   * when the circuit never reached the fix. The adjustment scales the *inbound*
   * error, and an incomplete circuit has no inbound leg to measure.
   */
  nextOutboundSeconds: number | null
  sources: { wind: string; timing: string; acs: string }
}

export interface WindLabOptions {
  seed?: number
  store?: Store
  now?: () => number
}

export interface WindLabController {
  readonly scenario: WindLabScenario
  readonly session: { attempts: number; correct: number }
  fly(numbers: PilotNumbers): WindLabDebrief
  next(): WindLabScenario
}

export function generateWindScenario(seed: number): WindLabScenario {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`seed must be finite, got ${seed}`)
  }
  const rng = mulberry32(Math.trunc(seed))
  const fix = FIXES[Math.floor(rng() * FIXES.length)]!
  const inboundCourse = 5 * Math.floor(rng() * 72)
  const turnDirection: TurnDirection = rng() < 0.5 ? 'right' : 'left'
  const wind: Wind = {
    directionFrom: 10 * Math.floor(rng() * 36),
    speedKt: 5 + Math.floor(rng() * 21),
  }
  const hold: WindLabHold = { fix, inboundCourse, turnDirection, leg: { unit: 'min', value: 1 } }
  const d = textbookDecisions(hold, wind)
  return {
    seed,
    hold,
    wind,
    target: {
      crab: d.inboundCrab,
      outboundHeading: d.outboundHeading,
      outboundSeconds: d.outboundSeconds,
    },
  }
}

export function createWindLab(options: WindLabOptions = {}): WindLabController {
  const store = options.store ?? appStore
  const now = options.now ?? (() => Date.now())

  let seed = options.seed ?? Math.floor(Math.random() * 2 ** 31)
  let scenario = generateWindScenario(seed)
  let shownAt = now()
  let scored = false
  const session = { attempts: 0, correct: 0 }

  return {
    get scenario() {
      return scenario
    },
    get session() {
      return session
    },

    fly(numbers: PilotNumbers): WindLabDebrief {
      const { hold, wind, target } = scenario
      const sim = flyCircuit(
        hold,
        {
          entry: 'direct',
          outboundHeading: numbers.outboundHeading,
          inboundCrab: numbers.crab,
          outboundSeconds: numbers.outboundSeconds,
        },
        wind,
      )
      const ghost = flyCircuit(hold, textbookDecisions(hold, wind), wind).track

      const headingErrorDeg = angleDiff(target.outboundHeading, numbers.outboundHeading)
      const crabErrorDeg = numbers.crab - target.crab
      const headingWithinAcs = Math.abs(headingErrorDeg) <= HEADING_TOLERANCE_DEG
      const crabWithinAcs = Math.abs(crabErrorDeg) <= HEADING_TOLERANCE_DEG
      const timingPlanOk =
        Math.abs(numbers.outboundSeconds - target.outboundSeconds) <= TIMING_PLAN_TOLERANCE_S
      const correct = headingWithinAcs && crabWithinAcs && timingPlanOk && sim.completed

      const gs = groundSpeeds(hold.inboundCourse, wind, HOLD_TAS_KT)
      // Clamped to the sim's own accepted range: the suggestion is what the
      // pilot types in next, so a value flyCircuit would reject is not advice.
      // Withheld entirely on an incomplete circuit — there sim.inboundSeconds is
      // the sim's time limit minus the turn and outbound legs, an artifact of
      // where it gave up rather than a measured inbound.
      const nextOutboundSeconds = sim.completed
        ? Math.min(
            MAX_OUTBOUND_SECONDS,
            Math.max(
              1,
              Math.round(
                numbers.outboundSeconds +
                  ((TARGET_INBOUND_S - sim.inboundSeconds) * gs.inboundKt) / gs.outboundKt,
              ),
            ),
          )
        : null

      if (!scored) {
        scored = true
        session.attempts += 1
        if (correct) {
          session.correct += 1
        }
        store.recordDrillResult('wind-lab', { correct, timeSeconds: (now() - shownAt) / 1000 })
        if (!correct) {
          store.recordMiss('wind-lab', {
            seed: scenario.seed,
            hold,
            wind,
            numbers,
            target,
            measured: {
              inboundSeconds: sim.inboundSeconds,
              inboundCrossTrackNm: sim.inboundCrossTrackNm,
              completed: sim.completed,
            },
          })
        }
      }

      return {
        numbers,
        target,
        sim,
        ghost,
        headingErrorDeg,
        crabErrorDeg,
        timingErrorSeconds: sim.inboundSeconds - TARGET_INBOUND_S,
        headingWithinAcs,
        crabWithinAcs,
        timingPlanOk,
        correct,
        nextOutboundSeconds,
        sources: { wind: WIND_SOURCE, timing: TIMING_SOURCE, acs: ACS_SOURCE },
      }
    },

    next(): WindLabScenario {
      seed = scenario.seed + 1
      scenario = generateWindScenario(seed)
      shownAt = now()
      scored = false
      return scenario
    },
  }
}

// --- screen -----------------------------------------------------------------

function crabText(crab: number): string {
  const rounded = Math.round(crab * 10) / 10
  if (rounded === 0) {
    return '0°'
  }
  return `${Math.abs(rounded)}° ${rounded > 0 ? 'right' : 'left'}`
}

export function renderWindLab(el: HTMLElement, options: WindLabOptions = {}): void {
  const lab = createWindLab(options)

  el.innerHTML = `
    <section class="wind-lab">
      <h1>Wind &amp; Timing Lab</h1>
      <p class="lab-scenario"></p>
      <p class="lab-hint">Predict your numbers, then fly the circuit. Solid track = your
        decisions; dashed = the textbook triple-drift circuit.</p>
      <p class="lab-ask">Outbound time asked for here is the ground-speed ratio that makes the
        <strong>inbound leg 60 s</strong> in this wind — not the leg you would actually fly first.
        In the aeroplane you fly the first outbound leg at 1 minute and adjust the
        <em>subsequent</em> ones (<cite>${TIMING_SOURCE}</cite>).</p>
      <div class="lab-form">
        <label>Outbound heading °
          <input class="lab-input-heading" type="number" inputmode="numeric" min="0" max="360" step="1">
        </label>
        <label>Inbound crab ° (+ right / − left)
          <input class="lab-input-crab" type="number" inputmode="numeric" min="-45" max="45" step="1">
        </label>
        <label>Outbound time s (for a 60 s inbound)
          <input class="lab-input-time" type="number" inputmode="numeric" min="1" max="600" step="1">
        </label>
      </div>
      <button class="lab-fly">Fly it</button>
      <div class="lab-map"></div>
      <div class="lab-debrief" aria-live="polite"></div>
      <button class="lab-next">Next wind</button>
    </section>
  `

  const scenarioEl = el.querySelector<HTMLElement>('.lab-scenario')!
  const mapEl = el.querySelector<HTMLElement>('.lab-map')!
  const debriefEl = el.querySelector<HTMLElement>('.lab-debrief')!
  const headingInput = el.querySelector<HTMLInputElement>('.lab-input-heading')!
  const crabInput = el.querySelector<HTMLInputElement>('.lab-input-crab')!
  const timeInput = el.querySelector<HTMLInputElement>('.lab-input-time')!

  function showScenario(): void {
    const { hold, wind } = lab.scenario
    // Labelled fictitious for the same reason as entry-drill's chartNote: the
    // course, turns and legs are invented, and the map draws them north-up like
    // a plate. Only the wind triangle is being taught here, never the hold.
    scenarioEl.textContent =
      `Practice fixture (fictitious fix) — hold at ${hold.fix}: inbound course ` +
      `${courseText(hold.inboundCourse)}, ${hold.turnDirection} turns, 1-minute legs. ` +
      `Wind ${courseText(wind.directionFrom)} at ${wind.speedKt} kt, TAS ${HOLD_TAS_KT} kt.`
    renderMap(mapEl, { holdSpec: lab.scenario.hold })
    debriefEl.textContent = ''
    debriefEl.className = 'lab-debrief'
    headingInput.value = ''
    crabInput.value = ''
    timeInput.value = ''
  }

  function showDebrief(d: WindLabDebrief): void {
    renderMap(mapEl, { holdSpec: lab.scenario.hold, track: d.sim.track, ghostTrack: d.ghost })
    const verdict = d.correct
      ? 'Numbers on target.'
      : [
          d.headingWithinAcs ? '' : 'outbound heading outside ACS ±10°',
          d.crabWithinAcs ? '' : 'inbound crab off by more than 10°',
          d.timingPlanOk
            ? ''
            : 'outbound time plan more than 10 s off the ground-speed ratio for a 60 s inbound',
          d.sim.completed ? '' : 'the circuit never made it back to the fix',
        ]
          .filter(Boolean)
          .join('; ')
    const inbound = d.sim.completed
      ? `${Math.round(d.sim.inboundSeconds)} s (target ${TARGET_INBOUND_S} s), ` +
        `crossing ${Math.abs(Math.round(d.sim.inboundCrossTrackNm * 100) / 100)} NM ` +
        `${d.sim.inboundCrossTrackNm >= 0 ? 'holding-side of' : 'off'} the fix`
      : 'never reached the fix'

    debriefEl.className = `lab-debrief ${d.correct ? 'is-correct' : 'is-wrong'}`
    debriefEl.innerHTML = `
      <p class="lab-verdict">${verdict}</p>
      <ul class="lab-rows">
        <li>Outbound heading: yours ${courseText(d.numbers.outboundHeading)}, textbook
          ${courseText(d.target.outboundHeading)} (Δ ${Math.round(Math.abs(d.headingErrorDeg))}°,
          triple drift — <cite>${d.sources.wind}</cite>; tolerance <cite>${d.sources.acs}</cite>)</li>
        <li>Inbound crab: yours ${crabText(d.numbers.crab)}, computed ${crabText(d.target.crab)}</li>
        <li>Outbound time: yours ${Math.round(d.numbers.outboundSeconds)} s, ground-speed ratio
          ${Math.round(d.target.outboundSeconds)} s (AIM j4 has you fly the first outbound leg at
          1 minute, then adjust the next one)</li>
        <li>Inbound leg: ${inbound}</li>
      </ul>
      ${
        d.nextOutboundSeconds === null
          ? `<p class="lab-suggest">No adjustment to give: the circuit never closed on the fix,
               so there is no inbound time to correct from. Re-fly it with a shorter outbound leg
               (<cite>${d.sources.timing}</cite>).</p>`
          : `<p class="lab-suggest">Adjust: next circuit fly ${d.nextOutboundSeconds} s outbound
               (<cite>${d.sources.timing}</cite>).</p>`
      }
    `
  }

  el.querySelector<HTMLButtonElement>('.lab-fly')!.addEventListener('click', () => {
    const heading = parseFloat(headingInput.value)
    const crab = parseFloat(crabInput.value)
    const seconds = parseFloat(timeInput.value)
    // Blank fields parse to NaN; catch them here so the pilot gets a prompt,
    // not the engine's RangeError (which is reserved for out-of-range values).
    if (!Number.isFinite(heading) || !Number.isFinite(crab) || !Number.isFinite(seconds)) {
      debriefEl.className = 'lab-debrief is-error'
      debriefEl.textContent = 'Enter all three numbers before flying.'
      return
    }
    try {
      showDebrief(
        lab.fly({
          outboundHeading: normalizeDeg(heading),
          crab,
          outboundSeconds: seconds,
        }),
      )
    } catch (err) {
      debriefEl.className = 'lab-debrief is-error'
      debriefEl.textContent = err instanceof RangeError ? err.message : String(err)
    }
  })

  el.querySelector<HTMLButtonElement>('.lab-next')!.addEventListener('click', () => {
    lab.next()
    showScenario()
  })

  showScenario()
}

export const windLabScreen: Screen = {
  path: 'wind-lab',
  title: 'Wind & Timing Lab',
  render(el) {
    renderWindLab(el)
  },
}
