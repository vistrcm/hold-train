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
// suite. These two assertions make the rule single-sourced in assertion as well
// as in code: the map must agree with the engine, and the prose must agree with
// both. Lives at src/ (not src/engine/) because it imports across engine/, ui/
// and content/ — the same placement as styles.test.ts, contrast.test.ts and
// deploy.test.ts.

import { describe, expect, it } from 'vitest'
// The content modules are read as source text, not imported for their values:
// the claim under test is a sentence, and `?raw` is the idiom this repo already
// uses on styles.css (styles.test.ts) and README.md (dashboard.test.ts). The
// `.ts` extension is required — `vite/client`'s `*?raw` declaration is what
// makes these typecheck (see src/ui/palette.test.ts).
import ANKI_SOURCE from './content/anki-deck.ts?raw'
import LESSONS_SOURCE from './content/lessons.ts?raw'
import ORAL_SOURCE from './content/oral.ts?raw'
import { type HoldCourse, type TurnDirection, entryGuidance } from './engine/entry'
import { normalizeDeg } from './engine/geometry'
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
  // passing with the arc drawn the other way round. This compares the geometry
  // actually drawn against the oracle, which is the link whose absence let a
  // single-file flip go unnoticed.
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
 */
const WRONG = /same way the pattern|follows the pattern|only that direction|reintercepts right/i

const CONTENT: ReadonlyArray<{ file: string; source: string }> = [
  { file: 'src/content/lessons.ts', source: LESSONS_SOURCE },
  { file: 'src/content/oral.ts', source: ORAL_SOURCE },
  { file: 'src/content/anki-deck.ts', source: ANKI_SOURCE },
]

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

describe('no content module teaches the rejoin the wrong way', () => {
  it('every parallel-rejoin sentence states the corrected rule', () => {
    for (const { file, source } of CONTENT) {
      const lines = parallelRejoinLines(source)
      // A rename or a reflow that hides the prose from this scan would make the
      // suite pass by finding nothing, which is the failure mode the raw-text
      // idiom is most prone to (cf. styles.test.ts's `is actually loaded` test).
      expect(lines.length, `${file}: found no parallel-rejoin prose to scan`).toBeGreaterThan(0)
      for (const line of lines) {
        expect(line, `${file}: does not state the corrected rule (${EVIDENCE})`).toMatch(CORRECT)
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
})
