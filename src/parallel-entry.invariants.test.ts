// Cross-module invariant guard for the parallel entry's rejoin turn direction.
//
// WHY THIS FILE EXISTS: this repo shipped the rejoin turn inverted in five
// modules at once, and then "corrected" it the wrong way on 2026-07-22 by
// re-deriving it from the AIM sentence (docs/content-audit.md). The sentence —
// AIM 5-3-8 j3(a), "turn in the direction of the holding pattern through more
// than 180 degrees" — is genuinely ambiguous in words. It is SPATIAL (toward
// the racetrack, back across the holding course onto the holding side), NOT
// rotational, so the rejoin turn OPPOSES the pattern. FIG 5-3-4 settles it: the
// same standard-pattern figure draws the teardrop rejoin clockwise and the
// parallel rejoin counter-clockwise. The rendered evidence is recorded in
// docs/parallel-entry-evidence.md.
//
// ⚠️ The ">180°" clause does NOT discriminate between the two readings (both
// exceed 180°). Never re-derive the direction from it. Read the evidence doc.
//
// The defect spread because `entry.ts`, `sim.ts` and `mapview.ts` each
// hand-wrote the same geometry, so a single-file flip went unnoticed by a green
// suite. These assertions make the rule single-sourced in assertion as well as
// in code: the map must agree with the engine, the SIM must agree with the
// engine, and the prose must agree with both. All three modules are covered,
// because guarding two of the three leaves the third free to go stale with the
// suite green — the exact hole this file exists to close. Lives at src/ (not
// src/engine/) because it imports across engine/, ui/ and content/ — the same
// placement as styles.test.ts, contrast.test.ts and deploy.test.ts.

import { describe, expect, it } from 'vitest'
// The content modules are read as source text, not imported for their values:
// the claim under test is a sentence, and `?raw` is the idiom this repo already
// uses on styles.css (styles.test.ts) and README.md (dashboard.test.ts). They
// are globbed rather than imported one by one — see `CONTENT` below.
import { PARALLEL_INTERCEPT_DEG, type HoldCourse, type TurnDirection, entryGuidance } from './engine/entry'
import { normalizeDeg } from './engine/geometry'
import { SAMPLE_SECONDS, TURN_RATE_DEG_PER_S, flyCircuit, textbookDecisions } from './engine/sim'
import { renderMap } from './ui/mapview'

const EVIDENCE = 'see docs/parallel-entry-evidence.md — do not re-derive from the AIM sentence'

// 140 and 7 are here deliberately: every other entry is a multiple of 45, which
// is also PARALLEL_INTERCEPT_DEG, so a sweep built only from them makes every
// expected heading a multiple of 45 too — an implementation that quantised
// headings to a 45° grid would pass. Two non-multiples break that degeneracy.
const COURSES = [0, 7, 45, 90, 135, 140, 180, 225, 270, 315] as const
const PATTERNS: readonly TurnDirection[] = ['right', 'left']

// --- the map ↔ engine agreement sweep ----------------------------------------

