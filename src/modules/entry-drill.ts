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
  type TurnDirection,
} from '../engine/entry'
import { angleDiff } from '../engine/geometry'
import {
  DEVIATION_DOTS,
  FULL_SCALE_NM,
  FULL_SCALE_SOURCE,
  renderHSI,
  type HSIProps,
} from '../ui/hsi'
import { renderMap } from '../ui/mapview'
import { courseText, distanceText } from '../format'

export type DrillMode = 'learn' | 'cockpit'

export const COCKPIT_TARGET_SECONDS = 15

/** Cockpit results live under 'entry' — the drill the stored benchmark scores. */
const DRILL_IDS: Record<DrillMode, string> = { cockpit: 'entry', learn: 'entry-learn' }

/**
 * The ATC rule that puts the fix ahead of the aircraft, verbatim.
 *
 * This is why the drill depicts an aircraft short of the fix rather than over
 * it: the entry decision is made while the fix is still ahead. Rendered on the
 * screen inside its cited span, per the CLAUDE.md citation convention — and NOT
 * templated from `CLEARANCE_LEAD_MINUTES`, because a quotation with an
 * interpolation in it is no longer a quotation. `entry-drill.test.ts` asserts
 * the two agree instead.
 *
 * Verified against
 * faa.gov/air_traffic/publications/atpubs/atc_html/chap4_section_6.html and the
 * order's own PDF (the HTML renders its list markers from CSS, so the
 * sub-paragraph letter is not in the markup).
 */
export const CLEARANCE_LEAD_ATC =
  'When delay is expected, issue items in subparagraphs a and b at least ' +
  '5 minutes before the aircraft is estimated to reach the clearance limit. ' +
  'If the traffic situation requires holding an aircraft that is less than ' +
  '5 minutes from the holding fix, issue these items immediately.'

/**
 * The order's lead time, minutes.
 *
 * A FLOOR in the order ("at least 5 minutes"), used here as the far end of the
 * drill's window: the drill draws the last 5 minutes before the fix, which is
 * the tightest case the order contemplates, not the only one. A clearance
 * issued 20 minutes out is equally legal and simply off this picture.
 */
export const CLEARANCE_LEAD_MINUTES = 5

export const CLEARANCE_LEAD_SOURCE = 'FAA JO 7110.65BB 4-6-1 c.4'

/**
 * The pilot's end of the same timeline, verbatim.
 *
 * The 3 minutes here is what 7110.65's NOTE under 4-6-1 c.4 says the 5-minute
 * requirement is built on, so the two timings are one rule seen from both
 * seats — which is what makes them a window rather than two unrelated numbers.
 */
export const SPEED_REDUCTION_AIM =
  'When an aircraft is 3 minutes or less from a clearance limit and a clearance ' +
  'beyond the fix has not been received, the pilot is expected to start a speed ' +
  'reduction so that the aircraft will cross the fix, initially, at or below the ' +
  'maximum holding airspeed.'

/** The near end of the window, minutes — where the pilot's own timeline starts. */
export const SPEED_REDUCTION_MINUTES = 3

export const SPEED_REDUCTION_SOURCE = 'AIM 5-3-8 d'

/**
 * Groundspeed the window is converted to miles at, knots.
 *
 * ⚠️ NOT an FAA figure and never cited as one — a training assumption, chosen
 * as a typical light single's cruise and comfortably under the 200 KIAS maximum
 * holding airspeed at or below 6,000 ft (AIM 5-3-8 j2, TBL 5-3-1). It sets the
 * scale of the picture, not the answer: `determineEntry` never sees it.
 */
export const NOMINAL_GROUNDSPEED_KT = 120

/** Nearest the fix a scenario is drawn: the speed-reduction point, in miles. */
export const MIN_DISTANCE_NM = (SPEED_REDUCTION_MINUTES / 60) * NOMINAL_GROUNDSPEED_KT

/** Farthest: the order's minimum lead, in miles — see `CLEARANCE_LEAD_MINUTES`
 *  for why the floor of the rule is the ceiling of the picture. */
