// Tests for TSV serialization (Anki import format), misses→cards conversion,
// Blob download plumbing, and the export screen (including the empty-miss
// state). Written before the implementation (TDD).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnkiCard } from '../content/anki-deck'
import { createStore, type Miss, type Store } from './store'
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
      acs: 'IR.III.B.R1',
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

  it('converts an oral miss with its ACS element tag', () => {
    const c = missesToCards([oralMiss])[0]!
    expect(c.front).toBe('What is an EFC and why does it matter?')
    expect(c.back).toContain('Expect further clearance time')
    expect(c.tags).toEqual(expect.arrayContaining(['miss', 'oral', 'IR.III.B.R1']))
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
  })

  it('creates an object URL, clicks a download link, and revokes the URL', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('hold-train-core.tsv')
        expect(this.href).toContain('blob:test-url')
      })
    downloadTsv('hold-train-core.tsv', 'front\tback\ttags')
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
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
        acs: 'IR.III.B.K1',
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
})
