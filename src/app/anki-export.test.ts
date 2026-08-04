// Tests for TSV serialization (Anki import format), misses→cards conversion,
// Blob download plumbing, and the export screen (including the empty-miss
// state). Written before the implementation (TDD).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import README from '../../README.md?raw'
import { CORE_DECK, type AnkiCard } from '../content/anki-deck'
import { ORAL_ITEMS } from '../content/oral'
import { QUESTIONS } from '../content/questions'
import { createStore, type Miss, type Store } from './store'
import { ENTRIES } from '../engine/entry'
import { createEntryDrill } from '../modules/entry-drill'
import { createWrittenTest } from '../modules/written-test'
import {
  ankiExportScreen,
  downloadTsv,
  missesToCards,
  renderAnkiExport,
  serializeDeck,
} from './anki-export'

const card: AnkiCard = {
  front: 'Front text',
  back: 'Back text',
  source: 'AIM 5-3-8 j',
  tags: ['rote', 'IR.III.B.K1'],
}

describe('serializeDeck', () => {
  it('emits one front\\tback\\ttags line per card', () => {
    const tsv = serializeDeck([card])
    const lines = tsv.split('\n')
    expect(lines).toHaveLength(1)
    const cols = lines[0]!.split('\t')
    expect(cols).toHaveLength(3)
    expect(cols[0]).toBe('Front text')
    expect(cols[2]).toBe('rote IR.III.B.K1')
  })

  it('appends the FAA source to the back column', () => {
    const cols = serializeDeck([card]).split('\t')
    expect(cols[1]).toContain('Back text')
    expect(cols[1]).toContain('AIM 5-3-8 j')
  })

  it('escapes tabs and newlines inside fields', () => {
    const messy: AnkiCard = {
      front: 'a\tb\nc',
      back: 'd\r\ne',
      source: 's',
      tags: ['t'],
    }
    const line = serializeDeck([messy])
    // still exactly 3 columns and 1 line
    expect(line.split('\n')).toHaveLength(1)
    const cols = line.split('\t')
    expect(cols).toHaveLength(3)
    // newlines become <br> so Anki renders the line break
    expect(cols[0]).toBe('a b<br>c')
    expect(cols[1]).toContain('d<br>e')
  })

  it('joins multiple cards with newlines', () => {
    const tsv = serializeDeck([card, { ...card, front: 'Second' }])
    expect(tsv.split('\n')).toHaveLength(2)
  })

  // Anki's text importer is an RFC4180 reader: a field that STARTS with a double
  // quote is parsed as a quoted field, so the quotes vanish and an odd count
  // swallows the following delimiter. The core deck quotes ATC phraseology
  // ('"Hold northeast of ABC as published" — ...'), which is exactly that shape.
  // Anki renders HTML, so &quot; displays as a plain quote on the card.
  it('escapes double quotes so a quoted field is not eaten by the importer', () => {
    const quoted: AnkiCard = {
      front: '"Hold as published" — what else?',
      back: 'Only direction and "as published".',
      source: 's',
      tags: ['t'],
    }
    const line = serializeDeck([quoted])
    expect(line).not.toContain('"')
    expect(line.split('\t')).toHaveLength(3)
    expect(line.split('\t')[0]).toBe('&quot;Hold as published&quot; — what else?')
  })

  it('emits no raw double quote anywhere in the real core deck', () => {
    expect(serializeDeck(CORE_DECK)).not.toContain('"')
  })

  it('keeps the tag column free of tabs and newlines', () => {
    const line = serializeDeck([{ ...card, tags: ['a\tb', 'c\nd'] }])
    expect(line.split('\n')).toHaveLength(1)
    expect(line.split('\t')).toHaveLength(3)
  })
})

