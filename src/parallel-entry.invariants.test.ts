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
import { type HoldCourse, type TurnDirection, entryGuidance } from './engine/entry'
import { normalizeDeg } from './engine/geometry'
import { flyCircuit } from './engine/sim'
import { renderMap } from './ui/mapview'

const EVIDENCE = 'see docs/parallel-entry-evidence.md — do not re-derive from the AIM sentence'

const COURSES = [0, 45, 90, 135, 180, 225, 270, 315] as const
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
}

/**
 * Render the parallel entry path and read back the two facts that encode the
 * rejoin's direction. `d` = `M fix L legEnd A rr rr 0 1 sweep rollout L fix`,
 * so nums indices are 7 = large-arc, 8 = sweep flag, 9,10 = rollout point.
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
})

// --- the sim ↔ engine agreement sweep ----------------------------------------

const CALM = { directionFrom: 0, speedKt: 0 }
const LEG_SECONDS = 60

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
  // copy of the intercept angle that had already drifted to 30°. Both now come
  // from `entryGuidance`, and this sweep is what keeps them there: without it a
  // future flip of the engine's parallel rule leaves the sim stale and green,
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
        // 180° onto outbound at 3°/s = 60 s, then the 60 s leg, then the 225°
        // rejoin = 75 s; the track is sampled at 1 s from the fix, so the rejoin
        // is samples 60+60 … 195.
        const rejoin = trackRotationRad(r.track, 120, 195)
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
 */
const WRONG =
  /same way the pattern|follows the pattern|only that direction|right-turn hold[^.]*reintercepts? right|left-turn hold[^.]*reintercepts? left/i

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

describe('no content module teaches the rejoin the wrong way', () => {
  it('the scan finds prose to scan at all', () => {
    // A rename or a reflow that hides the prose from this scan would make the
    // suite pass by finding nothing, which is the failure mode the raw-text
    // idiom is most prone to (cf. styles.test.ts's `is actually loaded` test).
    // Counted across all modules, not per file: a module that says nothing about
    // the parallel rejoin (questions.ts today) is silent, not broken.
    expect(CONTENT.length, 'no content modules were globbed').toBeGreaterThan(3)
    const total = CONTENT.reduce((n, c) => n + parallelRejoinLines(c.source).length, 0)
    expect(total, 'found no parallel-rejoin prose to scan in any content module').toBeGreaterThan(2)
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
