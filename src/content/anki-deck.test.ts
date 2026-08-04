// Content-validation tests for the fixed Anki core deck. Cards are authored
// from the ROTE/TRAP/SAFETY call-outs (docs/research-claude.md §Anki), each
// verified against its FAA primary source; the tests below lock structure and
// the presence of the key verified facts.

import { describe, expect, it } from 'vitest'
import { ACS_ELEMENTS } from './oral'
import { CORE_DECK, type AnkiCard } from './anki-deck'

const GROUPS = ['rote', 'trap', 'safety'] as const
const ACS_CODES = new Set(ACS_ELEMENTS.map((e) => e.code))

function cardsTagged(tag: string): AnkiCard[] {
  return CORE_DECK.filter((c) => c.tags.includes(tag))
}

describe('CORE_DECK structure', () => {
  it('has a substantial deck', () => {
    expect(CORE_DECK.length).toBeGreaterThanOrEqual(20)
  })

  it('every card has non-empty front, back, and FAA source', () => {
    for (const card of CORE_DECK) {
      expect(card.front.trim()).not.toBe('')
      expect(card.back.trim()).not.toBe('')
      expect(card.source.trim()).not.toBe('')
    }
  })

  it('every card carries exactly one topic-group tag (rote/trap/safety)', () => {
    for (const card of CORE_DECK) {
      const groups = card.tags.filter((t) => (GROUPS as readonly string[]).includes(t))
      expect(groups, card.front).toHaveLength(1)
    }
  })

  it('every card carries at least one valid ACS Task III.B element tag', () => {
    for (const card of CORE_DECK) {
      const acs = card.tags.filter((t) => t.startsWith('IR.III.B.'))
      expect(acs.length, card.front).toBeGreaterThanOrEqual(1)
      for (const code of acs) {
        expect(ACS_CODES.has(code), `${card.front}: unknown ACS code ${code}`).toBe(true)
      }
    }
  })

  it('tags never contain whitespace (Anki splits tags on spaces)', () => {
    for (const card of CORE_DECK) {
      for (const tag of card.tags) {
        expect(tag).not.toMatch(/\s/)
      }
    }
  })

  it('card fronts are unique', () => {
    const fronts = CORE_DECK.map((c) => c.front)
    expect(new Set(fronts).size).toBe(fronts.length)
  })

  it('covers all three call-out groups', () => {
    for (const group of GROUPS) {
      expect(cardsTagged(group).length, group).toBeGreaterThan(0)
    }
  })
})