export const MAX_DISTANCE_NM = (CLEARANCE_LEAD_MINUTES / 60) * NOMINAL_GROUNDSPEED_KT

/**
 * How the two quoted timings become the miles on the panel — a derivation, and
 * labelled as one.
 *
 * It renders OUTSIDE both cited spans for the same reason `OUTBOUND_TIMING_NOTE`
 * does: neither the order nor the AIM says anything about groundspeed, so
 * folding this into either quotation would present a training assumption as FAA
 * text. Built from the constants rather than retyping their values, so the
 * sentence a student reads cannot outlive a re-tuned window.
 */
export const LEAD_DISTANCE_NOTE =
  `Those two timings bracket the window this drill draws from — ` +
  `${SPEED_REDUCTION_MINUTES} to ${CLEARANCE_LEAD_MINUTES} minutes from the fix, flown at an ` +
  `assumed ${NOMINAL_GROUNDSPEED_KT} kt groundspeed. The groundspeed is a training assumption ` +
  `that sets the scale of the picture, not an FAA figure. The distance is display state either ` +
  `way: the entry sector comes from heading against the holding course alone.`

/**
 * What a dot on the deviation bar is worth, verbatim (AIM 1-1-17 b.4, verified
 * against faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html).
 *
 * The needle is read quantitatively — two dots a side, so each is worth half of
 * `FULL_SCALE_NM` — which makes the scale a user-visible aviation fact under the
 * CLAUDE.md citation convention, and a citation counts only once it is on the
 * screen. `FULL_SCALE_SOURCE` lives with the constant in `src/ui/hsi.ts`; this
 * is where it renders, because the instrument draws no prose of its own.
 */
export const CDI_SCALE_AIM =
  'The GPS receiver must be set to terminal (±1 NM) CDI sensitivity and the ' +
  'navigation routes contained in the database in order to fly published IFR ' +
  'charted departures and DPs.'

export const CDI_SCALE_SOURCE = FULL_SCALE_SOURCE

/**
 * What terminal scaling is actually conditioned on, verbatim (AIM 1-1-17 b.5(e),
 * verified against
 * faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html).
 *
 * This quotation is here to **withdraw** a claim, not to add one. The screen used
 * to argue that terminal was the honest mode because the drill's 6–10 NM window
 * "sits well inside the 30 NM at which terminal scaling arms" — which compares two
 * different distances. The AIM's 30 NM is measured from the *airport/heliport
 * reference point*, and only with an approach loaded and armed; neither follows
 * from being 6–10 NM from a *holding fix*. A hold 8 NM from its fix can sit
 * hundreds of miles from any airport, with the receiver still on en route ±5 NM —
 * where this needle would be far *less* pegged than the panel draws it. Quoting
 * the conditions makes the withdrawal checkable rather than a second bare
 * assertion, which is why the fix is a citation and not a deletion.
 */
export const CDI_ARMING_AIM =
  'When an approach has been loaded in the navigation system, GPS receivers will give an ' +
  // Inner quotes downgraded to singles: the AIM writes “arm”, and this string is
  // rendered inside a “…” span, so nesting the same mark ends the quotation early
  // on screen. The words are untouched.
  '‘arm’ annunciation 30 NM straight line distance from the airport/heliport reference point. ' +
  'Pilots should arm the approach mode at this time if not already armed (some receivers arm ' +
  'automatically). Without arming, the receiver will not change from en route CDI and RAIM ' +
  'sensitivity of ±5 NM either side of centerline to ±1 NM terminal sensitivity.'

export const CDI_ARMING_SOURCE = 'AIM 1-1-17 b.5(e)'

/**
 * The caveat, and why it is a separate string.
 *
 * The AIM sentences above cite the ±1 NM *value* and the conditions terminal
 * scaling arms under, and nothing else. No FAA source says a hold is flown on
 * terminal scaling, and b.5(e) does not supply one — see `CDI_ARMING_AIM`.
 * Terminal is this drill's assumption. Folding that inside either quoted span
 * would present an assumption as FAA text, which is the failure the
 * `OUTBOUND_TIMING_AIM`/`OUTBOUND_TIMING_NOTE` split exists to prevent; this is
 * the same split for the CDI scale. Built from the constants so the sentence
 * cannot outlive a re-tuned scale.
 */
