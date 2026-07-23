import { describe, expect, it } from 'vitest'
import { createStore, type Store } from '../app/store'
import { ACS_ELEMENTS, ORAL_ITEMS, type OralItem } from '../content/oral'
import { createOralPrep, groupByElement, oralPrepScreen, renderOralPrep } from './oral-prep'

/** In-memory store so tests never touch jsdom localStorage. */
function testStore(): Store {
  return createStore({ storage: undefined, now: () => 1234 })
}

function fakeClock(startMs = 0): { now: () => number; advance: (ms: number) => void } {
  let t = startMs
  return {
    now: () => t,
    advance(ms: number) {
      t += ms
    },
  }
}

const TWO_ITEMS: OralItem[] = [
  {
    id: 'a',
    question: 'QA?',
    answer: 'AA',
    acs: ['IR.III.B.K1'],
    source: 'AIM 5-3-8',
  },
  {
    id: 'b',
    question: 'QB?',
    answer: 'AB',
    acs: ['IR.III.B.S4'],
    source: 'FAA-S-ACS-8C',
    caveat: 'a caveat',
  },
]

describe('createOralPrep', () => {
  it('walks the bank in order and finishes after the last item', () => {
    const prep = createOralPrep({ store: testStore(), items: TWO_ITEMS })
    expect(prep.length).toBe(2)
    expect(prep.item.id).toBe('a')
    prep.reveal()
    prep.grade('got')
    expect(prep.index).toBe(1)
    expect(prep.item.id).toBe('b')
    prep.reveal()
    prep.grade('missed')
    expect(prep.finished).toBe(true)
  })

  it('defaults to the full oral bank', () => {
    const prep = createOralPrep({ store: testStore() })
    expect(prep.length).toBe(ORAL_ITEMS.length)
  })

  it('grade() before reveal() throws — self-grading an unseen answer is meaningless', () => {
    const prep = createOralPrep({ store: testStore(), items: TWO_ITEMS })
    expect(() => prep.grade('got')).toThrow(/reveal/)
  })

  it('reveal flips the revealed flag and resets on advance', () => {
    const prep = createOralPrep({ store: testStore(), items: TWO_ITEMS })
    expect(prep.revealed).toBe(false)
    prep.reveal()
    expect(prep.revealed).toBe(true)
    prep.grade('partial')
    expect(prep.revealed).toBe(false)
  })

  it("records drill results under 'oral': got is correct; partial and missed are not", () => {
    const store = testStore()
    const prep = createOralPrep({ store, items: [...ORAL_ITEMS].slice(0, 3) })
    for (const g of ['got', 'partial', 'missed'] as const) {
      prep.reveal()
      prep.grade(g)
    }
    const stats = store.loadState().drills['oral']!
    expect(stats.attempts).toBe(3)
    expect(stats.correct).toBe(1)
    expect(stats.recent.map((r) => r.correct)).toEqual([true, false, false])
  })

  it('records answer time from the injected clock', () => {
    const store = testStore()
    const clock = fakeClock()
    const prep = createOralPrep({ store, items: TWO_ITEMS, now: clock.now })
    clock.advance(4000)
    prep.reveal()
    clock.advance(2000)
    prep.grade('got')
    expect(store.loadState().drills['oral']!.recent[0]!.timeSeconds).toBe(6)
  })

  it('only missed items record a miss, with an Anki-ready scenario snapshot', () => {
    const store = testStore()
    const prep = createOralPrep({ store, items: TWO_ITEMS })
    prep.reveal()
    prep.grade('partial')
    prep.reveal()
    prep.grade('missed')
    const misses = store.loadState().misses
    expect(misses.length).toBe(1)
    expect(misses[0]!.drill).toBe('oral')
    expect(misses[0]!.scenario).toMatchObject({
      itemId: 'b',
      question: 'QB?',
      answer: 'AB',
      source: 'FAA-S-ACS-8C',
      acs: ['IR.III.B.S4'],
    })
  })

  it('summary reports grade counts after the run; throws while items remain', () => {
    const prep = createOralPrep({ store: testStore(), items: TWO_ITEMS })
    expect(() => prep.summary()).toThrow(/last/)
    prep.reveal()
    prep.grade('got')
    prep.reveal()
    prep.grade('missed')
    expect(prep.summary()).toEqual({ total: 2, got: 1, partial: 0, missed: 1 })
  })

  it('reveal and grade throw once finished', () => {
    const prep = createOralPrep({ store: testStore(), items: [TWO_ITEMS[0]!] })
    prep.reveal()
    prep.grade('got')
    expect(() => prep.reveal()).toThrow(/finished/)
    expect(() => prep.grade('got')).toThrow(/finished/)
  })
})