describe('CORE_DECK key facts (verified against FAA sources)', () => {
  function backMatching(re: RegExp): AnkiCard | undefined {
    return CORE_DECK.find((c) => re.test(c.back))
  }

  it('max holding speeds 200/230/265', () => {
    const card = backMatching(/200[\s\S]*230[\s\S]*265/)
    expect(card).toBeDefined()
    expect(card?.source).toContain('AIM 5-3-8')
  })

  it('inbound timing: 1 minute at or below 14,000, 1½ above', () => {
    const card = backMatching(/1½ minutes[\s\S]*above 14,000/i)
    expect(card).toBeDefined()
  })

  it('entry sectors 180/70/110 with the 70° line on the holding side', () => {
    expect(backMatching(/180°[\s\S]*70°[\s\S]*110°/)).toBeDefined()
  })

  // A bare /30°/ also matches the bank-angle card ("or 30° bank"), so the
  // teardrop fact could be dropped entirely with this test still green. Pin the
  // offset to its context: outbound, on the holding side.
  it('teardrop offset 30° from the outbound course, on the holding side', () => {
    const card = backMatching(/offset 30°[\s\S]*outbound course[\s\S]*holding side/i)
    expect(card).toBeDefined()
    expect(card?.source).toContain('AIM 5-3-8')
  })

  it('triple drift outbound, with the double-drift field-technique caveat', () => {
    const card = backMatching(/triple/i)
    expect(card).toBeDefined()
    expect(card?.back).toMatch(/double/i)
  })

  it('±5° entry tolerance', () => {
    expect(backMatching(/±5°/)).toBeDefined()
  })

  it('standard-turns trap: silence means right turns', () => {
    const card = backMatching(/right turns/i)
    expect(card).toBeDefined()
    expect(cardsTagged('trap')).toContain(card)
  })

  it('ACS tolerances ±10 kt / ±100 ft / ±10° / ¾-scale CDI', () => {
    const card = backMatching(/±10 k[\s\S]*±100 f[\s\S]*±10°[\s\S]*¾/)
    expect(card).toBeDefined()
    expect(card?.source).toContain('ACS')
  })

  it('EFC / fuel safety card cites Avianca 052', () => {
    const card = CORE_DECK.find((c) => c.source.includes('Avianca'))
    expect(card).toBeDefined()
    expect(cardsTagged('safety')).toContain(card)
  })

  it('RNAV bank-limiter: minimum 25° unless not selectable; advise ATC', () => {
    const card = backMatching(/25°[\s\S]*advise ATC/i)
    expect(card).toBeDefined()
  })

  it('RNAV entry chosen from ground track, not heading', () => {
    expect(backMatching(/ground track/i)).toBeDefined()
  })

  it('bank-limiter card includes all three AIM j8(b)(4) exceptions', () => {
    const card = backMatching(/25°[\s\S]*advise ATC/i)
    expect(card?.back).toMatch(/maneuvering speed/)
    expect(card?.source).toContain('j8(b)(4)')
  })

  it('±5° card uses the AIM j8(d) heading-tolerance framing', () => {
    const card = backMatching(/±5°|5° of a boundary/)
    expect(card?.back).toMatch(/good operating limits/)
    expect(card?.source).toContain('j8(d)')
  })

  it('5-minute advance-notice card cites both AIM 5-3-8 e and JO 7110.65 4-6-1', () => {
    const card = backMatching(/5 minutes before/)
    expect(card?.source).toContain('AIM 5-3-8 e')
    expect(card?.source).toContain('4-6-1')
  })

  // This card ships into the user's Anki deck, so a wrong gloss is drilled to
  // memory. The rejoin turns AGAINST the pattern — docs/parallel-entry-evidence.md.
  // The card quotes the AIM clause verbatim, hence gloss-anchored negatives.
  it('parallel-entry card glosses the rejoin as opposite the pattern', () => {
    const card = CORE_DECK.find((c) => /parallel entry/i.test(c.front))
    expect(card).toBeDefined()
    expect(card!.back).toContain('IN THE DIRECTION OF THE HOLDING PATTERN through more than 180°')
    expect(card!.back).toMatch(/opposite the pattern/i)
    expect(card!.back).toMatch(/crosses back over the holding course|onto the holding side/i)
    expect(card!.back).toMatch(/first two turns/i)
    expect(card!.back).toMatch(/only the turn on reaching the fix/i)
    expect(card!.back).not.toMatch(/same way the pattern|follows the pattern|only that direction/i)
    // The direction is settled by the FIGURE, not by j3's sentence — that is the
    // whole thesis of docs/parallel-entry-evidence.md. Citing j3 alone for a
    // figure-only fact presents a derivation as a citation, the exact failure
    // the source-policy rule in CLAUDE.md names. lessons.ts and oral.ts both
    // cite FIG 5-3-4; this card was the outlier, and no test saw it because the
    // assertions above never read `source`.
    expect(card!.source).toContain('FIG 5-3-4')
  })

  it('holding-report cards cite the verified AIM 5-3-3 a1(f), (g)', () => {
    const cards = CORE_DECK.filter((c) => /report/i.test(c.front))
    expect(cards.length).toBeGreaterThanOrEqual(2)
    for (const card of cards) {
      expect(card.source, card.front).toContain('AIM 5-3-3 a1(f), (g)')
    }
  })
})