export const CDI_SCALE_NOTE =
  `The needle is drawn on that terminal scale: full scale is ±${FULL_SCALE_NM} NM, so each of ` +
  `the ${DEVIATION_DOTS} dots a side is worth ${FULL_SCALE_NM / DEVIATION_DOTS} NM of ` +
  `cross-track. Terminal sensitivity is this drill's assumption and not an FAA statement about ` +
  `holds: what the AIM conditions it on is an approach loaded and armed within 30 NM of the ` +
  `airport reference point, and how far you are from a holding fix settles neither. Read the ` +
  `picture the needle draws, not a distance inferred from the scale. Expect it pegged across ` +
  `this drill's ${MIN_DISTANCE_NM}–${MAX_DISTANCE_NM} NM window: unless you are nearly on the ` +
  `inbound course or its reciprocal, it is, and that is the picture of being cleared to hold ` +
  `while not established.`

export interface EntryScenario {
  seed: number
  /** Aircraft heading when the clearance is received. */
  heading: number
  /**
   * Distance to the holding fix, NM — the aircraft is tracking direct to it.
   *
   * Display state only. It drives the HSI's deviation bar and status line
   * (`courseDeviation` in src/engine/nav.ts is the oracle for both) and touches
   * the answer key nowhere: AIM 5-3-8 j3 decides the entry sector from heading
   * against the holding course alone.
   */
  distanceNm: number
  clearanceText: string
  /**
   * What the plate says, for "as published" clearances only. ATC omits course
   * and turn direction there (JO 7110.65 4-6-4) because the pilot reads them
   * off the chart — without this the entry is not determinable from the prompt.
   */
  chartNote?: string
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
  // Appended AFTER the heading draw, never inserted before it: a stored miss
  // and its exported Anki card are keyed by seed, so moving the heading a seed
  // produces would rewrite questions already in a user's deck. Rounded to the
  // one decimal `distanceText` renders, so the status line and the needle are
  // computed from the same number.
  const distanceNm =
    Math.round((MIN_DISTANCE_NM + rng() * (MAX_DISTANCE_NM - MIN_DISTANCE_NM)) * 10) / 10
  const scenario: EntryScenario = {
    seed,
    heading,
    distanceNm,
    clearanceText: clearance.text,
    holdSpec,
    result: determineEntry(heading, holdSpec),
  }
  if (holdSpec.fixKind === 'charted') {
    scenario.chartNote = chartNote(holdSpec)
  }
  return scenario
}

/**
 * The plate line a pilot would read for an "as published" clearance.
 *
 * Labelled as a practice plate on purpose: the course, turns and leg length come
 * from the invented PUBLISHED_HOLDS fixtures, not from a chart. Presenting them
 * as charted data would be negative training if a fixture name ever collides
 * with a real fix — which it has.
 */
export function chartNote(holdSpec: HoldSpec): string {
  const leg =
    holdSpec.leg.unit === 'min'
      ? `${holdSpec.leg.value} minute legs`
      : `${holdSpec.leg.value} NM legs`
  return (
    `Practice plate (fictitious fix) — ${holdSpec.fix}: inbound course ` +
    `${courseText(holdSpec.inboundCourse)}, ${holdSpec.turnDirection} turns, ${leg}.`
  )
}

/**
 * AIM 5-3-8 j4(b), verbatim (verified against
 * faa.gov/air_traffic/publications/atpubs/aim_html/chap5_section_3.html).
 */
export const OUTBOUND_TIMING_AIM =
  'Outbound leg timing begins over/abeam the fix, whichever occurs later. ' +
  'If the abeam position cannot be determined, start timing when turn to outbound is completed.'

export const OUTBOUND_TIMING_SOURCE = 'AIM 5-3-8 j4(b)'