/** All numbers in an attribute string, in order. */
function nums(s: string | null): number[] {
  return (s?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
}

/** Unit vector (NM east/north) along a compass course. */
function unit(courseDeg: number): { e: number; n: number } {
  const rad = (courseDeg * Math.PI) / 180
  return { e: Math.sin(rad), n: Math.cos(rad) }
}

interface DrawnParallel {
  /** SVG arc sweep flag: 1 = clockwise on a north-up map, 0 = counter-clockwise. */
  sweepFlag: number
  /** Rollout point's perpendicular offset from the course, +ve toward the holding side, NM. */
  rolloutHoldingSideNm: number
  /** Straight-line distance from arc start to arc end, in units of the arc radius. */
  chordOverRadius: number
}

/**
 * Render the parallel entry path and read back the three facts that encode the
 * rejoin. `d` = `M fix L legEnd A rr rr 0 1 sweep rollout L fix`, so nums
 * indices are 2,3 = legEnd (arc start), 4 = radius, 7 = large-arc,
 * 8 = sweep flag, 9,10 = rollout point (arc end).
 */
function drawParallel(hold: HoldCourse): DrawnParallel {
  const el = document.createElement('div')
  renderMap(el, {
    holdSpec: { ...hold, fix: 'HAIRE', leg: { unit: 'min', value: 1 } },
    entryPath: 'parallel',
  })
  const scale = Number(el.querySelector('svg')!.getAttribute('data-scale'))
  const d = nums(el.querySelector('.map-entry path')!.getAttribute('d'))
  // un-project the rollout endpoint back to NM east/north of the fix
  const rollout = { e: (d[9]! - 100) / scale, n: (100 - d[10]!) / scale }
  const s = hold.turnDirection === 'right' ? 1 : -1
  const holdingSide = unit(normalizeDeg(hold.inboundCourse + 90 * s))
  return {
    sweepFlag: d[8]!,
    rolloutHoldingSideNm: rollout.e * holdingSide.e + rollout.n * holdingSide.n,
    chordOverRadius: Math.hypot(d[9]! - d[2]!, d[10]! - d[3]!) / d[4]!,
  }
}

describe('the map draws the rejoin the engine specifies', () => {
  // mapview.test.ts:214 checks the `data-turn-to-inbound` attribute, but that is
  // copied straight out of entryGuidance and so agrees vacuously — it would keep
  // passing with the arc drawn the other way round. This reads the sweep flag off
  // the rendered ARC, so it fails the moment `mapview.ts` derives the sign from
  // anything but the oracle (verified by substituting the old private copy).
  //
  // Now that mapview.ts reads `g.turnToInbound` directly, this test agrees by
  // construction when the ENGINE flips — that case is caught by A2 below, which
  // is anchored on the pattern rather than on the field under test. The two
  // together cover both failure modes; neither does alone.
  it('sweep flag matches entryGuidance turnToInbound for every course × pattern', () => {
    for (const turnDirection of PATTERNS) {
      for (const inboundCourse of COURSES) {
        const hold: HoldCourse = { inboundCourse, turnDirection }
        const g = entryGuidance('parallel', hold)
        const drawn = drawParallel(hold)
        const expected = g.turnToInbound === 'right' ? 1 : 0
        expect(
          drawn.sweepFlag,
          `${inboundCourse}°/${turnDirection}: engine says rejoin ${g.turnToInbound}, ` +
            `map drew sweep flag ${drawn.sweepFlag} (${EVIDENCE})`,
        ).toBe(expected)
      }
    }
  })

  // ➕ Beyond the plan's sweep-flag check: a sweep flag flipped on its own,
  // without moving the arc centre, still draws an arc the engine never meant.
  // The rollout endpoint is where the direction becomes a position, and A2 —
  // the rejoin ends on the HOLDING side — is the assertion that fails loudest
  // when the turn is inverted.
  it('A2: the rejoin rolls out on the holding side for every course × pattern', () => {
    for (const turnDirection of PATTERNS) {
      for (const inboundCourse of COURSES) {
        const drawn = drawParallel({ inboundCourse, turnDirection })
        expect(
          drawn.rolloutHoldingSideNm,
          `${inboundCourse}°/${turnDirection}: rollout is ` +
            `${drawn.rolloutHoldingSideNm.toFixed(3)} NM toward the holding side; ` +
            `negative means the rejoin turned the wrong way (${EVIDENCE})`,
        ).toBeGreaterThan(0)
      }
    }
  })

  // A2 and the sweep flag above are both SIGN checks: they catch an inversion
  // and nothing else. `PARALLEL_INTERCEPT_DEG` could be swapped for a literal 30
  // in mapview.ts and every assertion in this describe would still pass — the
  // rollout would simply land somewhere else on the holding side. That is the
  // same "single-sourced in code, unpinned in assertion" hole CLAUDE.md records
  // for sim.ts, and only mapview.test.ts's one hand-computed golden pair closed
  // it. This pins the DRAWN angle for every course × pattern.
  //
  // Read off the arc without re-deriving mapview's geometry: an SVG arc's chord
  // is `2R·sin(θ/2)` for swept angle θ, so `chord/R` fixes θ, scale-free and
  // course-free. And θ is 225° for BOTH senses — rotating from the outbound
  // heading `C+180` to the rollout `C + 45·rs` in direction `rs` is
  // `normalizeDeg(45 − 180·rs)`, which is 225 whether rs is +1 or −1. So this is
  // an angle assertion that is deliberately blind to direction (A2 owns that),
  // and it moves continuously with the constant: 45° → 1.8478, 30° → 1.9319.
  //
  // Tolerance is 2 decimals, not 3, and that is a floor set by the drawing, not
  // slack: the path rounds coordinates to 0.1 px against a ~13.6 px radius, so
  // the ratio carries ~0.001 of rounding noise. 2 decimals still separates 45°
  // from 30° by 17× the tolerance, and even a 1° drift (1.8541) fails.
  it('the drawn arc sweeps 180° + the engine intercept angle for every course × pattern', () => {
    const expected = 2 * Math.sin((((180 + PARALLEL_INTERCEPT_DEG) / 2) * Math.PI) / 180)
    for (const turnDirection of PATTERNS) {
      for (const inboundCourse of COURSES) {
        const drawn = drawParallel({ inboundCourse, turnDirection })
        expect(
          drawn.chordOverRadius,
          `${inboundCourse}°/${turnDirection}: engine intercept angle is ` +
            `${PARALLEL_INTERCEPT_DEG}°, so the arc sweeps ` +
            `${180 + PARALLEL_INTERCEPT_DEG}° and its chord is ${expected.toFixed(4)}R; ` +
            `map drew ${drawn.chordOverRadius.toFixed(4)}R (${EVIDENCE})`,
        ).toBeCloseTo(expected, 2)
      }
    }
  })
})

// --- the sim ↔ engine agreement sweep ----------------------------------------

const CALM = { directionFrom: 0, speedKt: 0 }
const LEG_SECONDS = 60

// Sample indices of the rejoin, DERIVED from the constants rather than written
// out. The window used to be the literals 120 and 195; those are only correct
// while the fix-crossing turn is 180°, the leg is 60 s and the rejoin sweeps
// 180 + 45. Raising PARALLEL_INTERCEPT_DEG (this branch already raised it once,
// 30 → 45) lengthens the rejoin past a hardcoded end index, which would silently
// truncate the window instead of failing — a hand-written copy of the geometry
// in the very file whose thesis is that hand-written copies drift.
//
// Rounded OUTWARD, and that matters: these are array indices. The expressions
// are integral only while PARALLEL_INTERCEPT_DEG is a multiple of the turn rate,
// and the dossier explicitly floats ≈31° as the measured value — at 31 the end
// index is 190.333, `track[192.333]` is `undefined`, and the `!` below turns a
// failed assertion into an opaque "cannot read properties of undefined" while
// the rotation window silently truncates. Widening is safe: the extra samples
// either side are straight flight and contribute ~0 rotation.
const REJOIN_START_SAMPLE = Math.floor((180 / TURN_RATE_DEG_PER_S + LEG_SECONDS) / SAMPLE_SECONDS)
const REJOIN_END_SAMPLE = Math.ceil(
  REJOIN_START_SAMPLE + (180 + PARALLEL_INTERCEPT_DEG) / TURN_RATE_DEG_PER_S / SAMPLE_SECONDS,
)

/** Compass bearing of the segment between two consecutive track samples. */
function segmentBearing(a: { e: number; n: number }, b: { e: number; n: number }): number {
  return normalizeDeg((Math.atan2(b.e - a.e, b.n - a.n) * 180) / Math.PI)
}

/**
 * Signed rotation of the flown ground track over one sample window, in radians:
 * positive = counter-clockwise (left), negative = clockwise (right).
 *
 * The 2D cross product of successive track segments is `|a||b|sin Δθ`, so
 * normalising each segment and summing recovers Σ sin Δθ ≈ the swept angle for
 * the ~3°/sample steps the sim takes. This measures the ROTATION the integrator
 * actually flew, not a constant read back out of the module under test —
 * `sim.test.ts` deliberately has no direction assertion of this kind (its former
 * one measured the track's excursion, which measures the DEFECT, not the sweep).
 */
function trackRotationRad(track: readonly { e: number; n: number }[], from: number, to: number): number {
  let sum = 0
  for (let i = from; i + 2 <= to; i++) {
    const a = { e: track[i + 1]!.e - track[i]!.e, n: track[i + 1]!.n - track[i]!.n }
    const b = { e: track[i + 2]!.e - track[i + 1]!.e, n: track[i + 2]!.n - track[i + 1]!.n }
    const la = Math.hypot(a.e, a.n)
    const lb = Math.hypot(b.e, b.n)
    if (la < 1e-9 || lb < 1e-9) {
      continue
    }
    sum += Math.asin(Math.max(-1, Math.min(1, (a.e * b.n - a.n * b.e) / (la * lb))))
  }
  return sum
}

describe('the sim flies the rejoin the engine specifies', () => {
  // `sim.ts` hand-derived this sign from `hold.turnDirection` and kept a private
  // copy of the intercept angle. That copy had NOT drifted — it agreed with the
  // map's literal at 30 until this branch single-sourced the angle and raised it
  // to 45 for legibility, a change rather than a repair, so it is no evidence
  // that 45 is the FAA-correct angle. It was still a second hand-written copy of
  // geometry, which is what the SIGN did drift in across five modules. Both now
  // come from `entryGuidance`, and this sweep is what keeps them there: without
  // it a future flip of the engine's parallel rule leaves the sim stale and green,
  // because every parallel assertion in sim.test.ts is a hardcoded golden
  // excursion that pins the sim against itself rather than against the oracle.
  it('rejoin rotation sense matches entryGuidance turnToInbound for every course × pattern', () => {
    for (const turnDirection of PATTERNS) {
      for (const inboundCourse of COURSES) {
        const hold: HoldCourse = { inboundCourse, turnDirection }
        const g = entryGuidance('parallel', hold)
        const r = flyCircuit(
          hold,
          {
            entry: 'parallel',
            outboundHeading: g.outboundHeading,
            inboundCrab: 0,
            outboundSeconds: LEG_SECONDS,
          },
          CALM,
        )
        // 180° onto outbound at 3°/s, then the leg, then the 180 + 45 rejoin;
        // the track is sampled at SAMPLE_SECONDS from the fix. Both bounds are
        // computed from the constants above, not written out.
        const rejoin = trackRotationRad(r.track, REJOIN_START_SAMPLE, REJOIN_END_SAMPLE)
        const expectedSign = g.turnToInbound === 'right' ? -1 : 1 // clockwise = negative
        expect(
          Math.sign(rejoin),
          `${inboundCourse}°/${turnDirection}: engine says rejoin ${g.turnToInbound}, ` +
            `sim flew ${((rejoin * 180) / Math.PI).toFixed(1)}° (${EVIDENCE})`,
        ).toBe(expectedSign)
        // A3 at the trajectory level: the flown rejoin really does exceed 180°.
        // The window clips the first and last segment, so the measured sweep is
        // a little under the nominal 225°.
        expect(
          Math.abs((rejoin * 180) / Math.PI),
          `${inboundCourse}°/${turnDirection}: rejoin swept less than 180°`,
        ).toBeGreaterThan(180)
      }
    }
  })

  // ⚠️ The rotation sweep above pins the rejoin's SIGN but not its MAGNITUDE:
  // `Math.sign` and `> 180°` are both satisfied by a 210° sweep, so replacing
  // `PARALLEL_INTERCEPT_DEG` in sim.ts with a literal 30 left the whole suite
  // green (verified by mutation). The same mutation in mapview.ts fails, because
  // mapview.test.ts pins the rollout POINT. This test is the sim's equivalent:
  // it reads the heading the integrator actually flies after the rejoin and
  // requires it to be the engine's intercept angle, so the one consumer that was
  // single-sourced in code but not in assertion is now held to the oracle too.
  it('rejoin rolls out on the engine intercept angle for every course × pattern', () => {
    for (const turnDirection of PATTERNS) {
      for (const inboundCourse of COURSES) {
        const hold: HoldCourse = { inboundCourse, turnDirection }
        const g = entryGuidance('parallel', hold)
        const r = flyCircuit(
          hold,
          {
            entry: 'parallel',
            outboundHeading: g.outboundHeading,
            inboundCrab: 0,
            outboundSeconds: LEG_SECONDS,
          },
          CALM,
        )
        // Two samples clear of rollout, so the segment is pure straight flight
        // and carries no share of the partial turning sample at the rollout.
        const i = REJOIN_END_SAMPLE + 2
        const flown = segmentBearing(r.track[i]!, r.track[i + 1]!)
        const rejoinSign = g.turnToInbound === 'right' ? 1 : -1
        const expected = normalizeDeg(inboundCourse + PARALLEL_INTERCEPT_DEG * rejoinSign)
        expect(
          flown,
          `${inboundCourse}°/${turnDirection}: engine intercept angle is ` +
            `${PARALLEL_INTERCEPT_DEG}° so the rollout heading is ${expected}°, ` +
            `sim flew ${flown.toFixed(2)}° (${EVIDENCE})`,
        ).toBeCloseTo(expected, 1)
      }
    }
  })
})

// --- the sim's parallel branch is unreachable in the app ----------------------

// `sim.ts`'s KNOWN MODEL LIMITATION block is bounded by a claim about callers:
// the circuit starts established ON the inbound course, so its parallel rejoin
// comes out TANGENT to the holding course and the inbound leg never converges.
// That is tolerable "because flyCircuit is only ever called with entry: 'direct'".
// Nothing asserted it. A future screen passing 'parallel' would render a ground
// track that never rejoins — negative training — with the suite green. This is
// the same runtime-only doc↔code coupling the repo already guards for the README
// table (dashboard.test.ts) and the drill ids, and the same `?raw` glob idiom.
const APP_MODULES: ReadonlyArray<{ file: string; source: string }> = Object.entries(
  import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).map(([path, source]) => ({ file: path.replace('./', 'src/'), source }))

/**
 * Text of the argument list of every `flyCircuit(...)` call in `source`, by
 * paren matching.
 *
 * Scoped to the CALL, not the file. The first version of this guard scanned the
 * whole module for `entry: '…'` literals, which fails two ways: an unrelated
 * `entry: 'parallel'` object elsewhere in a caller file fails it spuriously, and
 * — demonstrated by mutation — rewriting the call site to
 * `entry: (['direct','parallel'] as const)[1]` makes wind-lab genuinely fly a
 * parallel circuit with this test still green, because the file's OTHER
 * `entry: 'direct'` literals satisfied the loop. A guard that a refactor to a
 * non-literal walks straight through is not a bound.
 */
function flyCircuitCallArgs(source: string): string[] {
  const out: string[] = []
  const re = /\bflyCircuit\s*\(/g
  for (let m = re.exec(source); m !== null; m = re.exec(source)) {
    const start = m.index + m[0].length
    let depth = 1
    let i = start
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === '(') depth++
      else if (source[i] === ')') depth--
    }
    out.push(source.slice(start, i - 1))
  }
  return out
}

