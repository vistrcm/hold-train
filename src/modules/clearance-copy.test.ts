import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore, type Store } from '../app/store'
import {
  generateClearance,
  type ClearanceFields,
  type CopiedClearance,
} from '../engine/clearance'
import { cardinalFromCourse, normalizeDeg, reciprocal } from '../engine/geometry'
import {
  clearanceCopyScreen,
  createClearanceCopyDrill,
  createToFromDrill,
  generateCopyScenario,
  generateToFromScenario,
  holdSide,
  listenMillis,
  MIN_LISTEN_MS,
  renderClearanceCopy,
} from './clearance-copy'

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

/** First seed whose generated clearance satisfies the predicate. */
function findSeed(pred: (fields: ClearanceFields) => boolean): number {
  for (let seed = 0; seed < 500; seed++) {
    if (pred(generateClearance(seed).expectedFields)) {
      return seed
    }
  }
  throw new Error('no seed found in 500 tries')
}

/** A flawless copy: every stated field as heard, every unstated field by rule. */
function perfectCopy(expected: ClearanceFields): CopiedClearance {
  const user: CopiedClearance = {
    direction: expected.direction,
    fix: expected.fix,
    courseKind: expected.courseKind,
    leg: expected.leg === 'unstated' ? { unit: 'min', value: 1 } : expected.leg,
    turnDirection: expected.turnDirection === 'left' ? 'left' : 'right',
    efc: expected.efc,
  }
  if (expected.courseDegrees !== undefined) {
    user.courseDegrees = expected.courseDegrees
  }
  return user
}

const SEED_UNSTATED_TURNS = findSeed(
  (f) => f.courseKind !== 'published' && f.turnDirection === 'unstated',
)
const SEED_PUBLISHED = findSeed((f) => f.courseKind === 'published')
const SEED_STATED_COURSE = findSeed((f) => f.courseDegrees !== undefined)

describe('generateCopyScenario', () => {
  it('is deterministic and wraps the engine generator', () => {
    expect(generateCopyScenario(42)).toEqual(generateCopyScenario(42))
    const s = generateCopyScenario(7)
    const g = generateClearance(7)
    expect(s.clearanceText).toBe(g.clearance.text)
    expect(s.expected).toEqual(g.expectedFields)
    expect(s.holdSpec).toEqual(g.holdSpec)
    expect(s.source).toBe(g.clearance.source)
  })

  it('covers stated-course and as-published holds across seeds', () => {
    const kinds = new Set<string>()
    for (let seed = 0; seed < 200; seed++) {
      kinds.add(generateCopyScenario(seed).expected.courseKind)
    }
    expect(kinds).toEqual(new Set(['radial', 'bearing', 'published']))
  })
})

describe('listenMillis', () => {
  it('never shorter than the floor and grows with the clearance length', () => {
    expect(listenMillis('Hold north.')).toBe(MIN_LISTEN_MS)
    const short = listenMillis(generateCopyScenario(SEED_PUBLISHED).clearanceText)
    const long = listenMillis(
      'Hold southwest of the Manteca VOR on the two three zero radial, ' +
        'five mile legs, left turns, expect further clearance at one seven three zero.',
    )
    expect(long).toBeGreaterThan(short)
  })
})