/**
 * The AIM gives ONE timing rule for all three entries. The familiar per-entry
 * split is a derivation from that sentence, not AIM text, so it is presented as
 * an explanation and never as the citation.
 */
export const OUTBOUND_TIMING_NOTE =
  'That is one rule for every entry. The familiar split — time from the fix on a ' +
  'parallel or teardrop, from abeam on a direct — is a derivation from that sentence, ' +
  'not AIM text.'

/**
 * The "fly it" instruction for an entry, built entirely from engine guidance.
 *
 * A parallel entry is the only entry whose turn ACROSS THE FIX onto outbound
 * opposes the pattern, so it is the only one whose first turn is worth naming:
 * a left-turn hold is entered with two right turns, and only the final turn at
 * the fix follows the pattern (see docs/parallel-entry-evidence.md).
 *
 * ⚠️ That first turn is taken FROM THE AIRCRAFT'S HEADING, so it is derived from
 * `heading`, not from `turnToInbound`. Throughout the parallel sector proper the
 * two agree — that agreement is the structure worth teaching — but inside the
 * ±5° teardrop/parallel boundary band (AIM 5-3-8 j8(d)) parallel is an accepted
 * answer while the aircraft is already all but aligned with the outbound course:
 * at heading 177 into a standard hold on inbound 000, the turn onto 180 is a 3°
 * turn to the RIGHT, and "turn left onto 180°" would be negative training. The
 * "both turns opposite the pattern" gloss is therefore stated only when it is
 * true of the scenario in front of the learner.
 */
