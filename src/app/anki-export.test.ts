// Tests for TSV serialization (Anki import format), misses→cards conversion,
// Blob download plumbing, and the export screen (including the empty-miss
// state). Written before the implementation (TDD).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_DECK, type AnkiCard } from '../content/anki-deck'
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
})