describe('createClearanceCopyDrill', () => {
  it('grades a perfect copy correct field by field and records the result', () => {
    const store = testStore()
    const clock = fakeClock()
    const drill = createClearanceCopyDrill({ seed: SEED_STATED_COURSE, store, now: clock.now })
    clock.advance(30_000)

    const fb = drill.submit(perfectCopy(drill.scenario.expected))
    expect(fb.correct).toBe(true)
    expect(fb.grade.allCorrect).toBe(true)
    expect(fb.grade.fields).toHaveLength(6)
    expect(fb.grade.fields.every((f) => f.correct)).toBe(true)
    expect(fb.timeSeconds).toBe(30)
    expect(drill.session).toEqual({ attempts: 1, correct: 1 })

    const stats = store.loadState().drills['clearance-copy']
    expect(stats?.attempts).toBe(1)
    expect(stats?.correct).toBe(1)
    expect(store.loadState().misses).toHaveLength(0)
  })

  it('surfaces the standard-turns trap: unstated turns copied as left', () => {
    const drill = createClearanceCopyDrill({ seed: SEED_UNSTATED_TURNS, store: testStore() })
    const user = { ...perfectCopy(drill.scenario.expected), turnDirection: 'left' as const }

    const fb = drill.submit(user)
    expect(fb.correct).toBe(false)
    expect(fb.trapHit).toBe(true)
    const turns = fb.grade.fields.find((f) => f.field === 'turnDirection')
    expect(turns?.correct).toBe(false)
    expect(turns?.trap).toBe(true)
    expect(turns?.note).toMatch(/right turns/)
  })

  it('unstated turns copied as right is correct, still flagged as the trap rule', () => {
    const drill = createClearanceCopyDrill({ seed: SEED_UNSTATED_TURNS, store: testStore() })
    const fb = drill.submit(perfectCopy(drill.scenario.expected))
    const turns = fb.grade.fields.find((f) => f.field === 'turnDirection')
    expect(turns?.correct).toBe(true)
    expect(turns?.trap).toBe(true)
  })

  it('"as published" grades only present fields: any turn choice accepted', () => {
    const drill = createClearanceCopyDrill({ seed: SEED_PUBLISHED, store: testStore() })
    expect(drill.scenario.expected.courseKind).toBe('published')
    const user = { ...perfectCopy(drill.scenario.expected), turnDirection: 'left' as const }
    const fb = drill.submit(user)
    expect(fb.correct).toBe(true)
    expect(fb.grade.fields.find((f) => f.field === 'turnDirection')?.correct).toBe(true)
  })

  it('records a miss with a rebuildable snapshot when any field is wrong', () => {
    const store = testStore()
    const drill = createClearanceCopyDrill({ seed: SEED_STATED_COURSE, store })
    const user = { ...perfectCopy(drill.scenario.expected), fix: 'WRONG' }

    const fb = drill.submit(user)
    expect(fb.correct).toBe(false)
    expect(drill.session).toEqual({ attempts: 1, correct: 0 })

    const misses = store.loadState().misses
    expect(misses).toHaveLength(1)
    expect(misses[0]?.drill).toBe('clearance-copy')
    const snap = misses[0]?.scenario as Record<string, unknown>
    expect(snap['seed']).toBe(SEED_STATED_COURSE)
    expect(snap['clearanceText']).toBe(drill.scenario.clearanceText)
    expect(snap['expected']).toEqual(drill.scenario.expected)
    expect(snap['user']).toEqual(user)
    expect(snap['wrongFields']).toEqual(['fix'])
  })

  it('rejects a second submit and resets on next()', () => {
    const clock = fakeClock()
    const drill = createClearanceCopyDrill({ seed: 1, store: testStore(), now: clock.now })
    drill.submit(perfectCopy(drill.scenario.expected))
    expect(() => drill.submit(perfectCopy(drill.scenario.expected))).toThrow(/next/)

    const before = drill.scenario.seed
    clock.advance(5000)
    const next = drill.next()
    expect(next.seed).toBe(before + 1)
    const fb = drill.submit(perfectCopy(next.expected))
    expect(fb.timeSeconds).toBe(0)
  })
})

describe('holdSide', () => {
  it('radial FROM: the hold lies on the radial side of the station', () => {
    expect(holdSide('radial', 160)).toBe(cardinalFromCourse(160)) // 'S'
    expect(holdSide('radial', 90)).toBe('E')
    expect(holdSide('radial', 230)).toBe('SW')
  })

  it('bearing TO: the hold lies on the reciprocal side of the station', () => {
    expect(holdSide('bearing', 160)).toBe(cardinalFromCourse(340)) // 'N'
    expect(holdSide('bearing', 90)).toBe('W')
    expect(holdSide('bearing', 230)).toBe('NE')
  })

  it('accepts 360 as spoken on the radio', () => {
    expect(holdSide('radial', 360)).toBe('N')
    expect(holdSide('bearing', 360)).toBe('S')
  })

  it('radial and bearing with the same number are always opposite sides', () => {
    for (let deg = 10; deg <= 360; deg += 10) {
      const radialSide = holdSide('radial', deg)
      const bearingSide = holdSide('bearing', deg)
      expect(bearingSide).toBe(cardinalFromCourse(reciprocal(normalizeDeg(deg))))
      expect(bearingSide).not.toBe(radialSide)
    }
  })

  it('rejects non-finite degrees', () => {
    expect(() => holdSide('radial', NaN)).toThrow(RangeError)
  })
})

describe('generateToFromScenario', () => {
  it('is deterministic and the answer matches holdSide', () => {
    expect(generateToFromScenario(3)).toEqual(generateToFromScenario(3))
    for (let seed = 0; seed < 50; seed++) {
      const s = generateToFromScenario(seed)
      expect(s.answer).toBe(holdSide(s.kind, s.degrees))
      expect(s.degrees % 10).toBe(0)
      expect(s.degrees).toBeGreaterThanOrEqual(10)
      expect(s.degrees).toBeLessThanOrEqual(360)
      expect(s.prompt).toContain(s.kind === 'radial' ? 'radial' : 'bearing')
    }
  })

  it('covers both radial and bearing questions across seeds', () => {
    const kinds = new Set<string>()
    for (let seed = 0; seed < 50; seed++) {
      kinds.add(generateToFromScenario(seed).kind)
    }
    expect(kinds).toEqual(new Set(['radial', 'bearing']))
  })
})