export function flyItText(g: EntryGuidance, heading: number): string {
  const outbound = courseText(g.outboundHeading)
  if (g.entry === 'parallel') {
    const first = angleDiff(heading, g.outboundHeading)
    const firstTurn: TurnDirection | null = first === 0 ? null : first > 0 ? 'right' : 'left'
    const cross = firstTurn ? `turn ${firstTurn} onto ${outbound}` : `roll out on ${outbound}`
    return (
      `Fly it: cross the fix, ${cross} on the ${g.side} side, then ${g.turnToInbound} turn ` +
      `through more than 180° back to the inbound course` +
      (firstTurn === g.turnToInbound ? ' — both turns opposite the pattern.' : '.')
    )
  }
  return (
    `Fly it: cross the fix, outbound heading ${outbound} on the ${g.side} side, ` +
    `then ${g.turnToInbound} turn back to the inbound course.`
  )
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
          // Without the plate line an "as published" card is unanswerable.
          chartNote: scenario.chartNote,
          chosen,
          expected: scenario.result.primary,
          alternates: scenario.result.alternates,
        })
      }

      return {
        correct,
        chosen,
        result: scenario.result,
        // A ±5° alternate is a correct answer, so fly what the pilot picked —
        // the primary's script would describe a different pattern (AIM 5-3-8 j8(d)).
        guidance: entryGuidance(correct ? chosen : scenario.result.primary, scenario.holdSpec),
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
      <p class="entry-chart" hidden></p>
      <p class="entry-scenario"></p>
      <div class="entry-hsi"></div>
      <div class="entry-answers">
        ${ENTRIES.map(
          (e) => `<button class="entry-answer" data-entry="${e}">${ENTRY_LABELS[e]}</button>`,
        ).join('')}
      </div>
      <div class="entry-feedback" aria-live="polite"></div>
      <div class="entry-map"></div>
      <button class="entry-next" hidden>Next</button>
      <p class="entry-stats"></p>
      <p class="entry-lead">“${CLEARANCE_LEAD_ATC}” <cite>${CLEARANCE_LEAD_SOURCE}</cite>
        “${SPEED_REDUCTION_AIM}” <cite>${SPEED_REDUCTION_SOURCE}</cite> ${LEAD_DISTANCE_NOTE}</p>
      <p class="entry-cdi">“${CDI_SCALE_AIM}” <cite>${CDI_SCALE_SOURCE}</cite>
        “${CDI_ARMING_AIM}” <cite>${CDI_ARMING_SOURCE}</cite>
        ${CDI_SCALE_NOTE}</p>
    </section>
  `

  const clearanceEl = el.querySelector<HTMLElement>('.entry-clearance')!
  const chartEl = el.querySelector<HTMLElement>('.entry-chart')!
  const scenarioEl = el.querySelector<HTMLElement>('.entry-scenario')!
  const hsiEl = el.querySelector<HTMLElement>('.entry-hsi')!
  const mapEl = el.querySelector<HTMLElement>('.entry-map')!
  const feedbackEl = el.querySelector<HTMLElement>('.entry-feedback')!
  const nextBtn = el.querySelector<HTMLButtonElement>('.entry-next')!
  const statsEl = el.querySelector<HTMLElement>('.entry-stats')!
  const answerBtns = [...el.querySelectorAll<HTMLButtonElement>('.entry-answer')]

  function drawHSI(showSectors: boolean): void {
    const { heading, holdSpec, result, distanceNm } = drill.scenario
    const props: HSIProps = {
      heading,
      course: holdSpec.inboundCourse,
      // The bug is parked on the nose: nothing else is selected, which is where
      // a pilot leaves it, so the HDG box, the bug and the heading readout all
      // show one number here (see the note on HSIProps.headingBug).
      headingBug: heading,
      // The position is what makes the deviation bar and the TO/FROM flag say
      // something true rather than decorative. `courseDeviation` reads it under
      // a direct-to assumption, which the scenario line below states out loud.
      nav: { fix: holdSpec.fix, distanceNm },
    }
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
    // "As published" is silent on course and turns; the plate supplies them.
    const note = drill.scenario.chartNote
    chartEl.textContent = note ?? ''
    chartEl.hidden = note === undefined
    // Where the aircraft is. "Tracking direct" is not scene-setting: it is the
    // assumption `courseDeviation` derives the TO/FROM flag from, so a student
    // reading the needle is told it rather than left to infer it. Distance goes
    // through `distanceText`, the same function the panel's status line uses.
    const { holdSpec, distanceNm } = drill.scenario
    scenarioEl.textContent =
      `You are ${distanceText(distanceNm)} from ${holdSpec.fix}, tracking direct to the fix.`
    drawHSI(false)
    // The plan view answers the question, so it only appears with the feedback.
    mapEl.innerHTML = ''
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
    // Name the entry being flown — the pilot's own when it was accepted, the
    // primary otherwise — and list the remaining accepted entries as alternates.
    const flown = fb.correct ? fb.chosen : fb.result.primary
    // North-up plan view of the entry being flown. The HSI cannot show a
    // teardrop's 30° offset leg or a parallel's >180° reintercept — those are
    // shapes on the ground, not needle positions.
    renderMap(mapEl, { holdSpec: drill.scenario.holdSpec, entryPath: flown })
    const others = [fb.result.primary, ...fb.result.alternates]
      .filter((e) => e !== flown)
      .map((e) => ENTRY_LABELS[e])
      .join(' or ')
    const alternateNote = others
      ? ` ${others} also acceptable — within 5° of a sector boundary.`
      : ''
    const verdict = fb.correct
      ? `Correct — ${ENTRY_LABELS[flown]} entry.${alternateNote}`
      : `Not quite — you chose ${ENTRY_LABELS[fb.chosen]}; correct answer: ${ENTRY_LABELS[flown]}.${alternateNote}`
    const g = fb.guidance
    const timing =
      `Answered in ${fb.timeSeconds.toFixed(1)} s` +
      (mode === 'cockpit' && fb.overTarget ? ` — over the ${COCKPIT_TARGET_SECONDS} s target` : '')

    feedbackEl.className = `entry-feedback ${fb.correct ? 'is-correct' : 'is-wrong'}`
    feedbackEl.innerHTML = `
      <p class="entry-verdict">${verdict}</p>
      <p class="entry-guidance">${flyItText(g, drill.scenario.heading)}</p>
      <p class="entry-outbound-timing">Outbound timing: “${OUTBOUND_TIMING_AIM}”
        <cite>${OUTBOUND_TIMING_SOURCE}</cite> ${OUTBOUND_TIMING_NOTE}</p>
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