describe('groupByElement', () => {
  it('groups every item under each of its ACS tags, in ACS element order', () => {
    const groups = groupByElement(ORAL_ITEMS)
    expect(groups.map((g) => g.element.code)).toEqual(ACS_ELEMENTS.map((e) => e.code))
    for (const item of ORAL_ITEMS) {
      for (const code of item.acs) {
        const group = groups.find((g) => g.element.code === code)!
        expect(group.items, `${item.id} under ${code}`).toContain(item)
      }
    }
  })

  it('an item with two tags appears in both groups', () => {
    const item: OralItem = {
      id: 'x',
      question: 'q',
      answer: 'a',
      acs: ['IR.III.B.K1', 'IR.III.B.S7'],
      source: 's',
    }
    const groups = groupByElement([item])
    const holding = groups.filter((g) => g.items.includes(item))
    expect(holding.map((g) => g.element.code)).toEqual(['IR.III.B.K1', 'IR.III.B.S7'])
  })
})

describe('renderOralPrep (jsdom)', () => {
  function setup(items: OralItem[] = TWO_ITEMS): { el: HTMLElement; store: Store } {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const store = testStore()
    renderOralPrep(el, { store, items })
    return { el, store }
  }

  function click(el: HTMLElement, selector: string): void {
    const btn = el.querySelector<HTMLButtonElement>(selector)
    expect(btn, selector).not.toBeNull()
    btn!.click()
  }

  it('shows the question with the answer hidden until reveal', () => {
    const { el } = setup()
    expect(el.textContent).toContain('QA?')
    expect(el.textContent).not.toContain('AA')
    expect(el.querySelector('.oral-grade')).toBeNull()
    click(el, '.oral-reveal')
    expect(el.textContent).toContain('AA')
    expect(el.querySelectorAll('.oral-grade').length).toBe(3)
  })

  it('renders the source citation and caveat with the revealed answer', () => {
    const { el } = setup()
    click(el, '.oral-reveal')
    click(el, '.oral-grade[data-grade="got"]')
    expect(el.textContent).toContain('QB?')
    click(el, '.oral-reveal')
    expect(el.textContent).toContain('FAA-S-ACS-8C')
    expect(el.textContent).toContain('a caveat')
  })

  it('grading missed records the miss and advances; the run ends in a summary', () => {
    const { el, store } = setup()
    click(el, '.oral-reveal')
    click(el, '.oral-grade[data-grade="missed"]')
    expect(store.loadState().misses.length).toBe(1)
    click(el, '.oral-reveal')
    click(el, '.oral-grade[data-grade="got"]')
    expect(el.querySelector('.oral-summary')).not.toBeNull()
    expect(el.textContent).toContain('1')
  })

  it('browse mode lists every ACS element with its items and citations', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    renderOralPrep(el, { store: testStore(), mode: 'browse' })
    for (const e of ACS_ELEMENTS) {
      expect(el.textContent).toContain(e.code)
    }
    for (const item of ORAL_ITEMS) {
      expect(el.textContent).toContain(item.question)
    }
  })

  it('mode buttons switch between self-test and browse', () => {
    const { el } = setup()
    click(el, '.oral-mode[data-mode="browse"]')
    expect(el.textContent).toContain('IR.III.B.S8')
    click(el, '.oral-mode[data-mode="self-test"]')
    expect(el.querySelector('.oral-reveal')).not.toBeNull()
  })
})

describe('oralPrepScreen', () => {
  it('registers the oral-prep route', () => {
    expect(oralPrepScreen.path).toBe('oral-prep')
    expect(oralPrepScreen.title.length).toBeGreaterThan(0)
  })
})