describe('missesToCards', () => {
  const entryMiss: Miss = {
    drill: 'entry',
    at: 1,
    scenario: {
      seed: 7,
      heading: 275,
      holdSpec: {},
      clearanceText: 'Hold northeast of ECA VOR on the 040 radial.',
      chosen: 'direct',
      expected: 'teardrop',
      alternates: ['parallel'],
    },
  }
  const writtenMiss: Miss = {
    drill: 'written',
    at: 2,
    scenario: {
      questionId: 'q-speeds-1',
      topic: 'speeds',
      question: 'Max holding speed at 5,000 ft MSL?',
      chosen: '230 KIAS',
      correctOption: '200 KIAS',
      explanation: 'From MHA through 6,000 ft the maximum is 200 KIAS.',
      source: 'AIM 5-3-8 j (maximum holding airspeeds table)',
    },
  }
  const oralMiss: Miss = {
    drill: 'oral',
    at: 3,
    scenario: {
      itemId: 'oral-efc',
      question: 'What is an EFC and why does it matter?',
      answer: 'Expect further clearance time; lost-comm departure time and fuel planning.',
      source: 'P/CG "Expect Further Clearance (Time)"',
      // The oral bank tags each item with an ACS element ARRAY (oral.ts).
      acs: ['IR.III.B.R1', 'IR.III.B.K2'],
    },
  }

  it('converts an entry-drill miss into a scenario card', () => {
    const cards = missesToCards([entryMiss])
    expect(cards).toHaveLength(1)
    const c = cards[0]!
    expect(c.front).toContain('Hold northeast of ECA VOR')
    expect(c.front).toContain('275')
    expect(c.back).toContain('teardrop')
    expect(c.back).toContain('parallel')
    expect(c.source).toContain('AIM 5-3-8')
    expect(c.tags).toContain('miss')
    expect(c.tags).toContain('entry')
  })

  it('converts a written-test miss keeping explanation and source', () => {
    const c = missesToCards([writtenMiss])[0]!
    expect(c.front).toContain('Max holding speed at 5,000 ft MSL?')
    expect(c.back).toContain('200 KIAS')
    expect(c.back).toContain('From MHA through 6,000 ft')
    expect(c.source).toBe('AIM 5-3-8 j (maximum holding airspeeds table)')
    expect(c.tags).toEqual(expect.arrayContaining(['miss', 'written', 'speeds']))
  })

  it('converts an oral miss with every ACS element tag it covers', () => {
    const c = missesToCards([oralMiss])[0]!
    expect(c.front).toBe('What is an EFC and why does it matter?')
    expect(c.back).toContain('Expect further clearance time')
    expect(c.tags).toEqual(expect.arrayContaining(['miss', 'oral', 'IR.III.B.R1', 'IR.III.B.K2']))
  })

  it('exports the learn-mode and exam-sim variants, not just the base drill ids', () => {
    // entry-learn and written-exam are separate store keys matched by string
    // here and in the dashboard (CLAUDE.md). Dropping either branch loses the
    // cards silently — the export just comes back shorter.
    const cards = missesToCards([
      { ...entryMiss, drill: 'entry-learn' },
      { ...writtenMiss, drill: 'written-exam' },
    ])
    expect(cards).toHaveLength(2)
    expect(cards[0]!.tags).toEqual(expect.arrayContaining(['miss', 'entry-learn']))
    expect(cards[0]!.front).toContain('Hold northeast of ECA VOR')
    expect(cards[1]!.tags).toEqual(expect.arrayContaining(['miss', 'written-exam', 'speeds']))
    expect(cards[1]!.back).toContain('200 KIAS')
  })

  it('ignores misses from drills that produce no cards', () => {
    // wind-lab, clearance-copy and to-from snapshots are recorded but have no
    // converter; they must be skipped, not crash or emit a blank card.
    const cards = missesToCards([
      { drill: 'wind-lab', at: 4, scenario: { seed: 1, numbers: {} } },
      { drill: 'clearance-copy', at: 5, scenario: { seed: 2 } },
      { drill: 'to-from', at: 6, scenario: { seed: 3 } },
      entryMiss,
    ])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.tags).toContain('entry')
  })

  it('renders the heading with the app-wide three-digit readout', () => {
    // The card and the drill must read the same: 040°, not 40°.
    const c = missesToCards([{ ...entryMiss, scenario: { ...(entryMiss.scenario as object), heading: 40 } }])[0]!
    expect(c.front).toContain('040°')
  })

  it('carries the plate line so an "as published" miss stays answerable', () => {
    // The clearance states neither course nor turn direction; without the
    // chart line the card cannot be answered away from the drill.
    const scenario = {
      ...(entryMiss.scenario as object),
      clearanceText: 'Hold northeast of CEDES as published, expect further clearance at 0710.',
      chartNote: 'Chart: CEDES — inbound course 300°, left turns, 1 minute legs.',
    }
    const c = missesToCards([{ ...entryMiss, scenario }])[0]!
    expect(c.front).toContain('left turns')
    expect(c.front).toContain('300°')
  })

  it('converts an entry miss recorded by the real entry drill (store round-trip)', () => {
    // Same contract guard as the oral case below: what entry-drill.ts records
    // is what missesToCards must read.
    const store = createStore({ storage: undefined, now: () => 0 })
    const drill = createEntryDrill({ mode: 'cockpit', seed: 4, store, now: () => 0 })
    const wrong = ENTRIES.find((e) => e !== drill.scenario.result.primary && !drill.scenario.result.alternates.includes(e))!
    drill.answer(wrong)
    const c = missesToCards(store.loadState().misses)[0]!
    expect(c.front).toContain(drill.scenario.clearanceText)
    expect(c.front).toContain(drill.scenario.chartNote!)
    expect(c.back).toContain(drill.scenario.result.primary)
  })

  it('converts a written miss recorded by the real written test (store round-trip)', () => {
    const store = createStore({ storage: undefined, now: () => 0 })
    const test = createWrittenTest({ mode: 'practice', seed: 3, store, now: () => 0 })
    const q = test.question
    const wrongIndex = q.answerIndex === 0 ? 1 : 0
    test.answer(wrongIndex)
    const c = missesToCards(store.loadState().misses)[0]!
    expect(c.front).toContain(q.question)
    expect(c.back).toContain(q.options[q.answerIndex]!)
  })

  it('converts an oral miss recorded by the real oral-prep flow (store round-trip)', () => {
    // Guards the snapshot contract end-to-end: what oral-prep.ts records is
    // what missesToCards must read — a fixture drift here masked a real bug.
    const backing = new Map<string, string>()
    const store = createStore({
      storage: {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => backing.set(k, v),
      },
    })
    store.recordMiss('oral', {
      itemId: 'oral-x',
      question: 'Q',
      answer: 'A',
      source: 'AIM 5-3-8',
      acs: ['IR.III.B.K1'],
    })
    const c = missesToCards(store.loadState().misses)[0]!
    expect(c.tags).toContain('IR.III.B.K1')
  })

  it('shows an entry-miss heading of 0 as 360° per the display convention', () => {
    const c = missesToCards([
      { ...entryMiss, scenario: { ...entryMiss.scenario as object, heading: 0 } },
    ])[0]!
    expect(c.front).toContain('360°')
    expect(c.front).not.toContain(' 0°')
  })

  it('keeps chronological order across drill types', () => {
    const cards = missesToCards([entryMiss, writtenMiss, oralMiss])
    expect(cards).toHaveLength(3)
    expect(cards[1]!.tags).toContain('written')
  })

  // A miss snapshot denormalizes the item's prose into localStorage so a card
  // survives the item being deleted — but that also FREEZES the fact. A user who
  // missed the `entries` item before 2026-08-02 has the inverted parallel rejoin
  // ("reintercepts right" in a right-hand hold) sitting in their store, and
  // re-exporting today regenerated it verbatim: the exact negative-training path
  // this branch exists to close, surviving inside the app. The re-import step the
  // screen renders is only TRUE for the misses deck once the exporter re-reads
  // live content. `itemId` was already recorded by oral-prep.ts; only the read
  // side was missing. Asserting the step is present (above) is not asserting it
  // works, so this asserts the deck itself.
  // ⚠️ EVERY field of the stale snapshot must DIFFER from the live item, not
  // just the one the assertion names. The first version of these two tests
  // copied `live.question`/`live.topic`/`live.options[answerIndex]`/a subset of
  // `live.acs` into the snapshot and asserted only on the answer prose — so
  // reverting five of the six rebuilt fields to the snapshot read left the whole
  // suite green (mutation-confirmed). A fixture that agrees with live is a
  // fixture that cannot discriminate; `correctOption` in particular is the
  // written card's ANSWER LINE, the string a content correction is likeliest to
  // touch.
  it('rebuilds an oral miss card from live content, not the frozen snapshot', () => {
    const live = ORAL_ITEMS.find((i) => i.id === 'entries')!
    const stale: Miss = {
      drill: 'oral',
      at: 7,
      scenario: {
        itemId: 'entries',
        question: 'STALE QUESTION recorded before a content correction.',
        answer:
          'Note the parallel reintercept turns the same way the pattern does — a ' +
          'right-turn hold reintercepts right — because only that direction is the ' +
          '"more than 180°" turn the AIM specifies.',
        source: 'STALE 0-0-0',
        acs: ['STALE.TAG'],
      },
    }
    const c = missesToCards([stale])[0]!
    expect(c.front).toBe(live.question)
    expect(c.back).toContain(live.answer)
    expect(c.source).toBe(live.source)
    expect(c.tags).toEqual(['miss', 'oral', ...live.acs])
    expect(c.tags).not.toContain('STALE.TAG')
    // the settled direction, and no trace of the pre-fix gloss
    expect(c.back).toMatch(/opposite the pattern/i)
    expect(c.back).not.toMatch(/reintercepts right|same way the pattern/i)
  })

  it('rebuilds a written miss card from live content, not the frozen snapshot', () => {
    // Same defect class one drill over. It is latent today only because
    // questions.ts happened to carry no rejoin claim — the next content
    // correction that touches an explanation would ship the stale one.
    const live = QUESTIONS.find((q) => q.id === 'entry-ktcy-haire')!
    const stale: Miss = {
      drill: 'written',
      at: 8,
      scenario: {
        questionId: 'entry-ktcy-haire',
        topic: 'stale-topic',
        question: 'STALE QUESTION recorded before a content correction.',
        chosen: 'direct',
        correctOption: 'STALE OPTION',
        explanation: 'STALE EXPLANATION recorded before a content correction.',
        source: 'STALE 0-0-0',
      },
    }
    const c = missesToCards([stale])[0]!
    expect(c.front).toBe(live.question)
    expect(c.back).toContain(live.options[live.answerIndex]!)
    expect(c.back).toContain(live.explanation)
    expect(c.back).not.toContain('STALE')
    expect(c.source).toBe(live.source)
    expect(c.tags).toContain(live.topic)
    expect(c.tags).not.toContain('stale-topic')
  })

  // CLAUDE.md: "Never drop a caveat because the type has no field for it."
  // `AnkiCard` has no caveat field and `OralItem` keeps its caveat OUT of
  // `answer` (oral-prep.ts renders it separately), so a card built from `answer`
  // alone silently teaches the unqualified rule. Driven off whichever items
  // actually carry one rather than a hardcoded id, so a caveat added later
  // cannot ship unexported.
  it('carries every oral item caveat onto the exported card', () => {
    const withCaveat = ORAL_ITEMS.filter((i) => i.caveat !== undefined)
    expect(withCaveat.length, 'no oral item carries a caveat — fixture drift?').toBeGreaterThan(0)
    for (const item of withCaveat) {
      const miss: Miss = {
        drill: 'oral',
        at: 11,
        scenario: { itemId: item.id, question: 'Q', answer: 'A', source: 'S', acs: [] },
      }
      const c = missesToCards([miss])[0]!
      expect(c.back, `${item.id} exported without its caveat`).toContain(item.caveat!)
    }
  })

  // The delete-resilience the snapshot was built for has to survive the fix:
  // an id that no longer resolves (item retired, or a pre-`itemId` snapshot from
  // an older store) must still export its card rather than vanish. Both live-id
  // tests above would pass a "drop unresolvable misses" implementation too.
  it('falls back to the snapshot when the id no longer resolves', () => {
    const gone: Miss = {
      drill: 'oral',
      at: 9,
      scenario: { itemId: 'retired-item', question: 'Q', answer: 'A', source: 'AIM 5-3-8', acs: [] },
    }
    const idless: Miss = {
      drill: 'written',
      at: 10,
      scenario: { question: 'Q2', correctOption: 'C', explanation: 'E', source: 'AIM 5-3-8' },
    }
    const cards = missesToCards([gone, idless])
    expect(cards).toHaveLength(2)
    expect(cards[0]!.back).toBe('A')
    expect(cards[1]!.back).toContain('E')
  })

  // The caveat had no snapshot source at all, so it survived only on the LIVE
  // path — and the fallback path is the one delete-resilience exists for. The
  // `entries` item's caveat is the ±5° tolerance that makes a boundary heading's
  // second entry correct, so the retired-item card taught a stricter rule than
  // the AIM's, silently. `recordMiss` now denormalizes it like every sibling.
  it('carries the caveat through the fallback path too', () => {
    const gone: Miss = {
      drill: 'oral',
      at: 20,
      scenario: {
        itemId: 'retired-item',
        question: 'Q',
        answer: 'A',
        source: 'AIM 5-3-8',
        acs: [],
        caveat: 'within good operating limits, ±5°',
      },
    }
    expect(missesToCards([gone])[0]!.back).toContain('within good operating limits, ±5°')
  })

  // ...but only there. The snapshot is a CACHE, so a live item that has had its
  // caveat RETIRED must not have it resurrected off a stale miss — the same
  // direction-of-authority the answer/source rebuild establishes, applied to the
  // one field whose absence is meaningful. `??` would get this backwards
  // (`undefined` falls through to the snapshot); the ternary on `live` is why.
  it('does not resurrect a retired caveat from the snapshot', () => {
    const plain = ORAL_ITEMS.find((i) => i.caveat === undefined)
    expect(plain, 'every oral item carries a caveat — fixture drift?').toBeDefined()
    const stale: Miss = {
      drill: 'oral',
      at: 21,
      scenario: {
        itemId: plain!.id,
        question: 'Q',
        answer: 'A',
        source: 'AIM 5-3-8',
        acs: [],
        caveat: 'RETIRED CAVEAT',
      },
    }
    expect(missesToCards([stale])[0]!.back).not.toContain('RETIRED CAVEAT')
  })

  // The entry answer is the most safety-critical string the app produces, and it
  // was the one frozen hardest: `expected`/`alternates` are `determineEntry`
  // output snapshotted at miss time, so an engine correction left the deck
  // teaching the OLD SECTOR while the screen's re-import step told the user the
  // deck was now current. The module docblock used to excuse this as "engine-
  // derived scenarios, not bank prose" — backwards as a safety argument, since
  // engine-derived is exactly what an engine correction invalidates.
  it('re-derives an entry miss answer from the engine, not the frozen snapshot', () => {
    // Derived from the AIM's sector geometry, NOT by calling determineEntry —
    // an expectation read out of the oracle agrees with any engine, including a
    // corrected one, so it could not tell a re-derivation from a frozen read.
    // Right-turn hold, inbound course 000: the teardrop sector spans 110°–180°
    // clockwise of the inbound course (AIM 5-3-8 j3), so heading 140 is a
    // teardrop, 30° clear of both boundaries and therefore un-alternated.
    const stale: Miss = {
      drill: 'entry',
      at: 12,
      scenario: {
        clearanceText: 'Hold north of ABCDE as published.',
        heading: 140,
        holdSpec: { inboundCourse: 0, turnDirection: 'right' },
        chosen: 'direct',
        expected: 'parallel',
        alternates: ['direct'],
      },
    }
    const c = missesToCards([stale])[0]!
    expect(c.back).toContain('Correct entry: teardrop')
    expect(c.back).not.toContain('parallel')
    expect(c.back).not.toContain('also acceptable')
  })

  it('keeps the frozen entry answer when the snapshot predates holdSpec', () => {
    // Delete-resilience again: a pre-`holdSpec` snapshot, or one whose hold no
    // longer validates, must still export rather than vanish or throw. The
    // course here is out of the engine's [0,360) domain, which `determineEntry`
    // answers with a RangeError — one malformed miss must not take the export
    // down.
    const legacy: Miss = {
      drill: 'entry',
      at: 13,
      scenario: {
        clearanceText: 'Hold east of FGHIJ as published.',
        heading: 90,
        expected: 'parallel',
        alternates: ['teardrop'],
      },
    }
    const bad: Miss = {
      drill: 'entry',
      at: 14,
      scenario: {
        clearanceText: 'Hold west of KLMNO as published.',
        heading: 90,
        holdSpec: { inboundCourse: 360, turnDirection: 'right' },
        expected: 'direct',
      },
    }
    const cards = missesToCards([legacy, bad])
    expect(cards).toHaveLength(2)
    expect(cards[0]!.back).toContain('Correct entry: parallel (also acceptable: teardrop)')
    expect(cards[1]!.back).toContain('Correct entry: direct')
  })

  // `heading` is the OTHER argument the re-derivation feeds the engine, and it
  // reached `determineEntry` unguarded while its co-argument `inboundCourse` was
  // range-checked by `snapshotHold` for exactly this reason. `courseText` — the
  // only consumer before the re-derivation landed — never throws, so an
  // out-of-domain heading was harmless until this branch and is now a
  // `RangeError` out of `angleDiff`, uncaught all the way up through
  // `missesToCards` into `renderAnkiExport`, which the router calls after
  // clearing `#app`. One hand-edited localStorage entry blanks the screen.
  it('does not throw on a heading outside the engine domain', () => {
    const good: Miss = {
      drill: 'entry',
      at: 15,
      scenario: {
        clearanceText: 'Hold north of ABCDE as published.',
        heading: 140,
        holdSpec: { inboundCourse: 0, turnDirection: 'right' },
        expected: 'teardrop',
      },
    }
    // 360 is the boundary the engine rejects (courses live in [0, 360)); -1 and
    // NaN are the other two ways a stored number leaves the domain.
    const bad: Miss[] = [360, -1, Number.NaN].map((heading, i) => ({
      drill: 'entry',
      at: 16 + i,
      scenario: {
        clearanceText: 'Hold east of FGHIJ as published.',
        heading,
        holdSpec: { inboundCourse: 0, turnDirection: 'right' },
        expected: 'parallel',
      },
    }))
    // The surviving good card is the assertion that matters: a `try/catch`
    // wrapped around the whole loop would also "not throw", and would drop
    // every later miss with it.
    const cards = missesToCards([...bad, good])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.back).toContain('Correct entry: teardrop')
  })

  it('skips unknown drills and malformed scenarios without throwing', () => {
    const bad: Miss[] = [
      { drill: 'mystery', at: 4, scenario: { question: 'x' } },
      { drill: 'entry', at: 5, scenario: null },
      { drill: 'written', at: 6, scenario: 'not-a-record' },
    ]
    expect(missesToCards(bad)).toHaveLength(0)
  })

  it('does not (yet) export clearance-copy, to-from, or wind-lab misses', () => {
    // Deliberate deferral (plan Task 14): these drills record misses under
    // ids missesToCards does not convert. Pin it so a future exporter for
    // them is a conscious change, and so the README wording stays honest.
    const deferred: Miss[] = [
      { drill: 'clearance-copy', at: 7, scenario: { clearanceText: 'x' } },
      { drill: 'to-from', at: 8, scenario: { prompt: 'x', answer: 'N' } },
      { drill: 'wind-lab', at: 9, scenario: { seed: 1 } },
    ]
    expect(missesToCards(deferred)).toHaveLength(0)
  })

  it('returns an empty array for no misses', () => {
    expect(missesToCards([])).toHaveLength(0)
  })
})