describe('createToFromDrill', () => {
  it('grades against holdSide and records results under to-from', () => {
    const store = testStore()
    const drill = createToFromDrill({ seed: 5, store })
    const fb = drill.answer(drill.scenario.answer)
    expect(fb.correct).toBe(true)
    expect(store.loadState().drills['to-from']?.correct).toBe(1)
    expect(store.loadState().misses).toHaveLength(0)
  })

  it('records a miss with the scenario on a wrong side', () => {
    const store = testStore()
    const drill = createToFromDrill({ seed: 5, store })
    const wrong = drill.scenario.answer === 'N' ? 'S' : 'N'
    const fb = drill.answer(wrong)
    expect(fb.correct).toBe(false)
    expect(fb.answer).toBe(drill.scenario.answer)
    const misses = store.loadState().misses
    expect(misses).toHaveLength(1)
    expect(misses[0]?.drill).toBe('to-from')
    const snap = misses[0]?.scenario as Record<string, unknown>
    expect(snap['chosen']).toBe(wrong)
    expect(snap['answer']).toBe(drill.scenario.answer)
  })

  it('rejects a second answer and advances on next()', () => {
    const drill = createToFromDrill({ seed: 5, store: testStore() })
    drill.answer(drill.scenario.answer)
    expect(() => drill.answer('N')).toThrow(/next/)
    const before = drill.scenario.seed
    expect(drill.next().seed).toBe(before + 1)
  })
})

