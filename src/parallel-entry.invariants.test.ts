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
// README carries the rejoin rule too — see `PROSE` below. Read as source text
// for the same reason the content modules are, and by the same idiom.
import README from '../README.md?raw'
// The content modules are read as source text, not imported for their values:
// the claim under test is a sentence, and `?raw` is the idiom this repo already
// uses on styles.css (styles.test.ts) and README.md (dashboard.test.ts). They
// are globbed rather than imported one by one — see `CONTENT` below.
import { PARALLEL_INTERCEPT_DEG, type HoldCourse, type TurnDirection, entryGuidance } from './engine/entry'
import { angleDiff, normalizeDeg } from './engine/geometry'
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
  /** Compass bearing of the chord from arc start to arc end, degrees. */
  chordBearingDeg: number
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
    // SVG y grows downward, so north is -y: compass bearing = atan2(Δx, -Δy).
    chordBearingDeg: normalizeDeg((Math.atan2(d[9]! - d[2]!, d[3]! - d[10]!) * 180) / Math.PI),
  }
}

describe('the map draws the rejoin the engine specifies', () => {
  // mapview.test.ts:214 checks the `data-turn-to-inbound` attribute, but that is
  // copied straight out of entryGuidance and so agrees vacuously — it would keep
  // passing with the arc drawn the other way round. This reads the sweep flag off
  // the rendered ARC, so it fails when what the map DRAWS disagrees with the
  // oracle (verified by substituting mapview's old private copy, which was
  // inverted).
  //
  // ⚠️ That is an AGREEMENT check, not a provenance check, and the distinction
  // matters when reading a failure: a private re-derivation in `mapview.ts` that
  // still computes the same sign passes here, and nothing in this file forbids
  // one. What the sweep catches is the moment such a copy DRIFTS — which is the
  // whole history it exists for, since the five-module inversion was a drift, not
  // the mere existence of a second copy. Claiming it fires on any private
  // derivation oversells it, and an oversold guard is one a later session trusts
  // in place of the assertion that would actually have caught the bug.
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
  // ⚠️ `chord/R` fixes θ only UP TO REFLECTION about 180°, because
  // `sin(θ/2) = sin(180° − θ/2)`: a 135° sweep has the identical chord as a 225°
  // one (2·sin 67.5° = 2·sin 112.5° = 1.8478). Mis-signing mapview's rollout to
  // `normalizeDeg(c − PARALLEL_INTERCEPT_DEG·rs)` sweeps 135°, and left this
  // whole FILE green (18/18, mutation-run 2026-08-03) — it keeps the sweep flag,
  // and its rollout still lands on the holding side, so A2 passes too. One
  // hand-computed golden pair in mapview.test.ts was the only thing that failed,
  // i.e. one course × pattern out of the twenty this sweep exists to cover.
  // The test BELOW closes that: chord LENGTH is unsigned, chord BEARING is not.
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

  // The signed half of the angle check. A chord subtends its arc symmetrically,
  // so the chord from a turn that starts on heading `h0` and sweeps θ in
  // direction `rs` runs at `h0 + rs·θ/2` — no reflection ambiguity, and still
  // read from the same two endpoints, so no second copy of mapview's geometry.
  //
  // ⚠️ What this does and does not own. `rs` is read from the ORACLE, so an
  // engine flip moves expectation and drawing together and this passes — A2,
  // anchored on `hold.turnDirection`, is what fails then. This owns the case A2
  // and `chord/R` are jointly blind to: the map drawing a DIFFERENT angle, in
  // the engine's own direction. Correct = h0 + 112.5·rs; the mis-signed rollout
  // above = h0 + 67.5·rs (45° out); a literal 30 = h0 + 105·rs (7.5° out).
  //
  // 1° tolerance is a floor set by the drawing, like the 2 decimals above: 0.1 px
  // of endpoint rounding across a ~25 px chord is ~0.3° of bearing noise. The
  // smallest defect it must catch is 7.5×.
  it('the drawn arc turns the oracle’s way, by 180° + the engine intercept angle', () => {
    for (const turnDirection of PATTERNS) {
      for (const inboundCourse of COURSES) {
        const hold: HoldCourse = { inboundCourse, turnDirection }
        const g = entryGuidance('parallel', hold)
        const rs = g.turnToInbound === 'right' ? 1 : -1
        const drawn = drawParallel(hold)
        const expected = normalizeDeg(g.outboundHeading + (rs * (180 + PARALLEL_INTERCEPT_DEG)) / 2)
        expect(
          Math.abs(angleDiff(expected, drawn.chordBearingDeg)),
          `${inboundCourse}°/${turnDirection}: a ${180 + PARALLEL_INTERCEPT_DEG}° rejoin ` +
            `from outbound ${g.outboundHeading}° turning ${g.turnToInbound} puts the arc's ` +
            `chord on ${expected.toFixed(1)}°; map drew ` +
            `${drawn.chordBearingDeg.toFixed(1)}° (${EVIDENCE})`,
        ).toBeLessThan(1)
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
  // come from `entryGuidance`, and this sweep is what keeps them AGREEING: it
  // goes red the moment the rejoin sim.ts actually FLIES disagrees with the
  // oracle.
  //
  // ⚠️ Agreement, not provenance — same caveat as the map's sweep-flag test. A
  // private re-derivation inside sim.ts that still produces the same sign passes
  // this, and no assertion in this file reads sim.ts's source to ban one. The
  // guard is against drift, which is the failure that actually shipped; do not
  // read a green run here as proof the geometry is single-sourced in CODE. That
  // property is maintained by review, and the assertions are what make it
  // survivable when it lapses.
  //
  // What it CANNOT catch is a flip of the ENGINE. sim.ts derives its turnSign
  // from `turnToInbound` and the expectation below re-reads that same field, so
  // an inverted engine inverts both and this test stays green — the identical
  // by-construction hole the map's sweep-flag test carries, and the reason the
  // map half also has A2, anchored on the pattern. The sim's A2 is the test
  // after this one. (This comment used to dispose of that objection by claiming
  // "every parallel assertion in sim.test.ts is a hardcoded golden excursion
  // that pins the sim against itself". It is not: those goldens are anchored on
  // RIGHT_NORTH / LEFT_NORTH and a written-out side, so they DO fail on an
  // engine flip — just at two courses rather than every one. Overselling this
  // sweep while writing off the assertions that actually close the hole is how
  // the closing assertion gets deleted as redundant.)
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

  // A2 for the sim, and the only assertion in this describe that survives an
  // inverted engine: the settled rule is WRITTEN OUT against `hold.turnDirection`
  // rather than read from the field under test. A right-hand pattern turns right,
  // so its rejoin turns LEFT — counter-clockwise, positive under the sign
  // convention of `trackRotationRad`. Flip `entry.ts`'s parallel branch back and
  // sim.ts follows it (it reads the oracle), so the test above follows too and
  // stays green; this one goes red at every course × pattern combination it
  // sweeps (COURSES × PATTERNS — 20 as written, but read the arrays, not this).
  //
  // Deliberately a sign check, and that is the whole job — magnitude is pinned by
  // the intercept-angle test below, and the ">180°" bound by the sweep above.
  it('A2: the flown rejoin opposes the pattern, anchored on turnDirection', () => {
    for (const turnDirection of PATTERNS) {
      for (const inboundCourse of COURSES) {
        const hold: HoldCourse = { inboundCourse, turnDirection }
        const r = flyCircuit(
          hold,
          {
            entry: 'parallel',
            // Not a back door to the oracle: `outboundHeading` for a parallel is
            // the reciprocal of the inbound course (`entry.ts:192`), independent
            // of pattern and of turnToInbound, so an inverted engine does not
            // move it.
            outboundHeading: entryGuidance('parallel', hold).outboundHeading,
            inboundCrab: 0,
            outboundSeconds: LEG_SECONDS,
          },
          CALM,
        )
        const rejoin = trackRotationRad(r.track, REJOIN_START_SAMPLE, REJOIN_END_SAMPLE)
        const expected = turnDirection === 'right' ? 1 : -1
        expect(
          Math.sign(rejoin),
          `${inboundCourse}°/${turnDirection}: a ${turnDirection}-hand pattern's parallel ` +
            `rejoin turns ${turnDirection === 'right' ? 'left' : 'right'}, so the flown ` +
            `rotation must be ${expected > 0 ? 'counter-clockwise' : 'clockwise'}; sim flew ` +
            `${((rejoin * 180) / Math.PI).toFixed(1)}° (${EVIDENCE})`,
        ).toBe(expected)
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
// Every `.ts` under src/, harvested ONCE and viewed two ways: the flyCircuit
// bound below wants shipping modules only (a test may legitimately fly a
// parallel circuit — sim.test.ts does), while the ICAO citation guard at the
// end of this file wants every file carrying the citation, tests included.
// One glob with two filters rather than two globs: a second glob is a second
// copy of "what counts as a source file", and the halves drift. Vite excludes
// the importing module from its own glob, so this file never scans itself —
// which is what keeps its own ¶2.2.4 mentions out of ICAO_MISCITED.
const SOURCES: ReadonlyArray<{ file: string; source: string }> = Object.entries(
  import.meta.glob<string>('./**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).map(([path, source]) => ({ file: path.replace('./', 'src/'), source }))

const APP_MODULES: ReadonlyArray<{ file: string; source: string }> = SOURCES.filter(
  (m) => !m.file.endsWith('.test.ts'),
)

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
 *
 * ⚠️ Counts raw parens; it does not lex strings, template literals, regexes or
 * comments. A `)` inside a string in the argument list would mis-slice the call.
 * That is tolerated rather than fixed (a lexer here would be more machinery than
 * the bound is worth), but it is NOT allowed to fail silently: an unbalanced
 * scan throws below instead of returning a truncated slice that the entry check
 * would then read as clean.
 */
function flyCircuitCallArgs(source: string, file: string): string[] {
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
    if (depth !== 0) {
      throw new Error(
        `${file}: unbalanced parens after the flyCircuit( at index ${m.index}, so this ` +
          `guard cannot bound that call. Fixing the paren scan is the fix; a silent ` +
          `truncation here reads as coverage.`,
      )
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
      // Exact path, not `startsWith`: the exemption is for the module that
      // DEFINES flyCircuit, and a prefix would silently extend it to any future
      // `src/engine/sim*.ts` — an exemption that grows on its own is how a
      // guard stops covering the thing it names.
      (m) => m.file !== 'src/engine/sim.ts' && /\bflyCircuit\s*\(/.test(m.source),
    )
    expect(
      callers.length,
      'the glob found no flyCircuit callers at all — scan went vacuous',
    ).toBeGreaterThan(0)
    for (const { file, source } of callers) {
      const calls = flyCircuitCallArgs(source, file)
      expect(calls.length, `${file}: matched as a caller but no call args parsed`).toBeGreaterThan(0)
      for (const args of calls) {
        // Two accepted spellings, both checkable: an inline literal, or the
        // engine's own decision builder — whose entry is pinned at RUNTIME by
        // the test below, since it lives inside the excluded sim.ts.
        //
        // ⚠️ EVERY `entry:` in the call is checked, and textbookDecisions() does
        // NOT excuse one. The previous version read only the FIRST match and
        // short-circuited on `viaBuilder`, so
        // `{ ...textbookDecisions(h, w), entry: (['direct','parallel'] as const)[1] }`
        // left this file green at 18/18 while wind-lab genuinely flew a parallel
        // circuit (mutation-run 2026-08-03) — the exact escape the docblock above
        // claims to have closed, reopened one level in. A spread is a DEFAULT,
        // and the key written after it wins; a guard that stops reading at the
        // builder cannot see the override that follows it.
        const entries = [...args.matchAll(/\bentry:\s*(?:'([a-z]+)')?/g)]
        for (const e of entries) {
          expect(
            e[1],
            `${file}: flyCircuit(…) names its entry with a non-literal expression ` +
              `(${args.slice(e.index, e.index + 40).trim()}…), so this guard cannot see ` +
              `which entry it flies. ${LIMITATION}`,
          ).toBeDefined()
          expect(e[1], `${file}: passes entry '${e[1]}' to flyCircuit. ${LIMITATION}`).toBe('direct')
        }
        expect(
          entries.length > 0 || /\btextbookDecisions\s*\(/.test(args),
          `${file}: flyCircuit(${args.trim().slice(0, 60)}…) names no entry at all and ` +
            `does not go through textbookDecisions(), so this guard cannot see which ` +
            `entry it flies. ${LIMITATION}`,
        ).toBe(true)
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

/**
 * The corrected rule, in any of the wordings the modules use.
 *
 * ⚠️ A whitelist narrower than the set of CORRECT phrasings fails on correct
 * prose, and a guard that fails on correct prose gets weakened until it guards
 * nothing — the WRONG docblock's warning, from the other side. Widening the scan
 * past `src/content/` found two such gaps immediately, both in the engine's
 * evidence docblock and both quoting the sources this repo calls decisive: the
 * pattern-relative sense written as "against IT" rather than "against the
 * pattern", and ICAO's "turned left ONTO the holding side" rather than "toward"
 * it. Neither can appear in a gloss of the wrong rule, and WRONG scans the whole
 * unit regardless, so admitting them costs no strength.
 */
const CORRECT =
  /opposite|against (the pattern|it)|(toward|onto) the holding side|crosses (back )?over/i

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
 * The content modules — a filter over the single `SOURCES` harvest, not a
 * second glob, for the reason `SOURCES` states: two globs are two copies of
 * "what counts as a source file" and the halves drift.
 *
 * Used only by the per-carrier non-vacuity check below. The rule scan itself
 * runs over `PROSE`, which is wider — see there.
 */
const CONTENT: ReadonlyArray<{ file: string; source: string }> = APP_MODULES.filter((m) =>
  m.file.startsWith('src/content/'),
)

/**
 * Every prose carrier of the rejoin rule: every shipping module, plus README.
 *
 * ⚠️ This scope is deliberately WIDER than `src/content/`, and twice now it was
 * not wide enough. A directory glob is exhaustive only over the directory it
 * globs — the hole this file's header argues against, and one it kept falling
 * into one level up each time:
 *
 *   1. `src/content/*.ts` alone missed README, which states the rule at more
 *      length than any content item does ("turns *against* the pattern — back
 *      across the holding course onto the holding side") and is the first thing
 *      a reader meets.
 *   2. content + README still missed `src/modules/`, where the prose a STUDENT
 *      actually reads is generated: `flyItText` (src/modules/entry-drill.ts)
 *      renders the rejoin direction into the drill feedback panel on every
 *      parallel scenario. Mutation-confirmed: a wrong gloss added to that panel
 *      passed the whole suite while the identical sentence in `questions.ts`
 *      failed it. The screens are where the rule is taught; scanning only the
 *      banks guarded the quieter half.
 *
 * So it is now every non-test module under `src/`. Engine and UI files carry the
 * rule in comments rather than rendered strings, and including them costs
 * nothing — they must state it correctly too, and CLAUDE.md is explicit that a
 * comment asserting the wrong rule is worse than no comment, because it argues
 * the next session into inverting the code.
 *
 * README is already an asserted artifact here (dashboard.test.ts diffs its route
 * table, anki-export.test.ts its import steps), so `?raw` is the established
 * idiom rather than a new coupling.
 */
const PROSE: ReadonlyArray<{ file: string; source: string }> = [
  ...APP_MODULES,
  { file: 'README.md', source: README },
]

/**
 * Prose with markdown emphasis markers removed.
 *
 * ⚠️ Both regexes below match CONTIGUOUS phrases, and README writes the rule as
 * "turns *against* the pattern" — so the raw text contains "against* the
 * pattern" and CORRECT does not match it. That cuts both ways and the second way
 * is the dangerous one: a blacklist that cannot see through emphasis is WEAKER
 * on markdown than on TS, so "the rejoin *follows the pattern*" would ship
 * unflagged. Normalising before matching keeps the two carriers' formats from
 * changing what the guard can see. Pinned by `emphasis cannot hide a wrong
 * gloss` below.
 */
function unemphasize(s: string): string {
  return s.replace(/\*+/g, '')
}

/**
 * Does this sentence ASSERT the rejoin RULE, or merely mention the maneuver?
 *
 * Three kinds of mention carry no rule to be right or wrong about:
 *   - Interrogatives. An Anki card front ("which side of the course do you
 *     reintercept from?") states the topic and nothing else.
 *   - References to the dated correction rather than to the maneuver. README's
 *     re-import step says "the 2026-08-02 parallel-entry rejoin fix changed a
 *     core card"; demanding it restate the rule would be absurd prose, and
 *     demanding prose be absurd is how a guard gets weakened until it guards
 *     nothing. Anchored on an ISO date next to fix/correction, because no
 *     sentence about the maneuver carries one — "rejoin fix" alone would collide
 *     with the holding fix the aircraft actually rejoins.
 *   - Sentences about the rejoin's MAGNITUDE, not its direction. This guard
 *     checks one fact — which way the turn rotates — and `PARALLEL_INTERCEPT_DEG`'s
 *     own docblock ("Angle the parallel entry's rejoin turn rolls out on,
 *     measured from the inbound holding course…") is about the intercept angle,
 *     a separate and explicitly CONVENTIONAL quantity. Requiring it to restate
 *     the direction is the absurd-prose failure one line up. Detected by the
 *     absence of any DIRECTION word, which is safe because a sentence cannot
 *     state the rule WRONGLY without naming a direction — pinned by `the
 *     direction-free exemption cannot swallow a wrong gloss` below, which runs
 *     every known wrong wording through this predicate.
 *
 * ⚠️ Shared by the line selector AND the claim extractor below, so the two
 * cannot disagree about what counts. When they disagreed, a line could select in
 * and then extract to nothing — which is what the deleted `not.toBe('')`
 * assertion was compensating for.
 */
// ⚠️ A direction VALUE, not the word "direction" — and not a bare "toward",
// which `PARALLEL_INTERCEPT_DEG`'s docblock uses to say which way an ANGLE is
// measured ("measured from the inbound holding course toward the rejoin turn's
// direction"). Those two leaked the exemption open on the first attempt. Every
// wording WRONG knows names a value; that equivalence is what makes the
// exemption safe, and it is asserted, not assumed, below.
const DIRECTIONAL =
  /\bleft\b|\bright\b|opposite|against|same way|follows|holding side|clockwise|crosses|racetrack|direction of the holding/i

function isRejoinAssertion(s: string): boolean {
  if (!/reintercept|rejoin/i.test(s)) return false
  if (!DIRECTIONAL.test(s)) return false
  if (/\?['"`]?,?\s*$/.test(s.trim())) return false
  if (/\d{4}-\d{2}-\d{2}[^.;]*\b(fix|correction)\b/i.test(s)) return false
  return true
}

/**
 * A source split into units of prose, with comment blocks unwrapped.
 *
 * ⚠️ A raw line is NOT a unit of prose in every carrier, and assuming it was is
 * what made widening this scan past `src/content/` fail twice on correct text.
 * Content items are single-line string literals and a README paragraph is one
 * line, so there a line IS a sentence. Comments wrap at 80 columns mid-sentence,
 * so there a line is a FRAGMENT — and a fragment can lose the very words that
 * make it correct. Both false positives were of exactly that shape: `entry.ts`
 * says "the parallel rejoin counter-clockwise (against it) — same words, two
 * readings", and the line break lands between "parallel" and the "opposite"
 * CORRECT needs, leaving a fragment that names the maneuver and states nothing.
 *
 * Contiguous comment lines are therefore joined into one unit, which is both
 * more accurate and strictly safer: WRONG is blacklisted over the whole block
 * (more text, per the note on `rejoinClaim`), while CORRECT still narrows to the
 * sentence via `rejoinClaim`. Rewrapping a comment cannot change what the guard
 * sees — the property the emphasis normaliser exists to give the other carriers.
 */
function proseUnits(source: string): string[] {
  const units: string[] = []
  let block: string[] | null = null
  for (const raw of source.split('\n')) {
    const trimmed = raw.trim()
    if (/^(\/\/|\/\*|\*)/.test(trimmed)) {
      block ??= []
      block.push(trimmed.replace(/^\/\*+|^\/\/+|^\*+\/?|\*\/$/g, '').trim())
      continue
    }
    if (block !== null) {
      units.push(block.join(' '))
      block = null
    }
    units.push(raw)
  }
  if (block !== null) {
    units.push(block.join(' '))
  }
  return units
}

/** Units of prose that make a claim about the parallel rejoin. */
function parallelRejoinLines(source: string): string[] {
  return proseUnits(source).filter(
    (l) => /parallel/i.test(l) && sentences(l).some(isRejoinAssertion),
  )
}

/** A line split into sentences. Content prose joins clauses with `;` as well. */
function sentences(line: string): string[] {
  return line.split(/(?<=[.;])\s+/)
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
  return sentences(line).filter(isRejoinAssertion).join(' ')
}

/**
 * Files that state the parallel rejoin rule in prose today. Each must keep at
 * least one line the scan below can see; a file may be ADDED here, and removing
 * one is a deliberate act that says the prose is gone on purpose.
 */
const REJOIN_PROSE_CARRIERS = [
  'src/content/anki-deck.ts',
  'src/content/lessons.ts',
  'src/content/oral.ts',
  'README.md',
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
      const module = PROSE.find((c) => c.file === file)
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
    for (const { file, source } of PROSE) {
      for (const line of parallelRejoinLines(source)) {
        // No `claim !== ''` assertion: the selector and the extractor now share
        // `isRejoinAssertion`, so a selected line has at least one claim
        // sentence BY CONSTRUCTION. An assertion that cannot fail is not
        // documentation, it is fake coverage (CLAUDE.md) — the comment is the
        // part worth keeping.
        //
        // ⚠️ CORRECT is matched against the JOINED claim, deliberately, and
        // tightening it to per-sentence was tried and reverted. Prose that
        // ARGUES the rule rather than stating it once — the evidence docblocks,
        // and lessons.ts — spreads it over several sentences, of which the
        // supporting ones ("the same figure draws the teardrop rejoin clockwise
        // and the parallel rejoin counter-clockwise") are individually true and
        // individually match nothing. Per-sentence therefore demands CORRECT
        // enumerate every valid phrasing, which is unbounded, and each failure
        // is answered by widening the whitelist until it accepts anything. The
        // real detector here is WRONG, which scans the whole unit below; CORRECT
        // asks the narrower question of whether the unit says the rule AT ALL.
        const claim = unemphasize(rejoinClaim(line))
        expect(claim, `${file}: does not state the corrected rule (${EVIDENCE})`).toMatch(CORRECT)
        expect(
          unemphasize(line),
          `${file}: still glosses the rejoin as following the pattern (${EVIDENCE})`,
        ).not.toMatch(WRONG)
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

  it('emphasis cannot hide a wrong gloss, or a right one', () => {
    // Guards the guard, the markdown way. README is the one carrier written in
    // markdown, and both regexes match contiguous phrases, so without
    // normalisation an emphasised gloss is invisible to WRONG — the scan would
    // be strictly weaker on the file a reader meets first. Both directions are
    // asserted: dropping `unemphasize` fails the first pair, and a version that
    // ate the surrounding words rather than the markers fails the second.
    const emphasised = 'The parallel rejoin *follows the pattern*, turning right in a standard hold.'
    expect(emphasised, 'raw markdown hides the gloss from WRONG — this is the hole').not.toMatch(WRONG)
    expect(unemphasize(emphasised), 'WRONG must catch the same gloss once normalised').toMatch(WRONG)
    // ⚠️ One CORRECT phrase only, and emphasis must split it. The fixture used
    // to close with ", onto the holding side", which CORRECT later grew to
    // accept — a second, unemphasised match made the raw string pass CORRECT and
    // the demonstration collapsed. A fixture that can be satisfied by a clause
    // other than the one under test stops testing that clause.
    const correct = 'The parallel reintercept turns *against* the pattern.'
    expect(correct, 'raw markdown hides the corrected rule from CORRECT too').not.toMatch(CORRECT)
    expect(unemphasize(correct), 'CORRECT must accept the corrected rule once normalised').toMatch(CORRECT)
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

  it('the direction-free exemption cannot swallow a wrong gloss', () => {
    // Guards the guard, the fourth way. `isRejoinAssertion` now skips sentences
    // that name the rejoin without naming a DIRECTION, so that
    // PARALLEL_INTERCEPT_DEG's docblock — which is about the intercept ANGLE, an
    // avowedly conventional quantity — is not required to restate the rotation
    // rule. That exemption is only safe if no WRONG wording can hide inside it:
    // a sentence cannot state this rule incorrectly without naming a direction.
    // Assert it over every wording WRONG knows rather than trusting the argument.
    const wrongGlosses = [
      'The parallel rejoin turns the same way the pattern does.',
      'On a parallel entry the reintercept turn follows the pattern.',
      'A right-turn hold reintercepts right on the parallel entry.',
      'A left-turn hold reintercepts left when parallel.',
      'The parallel rejoin turns right because only that direction exceeds 180°.',
    ]
    for (const gloss of wrongGlosses) {
      expect(gloss, `WRONG no longer catches: ${gloss}`).toMatch(WRONG)
      expect(
        isRejoinAssertion(gloss),
        `the direction-free exemption lets this wrong gloss through unscanned: ${gloss}`,
      ).toBe(true)
    }
    // And the sentence the exemption exists for is genuinely direction-free.
    expect(
      isRejoinAssertion(
        "Angle the parallel entry's rejoin turn rolls out on, measured from the inbound",
      ),
    ).toBe(false)
  })
})

// --- the ICAO citation --------------------------------------------------------

/**
 * The verified location of the ICAO text, and the one it was mis-cited as.
 *
 * Doc 8168 is quoted in three places under src/ as the textual half of the "do
 * not re-derive this" apparatus. Until 2026-08-02 all three cited "Vol I, Part II,
 * §6, Ch.2 (Sixth Edition 2018), ¶2.2.4/¶2.2.5" and quoted the rejoin as "turned
 * TOWARD the holding side". Every part of that was wrong: the real text is
 * Vol I, Part I, §6, Ch.1 ¶1.4.4/¶1.4.5 (5th ed. 2006), mirrored in Vol II,
 * Part II, §4, Ch.1 ¶1.2.1.2/¶1.2.1.3 (6th ed. 2014); the cited chapter covers
 * RNAV holding *construction*, is numbered ¶2.1–¶2.7 and has no ¶2.2.4; and ICAO
 * writes "turned LEFT onto the holding side" — rotational, not spatial. The
 * misquote had been copied into four other artifacts from a single unverified
 * source block, which is why this is worth pinning rather than trusting review.
 *
 * ⚠️ Anchored on the paragraph NUMBERS, not the wording. "toward the holding
 * side" is a legitimate description of the *teardrop* and a CORRECT alternative
 * above, so banning the phrase would fail correct prose — the same trap the
 * WRONG regex documents. Paragraph numbers carry no such double meaning.
 *
 * ⚠️ Scoped to the file, not the sentence, and that is sound only because
 * `2.2.4` appears nowhere in src for any other reason. Docs are deliberately NOT
 * scanned: three of them now quote the wrong numbers verbatim inside superseded
 * notes explaining the error, and a guard satisfiable only by deleting the
 * correction record is the failure mode this suite already warns about.
 *
 * ⚠️ Harvested from SOURCES, not APP_MODULES: the third copy — the longest and
 * most detailed of them — is the golden-test docblock in
 * `src/engine/entry.test.ts`, and APP_MODULES excludes `*.test.ts`. Scanning two
 * of three while the paragraph above said "three" is this file's own stated hole
 * ("guarding two of the three leaves the third free to go stale with the suite
 * green"), reopened one glob down. The exhaustiveness list below is what makes
 * the count a claim the suite checks rather than a sentence in a comment.
 */
const ICAO_VERIFIED = /1\.4\.4|1\.2\.1\.2/
const ICAO_MISCITED = /2\.2\.[45]/

describe('the ICAO 8168 citation', () => {
  const citing = SOURCES.filter((m) => m.source.includes('8168'))

  it('is carried by every file the docblock says carries it', () => {
    // Exhaustiveness: a filter that silently matches nothing passes the two
    // assertions below vacuously, which is how a renamed comment would retire
    // this guard without failing it. Pinned to the exact set so a NEW citation
    // lands here as a failure naming the file, rather than going unscanned.
    expect(citing.map((m) => m.file).sort()).toEqual([
      'src/engine/entry.test.ts',
      'src/engine/entry.ts',
      'src/engine/sim.ts',
    ])
  })

  for (const { file, source } of citing) {
    it(`${file} cites the verified paragraph and not the mis-cited one`, () => {
      expect(
        source,
        `${file} cites ICAO Doc 8168 without the verified paragraph. The rejoin text is ` +
          `Vol I Pt I §6 Ch 1 ¶1.4.4(b) (or Vol II Pt II §4 Ch 1 ¶1.2.1.2(b)). ` +
          `See docs/parallel-entry-evidence.md.`,
      ).toMatch(ICAO_VERIFIED)
      expect(
        source,
        `${file} cites ICAO Doc 8168 ¶2.2.4/¶2.2.5. That paragraph does not exist: ` +
          `Vol I Pt II §6 Ch 2 is RNAV holding construction, numbered ¶2.1–¶2.7. ` +
          `See docs/parallel-entry-evidence.md.`,
      ).not.toMatch(ICAO_MISCITED)
    })
  }
})