describe('downloadTsv', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:test-url')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    // restoreAllMocks does NOT undo useFakeTimers. A failing assertion below
    // would otherwise skip the in-test restore and leave every later test in
    // this file running on a frozen clock.
    vi.useRealTimers()
  })

  it('creates an object URL, clicks a download link, and revokes the URL', () => {
    vi.useFakeTimers()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('hold-train-core.tsv')
        expect(this.href).toContain('blob:test-url')
        // The anchor has to be in the document when it is activated: a
        // detached anchor's navigation is a no-op in some browsers.
        expect(this.isConnected).toBe(true)
      })
    downloadTsv('hold-train-core.tsv', 'front\tback\ttags')
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    // click() only *queues* the navigation that reads the blob URL. Revoking in
    // the same task can pull the URL out from under it, and the download
    // silently yields nothing.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.useRealTimers()
  })
})

describe('anki export screen', () => {
  let el: HTMLElement
  let store: Store

  function storeWithMisses(misses: number): Store {
    const backing = new Map<string, string>()
    const s = createStore({
      storage: {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => backing.set(k, v),
      },
    })
    for (let i = 0; i < misses; i++) {
      s.recordMiss('oral', {
        itemId: `m${i}`,
        question: `Q${i}`,
        answer: `A${i}`,
        source: 'AIM 5-3-8',
        acs: ['IR.III.B.K1'],
      })
    }
    return s
  }

  beforeEach(() => {
    el = document.createElement('div')
    URL.createObjectURL = vi.fn(() => 'blob:test-url')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is registered at anki with a descriptive title', () => {
    expect(ankiExportScreen.path).toBe('anki')
    expect(ankiExportScreen.title).toMatch(/anki/i)
  })

  it('shows both deck downloads with card counts and import instructions', () => {
    store = storeWithMisses(2)
    renderAnkiExport(el, { store })
    const coreBtn = el.querySelector<HTMLButtonElement>('.anki-core')
    const missBtn = el.querySelector<HTMLButtonElement>('.anki-misses')
    expect(coreBtn?.textContent).toMatch(/\d+ cards/)
    expect(missBtn?.textContent).toContain('2 cards')
    expect(missBtn?.disabled).toBe(false)
    expect(el.textContent).toMatch(/import/i)
    expect(el.textContent).toContain('tab')
  })

  it('downloads the core deck on click', () => {
    store = storeWithMisses(0)
    renderAnkiExport(el, { store })
    el.querySelector<HTMLButtonElement>('.anki-core')!.click()
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
  })

  it('downloads the misses deck on click when misses exist', () => {
    store = storeWithMisses(1)
    renderAnkiExport(el, { store })
    el.querySelector<HTMLButtonElement>('.anki-misses')!.click()
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
  })

  it('empty miss list shows an informative empty state and disables the download', () => {
    store = storeWithMisses(0)
    renderAnkiExport(el, { store })
    const missBtn = el.querySelector<HTMLButtonElement>('.anki-misses')
    expect(missBtn?.disabled).toBe(true)
    expect(el.textContent).toMatch(/no misses/i)
  })

  // clearance-copy, to-from and wind-lab record misses the dashboard shows but
  // missesToCards has no converter for (a documented deferral). Telling that
  // student "no misses recorded yet" contradicts the Progress screen they just
  // came from and reads as lost data.
  it('names the drills that are tracked but not exportable rather than claiming no misses', () => {
    const backing = new Map<string, string>()
    store = createStore({
      storage: {
        getItem: (k) => backing.get(k) ?? null,
        setItem: (k, v) => backing.set(k, v),
      },
    })
    store.recordMiss('wind-lab', { seed: 1 })
    store.recordMiss('clearance-copy', { seed: 2 })
    renderAnkiExport(el, { store })

    expect(el.querySelector<HTMLButtonElement>('.anki-misses')?.disabled).toBe(true)
    expect(el.textContent).not.toMatch(/no misses recorded yet/i)
    expect(el.textContent).toMatch(/not.*export/i)
    expect(el.textContent).toMatch(/wind.lab/i)
  })

  // README documents a re-import step; this screen renders the steps a user
  // actually reads at export time, and it did not have one. A stale deck is the
  // one place a corrected fact keeps being drilled after the fix ships — a user
  // who exported before 2026-08-02 still rehearses the inverted parallel rejoin
  // and nothing in the app tells them otherwise. Same runtime-only doc↔code
  // coupling class as the README route table (dashboard.test.ts): a grep cannot
  // see it, so it is asserted on both sides.
  it('tells the user to re-import after a content correction, and so does README', () => {
    renderAnkiExport(el, { store: storeWithMisses(0) })
    const steps = el.textContent ?? ''
    expect(steps).toMatch(/re-?import/i)
    expect(steps).toMatch(/not updated by fixes|stays wrong/i)
    expect(steps).toContain('content-audit.md')
    expect(README).toMatch(/re-?download and re-?import/i)
    expect(README).toContain('content-audit.md')
  })

  // The update-vs-duplicate behaviour is Anki's, not ours, and README labels it
  // unverified. The screen stated it flatly ("matching notes update rather than
  // duplicate") while README hedged — so the artifact the user reads at export
  // time presented an unverified third-party behaviour as fact, which CLAUDE.md
  // forbids and which silently duplicates a user's deck if they pick a different
  // notetype. The step-exists test above passed throughout: asserting a step is
  // present is not asserting what it claims. Both sides are pinned here.
  it('hedges the update-vs-duplicate claim on the screen, as README does', () => {
    renderAnkiExport(el, { store: storeWithMisses(0) })
    const steps = el.textContent ?? ''
    expect(steps).toMatch(/should\s+update rather than duplicate/i)
    expect(steps).toMatch(/unverified/i)
    // the reason it is only "should": the file carries no notetype directive,
    // so matching is scoped by the import dialog rather than by the download
    expect(steps).toMatch(/#notetype:/)
    expect(steps).toMatch(/import screen|import dialog/i)
    expect(README).toMatch(/should update rather than duplicate/i)
    expect(README).toMatch(/unverified/i)
  })
})