describe('the sim limitation stays inside the bound it documents', () => {
  const LIMITATION =
    `sim.ts's parallel rejoin is TANGENT to the course under this model's ` +
    `initial condition and never converges — see the KNOWN MODEL LIMITATION ` +
    `block in src/engine/sim.ts. Add an arrival heading to SimDecisions before ` +
    `shipping a non-direct entry.`

  it('no shipping module calls flyCircuit with an entry other than direct', () => {
    const callers = APP_MODULES.filter(
      (m) => !m.file.startsWith('src/engine/sim') && /\bflyCircuit\s*\(/.test(m.source),
    )
    expect(
      callers.length,
      'the glob found no flyCircuit callers at all — scan went vacuous',
    ).toBeGreaterThan(0)
    for (const { file, source } of callers) {
      const calls = flyCircuitCallArgs(source)
      expect(calls.length, `${file}: matched as a caller but no call args parsed`).toBeGreaterThan(0)
      for (const args of calls) {
        // Two accepted spellings, both checkable: an inline literal, or the
        // engine's own decision builder — whose entry is pinned at RUNTIME by
        // the test below, since it lives inside the excluded sim.ts.
        const inline = args.match(/entry:\s*'([a-z]+)'/)
        const viaBuilder = /\btextbookDecisions\s*\(/.test(args)
        expect(
          inline !== null || viaBuilder,
          `${file}: flyCircuit(${args.trim().slice(0, 60)}…) names its entry as ` +
            `neither an inline literal nor textbookDecisions(), so this guard ` +
            `cannot see which entry it flies. ${LIMITATION}`,
        ).toBe(true)
        if (inline) {
          expect(inline[1], `${file}: passes entry '${inline[1]}' to flyCircuit. ${LIMITATION}`).toBe(
            'direct',
          )
        }
      }
    }
  })

  // The other half of the bound: wind-lab's ghost track is
  // `flyCircuit(hold, textbookDecisions(hold, wind), wind)`, and that entry
  // literal lives in sim.ts — inside the module the scan above excludes. Text
  // alone therefore validated only one of wind-lab's two calls, incidentally.
  it('textbookDecisions builds a direct entry', () => {
    const d = textbookDecisions({ inboundCourse: 90, turnDirection: 'right' }, CALM)
    expect(d.entry, `textbookDecisions feeds flyCircuit unchecked by the scan. ${LIMITATION}`).toBe(
      'direct',
    )
  })
})

// --- the prose scan -----------------------------------------------------------

/** The corrected rule, in any of the wordings the content modules use. */
const CORRECT = /opposite|against the pattern|toward the holding side|crosses (back )?over/i

/**
 * The wrong rule, anchored on the GLOSS wording only.
 *
 * ⚠️ All three strings quote the AIM's own clause verbatim ("turn in the
 * direction of the holding pattern through more than 180°") and must keep
 * doing so — the app's citation convention rests on the primary-source wording.
 * A negative matching "in the direction of the holding pattern" would therefore
 * fail the CORRECT text. Match what the old gloss said instead.
 *
 * ⚠️ A bare "reintercepts right" is NOT wrong — it is the corrected rule for a
 * nonstandard hold. Only the pairing with a pattern of the same sense is wrong,
 * so the last two alternatives carry the pattern with them. A guard that fails
 * on correct prose gets weakened, and then it guards nothing.
 *
 * ⚠️ Those two alternatives gap on `[^.;,]*`, not `[^.]*`: the natural way to
 * write the mirrored rule states both senses in one sentence ("a right-turn hold
 * reintercepts left, and a left-turn hold reintercepts right"), and a gap that
 * crosses the comma pairs the first clause's pattern with the second clause's
 * direction and rejects it. Clause punctuation is the boundary, so the pairing
 * has to be within one clause to count. Pinned by `the negatives accept the
 * corrected rule` below.
 *
 * ⚠️ Same reason "follows the pattern" is anchored to the rejoin adjacently. The
 * corrected rule ends "only the final turn on reaching the fix follows the
 * pattern" — a bare alternative rejects that, and `[^.]*` does not help, since
 * the modules join the two clauses with a semicolon ("…both oppose the pattern;
 * only the turn on reaching the fix again follows…"). All three content modules
 * write "follows it" today, which is the guard steering prose rather than
 * checking it. Pinned by `the negatives accept the corrected rule` below.
 */
const WRONG =
  /same way the pattern|(?:rejoin|reintercepts?)(?: turn)? follows the pattern|only that direction|right-turn hold[^.;,]*reintercepts? right|left-turn hold[^.;,]*reintercepts? left/i

/**
 * Every content module, harvested rather than hand-listed.
 *
 * A hand-written list scans only what existed when the list was typed — the same
 * exhaustiveness hole CLAUDE.md describes for `TIERS` and `OVERLAY_ALPHA`, and
 * the reason `questions.ts` (which carries entry prose of its own) was outside
 * the original three. Sweeping the directory means a fourth module cannot ship
 * an unscanned rejoin gloss. Same eager `?raw` glob idiom as
 * src/ui/palette.test.ts.
 */
const CONTENT: ReadonlyArray<{ file: string; source: string }> = Object.entries(
  import.meta.glob<string>('./content/*.ts', { query: '?raw', import: 'default', eager: true }),
)
  .filter(([path]) => !path.endsWith('.test.ts'))
  .map(([path, source]) => ({ file: path.replace('./', 'src/'), source }))

/**
 * Source lines that make a claim about the parallel rejoin. Each content item is
 * a single-line string literal, so a line is the unit of prose here.
 *
 * Interrogatives are dropped: an Anki card front ("which side of the course do
 * you reintercept from?") names the topic without asserting anything about it,
 * so there is no rule in it to be right or wrong about.
 */
function parallelRejoinLines(source: string): string[] {
  return source
    .split('\n')
    .filter((l) => /parallel/i.test(l) && /reintercept|rejoin/i.test(l))
    .filter((l) => !/\?['"`],?\s*$/.test(l))
}

/**
 * The sentences within a line that actually claim something about the rejoin.
 *
 * ⚠️ CORRECT must be matched against THIS, not against the whole line. A content
 * line is a paragraph: `lessons.ts` and `oral.ts` describe the teardrop on the
 * same line, and the teardrop legitimately turns "toward the holding side" — a
 * CORRECT alternative. Line-scoped, the positive assertion is therefore vacuous
 * for two of the three modules: the pre-fix defective wording matches it (pinned
 * by `the positive rejects the pre-fix wording` below), leaving only the WRONG
 * blacklist doing any work, and a blacklist catches only wordings already known.
 * Same class as styles.test.ts's `is actually loaded` guard — scan the claim, not
 * the block it sits in.
 *
 * WRONG stays line-scoped: it is strictly safer to blacklist over more text.
 */
function rejoinClaim(line: string): string {
  return line
    .split(/(?<=[.;])\s+/)
    .filter((s) => /reintercept|rejoin/i.test(s))
    .join(' ')
}

/**
 * Content modules that state the parallel rejoin rule in prose today. Each must
 * keep at least one line the scan below can see; a module may be ADDED here, and
 * removing one is a deliberate act that says the prose is gone on purpose.
 */
const REJOIN_PROSE_CARRIERS = [
  'src/content/anki-deck.ts',
  'src/content/lessons.ts',
  'src/content/oral.ts',
] as const

describe('no content module teaches the rejoin the wrong way', () => {
  it('the scan finds prose to scan at all', () => {
    // A rename or a reflow that hides the prose from this scan would make the
    // suite pass by finding nothing, which is the failure mode the raw-text
    // idiom is most prone to (cf. styles.test.ts's `is actually loaded` test).
    // A module that says nothing about the parallel rejoin (questions.ts today)
    // is silent, not broken — so the guard is per KNOWN CARRIER, not per file.
    //
    // ⚠️ A single global total is NOT enough. `> 2` happens to bind today only
    // because the total is exactly 3 (one line each in the three carriers); as
    // soon as a fourth rejoin sentence lands anywhere, a carrier can stop
    // matching the selector and drop out of the scan with the suite green — the
    // same exhaustiveness hole this file's header argues against. Naming the
    // carriers makes a module going silent a failure rather than a subtraction.
    expect(CONTENT.length, 'no content modules were globbed').toBeGreaterThan(3)
    for (const file of REJOIN_PROSE_CARRIERS) {
      const module = CONTENT.find((c) => c.file === file)
      expect(module, `${file} carries rejoin prose but was not globbed`).toBeDefined()
      expect(
        parallelRejoinLines(module!.source).length,
        `${file} used to state the parallel rejoin rule and no longer does — either ` +
          `the prose was dropped or it was reworded past the scan's selector, which ` +
          `takes it out of the guard silently (${EVIDENCE})`,
      ).toBeGreaterThan(0)
    }
  })

  it('every parallel-rejoin sentence states the corrected rule', () => {
    for (const { file, source } of CONTENT) {
      for (const line of parallelRejoinLines(source)) {
        const claim = rejoinClaim(line)
        expect(claim, `${file}: no rejoin sentence to scan on a line that mentions one`).not.toBe('')
        expect(claim, `${file}: does not state the corrected rule (${EVIDENCE})`).toMatch(CORRECT)
        expect(line, `${file}: still glosses the rejoin as following the pattern (${EVIDENCE})`).not.toMatch(
          WRONG,
        )
      }
    }
  })

  it('the negatives cannot match the AIM clause the modules quote verbatim', () => {
    // Guards the guard: if WRONG ever grew to match the primary-source wording,
    // the only way to make this suite pass would be to delete the citation.
    const aim =
      'turn in the direction of the holding pattern through more than 180 degrees, and return to the holding fix'
    expect(aim).not.toMatch(WRONG)
  })

  it('the negatives accept the corrected rule, including its "follows the pattern" clause', () => {
    // Guards the guard, the third way: a blacklist that rejects CORRECT prose
    // gets weakened until it guards nothing. This is the settled rule as
    // CLAUDE.md states it, with the closing clause spelled out rather than
    // elided to "follows it" — the wording a bare alternative used to reject,
    // and the reason all three content modules currently avoid it.
    const corrected =
      'Parallel is the one entry whose first two turns — off the course outbound, then the rejoin — both oppose the pattern; only the final turn on reaching the fix follows the pattern.'
    expect(corrected, 'WRONG must not reject the corrected rule').not.toMatch(WRONG)
    // The mirrored rule, stated both ways in one sentence — the wording a
    // `[^.]*` gap rejects by pairing clause one's pattern with clause two's
    // direction. Both punctuations the modules actually use to join the halves.
    for (const mirrored of [
      'The rule mirrors: a right-turn hold reintercepts left, and a left-turn hold reintercepts right.',
      'In a left-turn hold you reintercept right; the right-turn hold reintercepts left.',
    ]) {
      expect(mirrored, 'WRONG must not reject the mirrored rule stated in one sentence').not.toMatch(WRONG)
    }
    // …while the gloss the alternative exists to catch still is caught.
    expect('the parallel rejoin follows the pattern, turning right in a standard hold').toMatch(WRONG)
    expect('the parallel reintercept turn follows the pattern').toMatch(WRONG)
    // …and the same-sense pairing the last two alternatives exist for, in both senses.
    expect('a right-turn hold reintercepts right').toMatch(WRONG)
    expect('in a left-turn hold the parallel reintercepts left').toMatch(WRONG)
  })

  it('the positive rejects the pre-fix wording, scoped but not line-scoped', () => {
    // Guards the guard, the other way round: a positive that the defect satisfies
    // certifies nothing. This is lessons.ts as it actually shipped before the
    // 2026-08-02 correction — one line carrying both the teardrop ("toward the
    // holding side", a CORRECT alternative) and the defective rejoin gloss.
    const preFix =
      'Teardrop (≈70° sector): at the fix turn to a heading 30° off the outbound course toward the holding side, fly about 1 minute, then turn to intercept inbound. The parallel reintercept catches people out: it turns the same way the pattern does (right in a standard hold), away from the course at first, because that is the only direction that makes the turn exceed 180°.'
    expect(preFix, 'the whole line matches CORRECT — which is exactly why it is not the unit').toMatch(
      CORRECT,
    )
    expect(rejoinClaim(preFix), 'CORRECT must reject the defective rejoin sentence').not.toMatch(CORRECT)
    expect(preFix, 'and WRONG must still catch it').toMatch(WRONG)
  })
})