describe('renderClearanceCopy', () => {
  let el: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    el = document.createElement('div')
    document.body.append(el)
  })

  afterEach(() => {
    vi.useRealTimers()
    el.remove()
  })

  function fillForm(user: CopiedClearance): void {
    el.querySelector<HTMLSelectElement>('[data-field="direction"]')!.value = user.direction
    el.querySelector<HTMLInputElement>('[data-field="fix"]')!.value = user.fix
    el.querySelector<HTMLInputElement>(
      `input[name="courseKind"][value="${user.courseKind}"]`,
    )!.checked = true
    if (user.courseDegrees !== undefined) {
      el.querySelector<HTMLInputElement>('[data-field="degrees"]')!.value = String(
        user.courseDegrees,
      )
    }
    const legUnit = el.querySelector<HTMLSelectElement>('[data-field="legUnit"]')!
    if (user.leg === 'published') {
      legUnit.value = 'published'
    } else {
      legUnit.value = user.leg.unit
      el.querySelector<HTMLInputElement>('[data-field="legValue"]')!.value = String(user.leg.value)
    }
    el.querySelector<HTMLInputElement>(
      `input[name="turn"][value="${user.turnDirection}"]`,
    )!.checked = true
    el.querySelector<HTMLInputElement>('[data-field="efc"]')!.value = user.efc
  }

  it('shows the clearance, then hides it and reveals the form after the listen window', () => {
    renderClearanceCopy(el, { seed: SEED_STATED_COURSE, store: testStore() })
    const scenario = generateCopyScenario(SEED_STATED_COURSE)
    const clearance = el.querySelector<HTMLElement>('.copy-clearance')!
    expect(clearance.textContent).toContain(scenario.clearanceText)
    expect(el.querySelector<HTMLElement>('.copy-form')!.hidden).toBe(true)

    vi.advanceTimersByTime(listenMillis(scenario.clearanceText))
    expect(clearance.textContent).not.toContain(scenario.clearanceText)
    expect(el.querySelector<HTMLElement>('.copy-form')!.hidden).toBe(false)
  })

  it('the got-it button hides the clearance immediately', () => {
    renderClearanceCopy(el, { seed: SEED_STATED_COURSE, store: testStore() })
    el.querySelector<HTMLButtonElement>('.copy-gotit')!.click()
    expect(el.querySelector<HTMLElement>('.copy-form')!.hidden).toBe(false)
  })

  it('grades the submitted form and shows the full clearance with citations', () => {
    renderClearanceCopy(el, { seed: SEED_STATED_COURSE, store: testStore() })
    const scenario = generateCopyScenario(SEED_STATED_COURSE)
    el.querySelector<HTMLButtonElement>('.copy-gotit')!.click()
    fillForm(perfectCopy(scenario.expected))
    el.querySelector<HTMLButtonElement>('.copy-submit')!.click()

    const review = el.querySelector<HTMLElement>('.copy-review')!
    expect(review.querySelectorAll('.copy-row')).toHaveLength(6)
    expect(review.querySelectorAll('.copy-row.is-correct')).toHaveLength(6)
    expect(review.textContent).toContain(scenario.clearanceText)
    expect(review.textContent).toContain('JO 7110.65')
    expect(el.querySelector<HTMLElement>('.copy-next')!.hidden).toBe(false)
  })

  it('marks the standard-turns trap row distinctly when copied as left', () => {
    renderClearanceCopy(el, { seed: SEED_UNSTATED_TURNS, store: testStore() })
    const scenario = generateCopyScenario(SEED_UNSTATED_TURNS)
    el.querySelector<HTMLButtonElement>('.copy-gotit')!.click()
    fillForm({ ...perfectCopy(scenario.expected), turnDirection: 'left' })
    el.querySelector<HTMLButtonElement>('.copy-submit')!.click()

    const trapRow = el.querySelector<HTMLElement>('.copy-row.is-trap')!
    expect(trapRow.classList.contains('is-wrong')).toBe(true)
    expect(trapRow.textContent).toMatch(/right turns/)
  })

  it('refuses to grade until a turn direction is chosen', () => {
    renderClearanceCopy(el, { seed: SEED_STATED_COURSE, store: testStore() })
    const scenario = generateCopyScenario(SEED_STATED_COURSE)
    el.querySelector<HTMLButtonElement>('.copy-gotit')!.click()
    fillForm(perfectCopy(scenario.expected))
    for (const radio of el.querySelectorAll<HTMLInputElement>('input[name="turn"]')) {
      radio.checked = false
    }
    el.querySelector<HTMLButtonElement>('.copy-submit')!.click()

    expect(el.querySelector<HTMLElement>('.copy-error')!.textContent).toMatch(/turn/i)
    expect(el.querySelector('.copy-review .copy-row')).toBeNull()
  })

  it('next advances to a fresh scenario in the listening phase', () => {
    renderClearanceCopy(el, { seed: SEED_STATED_COURSE, store: testStore() })
    const scenario = generateCopyScenario(SEED_STATED_COURSE)
    el.querySelector<HTMLButtonElement>('.copy-gotit')!.click()
    fillForm(perfectCopy(scenario.expected))
    el.querySelector<HTMLButtonElement>('.copy-submit')!.click()
    el.querySelector<HTMLButtonElement>('.copy-next')!.click()

    const nextText = generateCopyScenario(SEED_STATED_COURSE + 1).clearanceText
    expect(el.querySelector<HTMLElement>('.copy-clearance')!.textContent).toContain(nextText)
    expect(el.querySelector<HTMLElement>('.copy-form')!.hidden).toBe(true)
  })

  it('clears the previous copy from the form when the next scenario starts', () => {
    renderClearanceCopy(el, { seed: SEED_STATED_COURSE, store: testStore() })
    const scenario = generateCopyScenario(SEED_STATED_COURSE)
    el.querySelector<HTMLButtonElement>('.copy-gotit')!.click()
    fillForm(perfectCopy(scenario.expected))
    el.querySelector<HTMLButtonElement>('.copy-submit')!.click()
    el.querySelector<HTMLButtonElement>('.copy-next')!.click()

    // Stale answers must not carry into the new clearance — especially the
    // turn radios, or the standard-turns trap would grade itself.
    expect(el.querySelector<HTMLInputElement>('[data-field="fix"]')!.value).toBe('')
    expect(el.querySelector<HTMLInputElement>('[data-field="degrees"]')!.value).toBe('')
    expect(el.querySelector<HTMLInputElement>('[data-field="efc"]')!.value).toBe('')
    expect(el.querySelector<HTMLInputElement>('input[name="turn"]:checked')).toBeNull()
  })

  it('switches to the TO/FROM micro-drill and grades a tap', () => {
    renderClearanceCopy(el, { seed: 5, store: testStore() })
    el.querySelector<HTMLButtonElement>('.copy-mode[data-mode="tofrom"]')!.click()

    const scenario = generateToFromScenario(5)
    expect(el.querySelector<HTMLElement>('.tofrom-prompt')!.textContent).toContain(
      scenario.prompt,
    )
    const buttons = el.querySelectorAll<HTMLButtonElement>('.tofrom-answer')
    expect(buttons).toHaveLength(8)
    const correctBtn = [...buttons].find((b) => b.dataset['cardinal'] === scenario.answer)!
    correctBtn.click()
    expect(el.querySelector<HTMLElement>('.tofrom-feedback')!.textContent).toMatch(/Correct/)

    el.querySelector<HTMLButtonElement>('.tofrom-next')!.click()
    expect(el.querySelector<HTMLElement>('.tofrom-prompt')!.textContent).toContain(
      generateToFromScenario(6).prompt,
    )
  })
})

describe('clearanceCopyScreen', () => {
  it('registers the module route', () => {
    expect(clearanceCopyScreen.path).toBe('clearance-copy')
    expect(clearanceCopyScreen.title).toMatch(/Clearance/)
  })
})
