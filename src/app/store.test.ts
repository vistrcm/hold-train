import { describe, it, expect, beforeEach } from 'vitest'
import {
  ENTRY_BENCHMARK,
  MAX_MISSES_PER_DRILL,
  RECENT_WINDOW,
  type AppState,
  type DrillResult,
  type StateStorage,
  averageTimeSeconds,
  benchmarkReport,
  createStore,
  emptyState,
} from './store'

function memStorage(): StateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

function result(correct: boolean, timeSeconds: number): DrillResult {
  return { correct, timeSeconds }
}

/** Stats whose recent window is exactly the given results, most recent last. */
function statsFrom(results: DrillResult[]): AppState['drills'][string] {
  return {
    attempts: results.length,
    correct: results.filter((r) => r.correct).length,
    totalTimeSeconds: results.reduce((sum, r) => sum + r.timeSeconds, 0),
    recent: results,
  }
}

describe('emptyState', () => {
  it('is versioned and empty', () => {
    expect(emptyState()).toEqual({ v: 1, drills: {}, misses: [] })
  })
})

describe('loadState / saveState', () => {
  it('round-trips a saved state', () => {
    const storage = memStorage()
    const store = createStore({ storage })
    const state = emptyState()
    state.drills['entry'] = statsFrom([result(true, 7.5)])
    state.misses.push({ drill: 'entry', at: 123, scenario: { heading: 90 } })
    store.saveState(state)
    expect(store.loadState()).toEqual(state)
  })

  it('a fresh store on the same storage sees the saved state', () => {
    const storage = memStorage()
    createStore({ storage }).saveState({
      ...emptyState(),
      misses: [{ drill: 'oral', at: 1, scenario: 'q1' }],
    })
    expect(createStore({ storage }).loadState().misses).toHaveLength(1)
  })

  it('returns empty state when nothing is stored', () => {
    expect(createStore({ storage: memStorage() }).loadState()).toEqual(emptyState())
  })

  it('returns empty state on corrupt JSON without throwing', () => {
    const storage = memStorage()
    storage.data.set('hold-train', '{not json!!')
    expect(createStore({ storage }).loadState()).toEqual(emptyState())
  })

  it('returns empty state on unknown version', () => {
    const storage = memStorage()
    storage.data.set('hold-train', JSON.stringify({ v: 99, drills: {}, misses: [] }))
    expect(createStore({ storage }).loadState()).toEqual(emptyState())
  })

  it('returns empty state on malformed shape', () => {
    const storage = memStorage()
    storage.data.set('hold-train', JSON.stringify({ v: 1, drills: [], misses: {} }))
    expect(createStore({ storage }).loadState()).toEqual(emptyState())
  })

  it('returns empty state on malformed drill stats', () => {
    const storage = memStorage()
    storage.data.set(
      'hold-train',
      JSON.stringify({ v: 1, drills: { entry: { attempts: 'many' } }, misses: [] }),
    )
    expect(createStore({ storage }).loadState()).toEqual(emptyState())
  })

  it('returns empty state when storage.getItem throws (localStorage disabled)', () => {
    const store = createStore({
      storage: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {},
      },
    })
    expect(store.loadState()).toEqual(emptyState())
  })

  it('falls back to in-memory state when setItem throws (quota exceeded)', () => {
    const store = createStore({
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
    })
    const state = { ...emptyState(), misses: [{ drill: 'entry', at: 5, scenario: null }] }
    expect(() => store.saveState(state)).not.toThrow()
    expect(store.loadState()).toEqual(state)
  })

  it('works with no storage at all (memory only)', () => {
    const store = createStore({ storage: undefined })
    const state = { ...emptyState(), misses: [{ drill: 'entry', at: 5, scenario: null }] }
    store.saveState(state)
    expect(store.loadState()).toEqual(state)
  })

  it('defaults to window.localStorage', () => {
    localStorage.clear()
    const store = createStore()
    store.saveState({ ...emptyState(), misses: [{ drill: 'x', at: 9, scenario: 1 }] })
    expect(localStorage.getItem('hold-train')).not.toBeNull()
    expect(createStore().loadState().misses).toHaveLength(1)
    localStorage.clear()
  })
})

describe('recordDrillResult', () => {
  let storage: ReturnType<typeof memStorage>
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    storage = memStorage()
    store = createStore({ storage })
  })

  it('accumulates attempts, correct count, and average time', () => {
    store.recordDrillResult('entry', result(true, 8))
    const state = store.recordDrillResult('entry', result(false, 12))
    const stats = state.drills['entry']
    expect(stats).toBeDefined()
    expect(stats?.attempts).toBe(2)
    expect(stats?.correct).toBe(1)
    expect(averageTimeSeconds(stats)).toBe(10)
  })

  it('persists results across store instances', () => {
    store.recordDrillResult('entry', result(true, 8))
    expect(createStore({ storage }).loadState().drills['entry']?.attempts).toBe(1)
  })

  it('tracks drills independently', () => {
    store.recordDrillResult('entry', result(true, 8))
    const state = store.recordDrillResult('written', result(false, 30))
    expect(state.drills['entry']?.attempts).toBe(1)
    expect(state.drills['written']?.attempts).toBe(1)
  })

  it(`keeps only the last ${RECENT_WINDOW} results in the recent window`, () => {
    let state = emptyState()
    for (let i = 0; i < RECENT_WINDOW + 5; i++) {
      state = store.recordDrillResult('entry', result(true, i))
    }
    const stats = state.drills['entry']
    expect(stats?.attempts).toBe(RECENT_WINDOW + 5)
    expect(stats?.recent).toHaveLength(RECENT_WINDOW)
    expect(stats?.recent[0]?.timeSeconds).toBe(5)
    expect(stats?.recent[RECENT_WINDOW - 1]?.timeSeconds).toBe(RECENT_WINDOW + 4)
  })

  it('rejects non-finite times as programming errors', () => {
    expect(() => store.recordDrillResult('entry', result(true, NaN))).toThrow(RangeError)
    expect(() => store.recordDrillResult('entry', result(true, Infinity))).toThrow(RangeError)
  })

  it('clamps a negative time to 0 rather than throwing (backward clock skew)', () => {
    // Controllers derive time from Date.now() deltas; a backward clock jump can
    // hand this a negative. Throwing would escape the drill's click handler and
    // wedge the screen, so the store absorbs it.
    const state = store.recordDrillResult('entry', result(true, -1))
    const stats = state.drills['entry']
    expect(stats?.totalTimeSeconds).toBe(0)
    expect(stats?.recent[0]?.timeSeconds).toBe(0)
  })
})

describe('recordMiss', () => {
  it('records drill id, timestamp, and a scenario snapshot', () => {
    const store = createStore({ storage: memStorage(), now: () => 42 })
    const state = store.recordMiss('entry', { heading: 90, inboundCourse: 270 })
    expect(state.misses).toEqual([
      { drill: 'entry', at: 42, scenario: { heading: 90, inboundCourse: 270 } },
    ])
  })

  it('snapshots the scenario so later mutation does not alter the record', () => {
    const store = createStore({ storage: memStorage() })
    const scenario = { heading: 90 }
    store.recordMiss('entry', scenario)
    scenario.heading = 180
    expect(store.loadState().misses[0]?.scenario).toEqual({ heading: 90 })
  })

  it('appends misses in order', () => {
    const store = createStore({ storage: memStorage() })
    store.recordMiss('entry', 'a')
    const state = store.recordMiss('oral', 'b')
    expect(state.misses.map((m) => m.drill)).toEqual(['entry', 'oral'])
  })
})

describe('benchmarkReport', () => {
  const fullWindow = (make: (i: number) => DrillResult): DrillResult[] =>
    Array.from({ length: ENTRY_BENCHMARK.window }, (_, i) => make(i))

  it('reports zeroes for missing stats', () => {
    const report = benchmarkReport(undefined)
    expect(report).toEqual({
      attempts: 0,
      correct: 0,
      correctUnderTarget: 0,
      medianTimeSeconds: null,
      accuracyMet: false,
      speedMet: false,
      met: false,
    })
  })

  it('passes a perfect window', () => {
    const report = benchmarkReport(statsFrom(fullWindow(() => result(true, 5))))
    expect(report.attempts).toBe(20)
    expect(report.correctUnderTarget).toBe(20)
    expect(report.medianTimeSeconds).toBe(5)
    expect(report).toMatchObject({ accuracyMet: true, speedMet: true, met: true })
  })

  it('fails accuracy with only 17/20 correct under 10 s', () => {
    const report = benchmarkReport(
      statsFrom(fullWindow((i) => (i < 17 ? result(true, 5) : result(false, 5)))),
    )
    expect(report.correctUnderTarget).toBe(17)
    expect(report).toMatchObject({ accuracyMet: false, speedMet: true, met: false })
  })

  it('boundary: a correct answer at exactly 10 s is not under the target', () => {
    // "under 10 s" is strict — an answer AT the target does not count
    const report = benchmarkReport(
      statsFrom(fullWindow((i) => result(true, i < 17 ? 5 : ENTRY_BENCHMARK.targetSeconds))),
    )
    expect(report.correctUnderTarget).toBe(17)
    expect(report.accuracyMet).toBe(false)
  })

  it('boundary: answers at exactly 15 s are not under the max', () => {
    const report = benchmarkReport(
      statsFrom(fullWindow(() => result(true, ENTRY_BENCHMARK.maxSeconds))),
    )
    expect(report.speedMet).toBe(false)
  })

  it('a correct answer slower than 10 s does not count toward accuracy', () => {
    const report = benchmarkReport(
      statsFrom(fullWindow((i) => (i < 3 ? result(true, 11) : result(true, 5)))),
    )
    expect(report.correct).toBe(20)
    expect(report.correctUnderTarget).toBe(17)
    expect(report.accuracyMet).toBe(false)
  })

  it('speed allows one of 20 at or over 15 s (95%) but not two', () => {
    const one = benchmarkReport(
      statsFrom(fullWindow((i) => (i === 0 ? result(true, 16) : result(true, 5)))),
    )
    expect(one.speedMet).toBe(true)
    const two = benchmarkReport(
      statsFrom(fullWindow((i) => (i < 2 ? result(true, 16) : result(true, 5)))),
    )
    expect(two.speedMet).toBe(false)
  })

  it('is not met before a full window of attempts', () => {
    // speedMet included: the dashboard prints it on its own line, so two fast
    // answers must not read as "95% under 15 s: yes".
    const report = benchmarkReport(statsFrom([result(true, 5), result(true, 5)]))
    expect(report.attempts).toBe(2)
    expect(report).toMatchObject({ accuracyMet: false, speedMet: false, met: false })
  })

  it('computes the median over the recent window (even count averages middle pair)', () => {
    const report = benchmarkReport(
      statsFrom([result(true, 4), result(true, 6), result(true, 8), result(true, 20)]),
    )
    expect(report.medianTimeSeconds).toBe(7)
  })
})

describe('averageTimeSeconds', () => {
  it('is null with no attempts', () => {
    expect(averageTimeSeconds(undefined)).toBeNull()
    expect(averageTimeSeconds(statsFrom([]))).toBeNull()
  })
})

describe('miss retention', () => {
  it(`keeps the newest ${MAX_MISSES_PER_DRILL} misses so storage cannot grow without bound`, () => {
    // An overflowing quota fails into the in-memory fallback, which silently
    // loses every drill stat on the next reload.
    const store = createStore({ storage: memStorage(), now: () => 0 })
    for (let i = 0; i < MAX_MISSES_PER_DRILL + 25; i++) {
      store.recordMiss('entry', { n: i })
    }
    const misses = store.loadState().misses
    expect(misses).toHaveLength(MAX_MISSES_PER_DRILL)
    expect((misses[0]!.scenario as { n: number }).n).toBe(25)
    expect((misses.at(-1)!.scenario as { n: number }).n).toBe(MAX_MISSES_PER_DRILL + 24)
  })

  it('does not let one drill evict another drill’s misses', () => {
    // clearance-copy, to-from and wind-lab misses are recorded but produce no
    // Anki cards. Under a shared cap a long session on those silently emptied
    // the personalized deck of exactly the entry/written cards it exists for.
    // Ticking clock: with a frozen one every `at` is equal and the ordering
    // assertion below passes no matter how the trim reshuffles the array.
    let t = 0
    const store = createStore({ storage: memStorage(), now: () => (t += 1) })
    store.recordMiss('entry', { n: 'first entry miss' })
    for (let i = 0; i < MAX_MISSES_PER_DRILL + 50; i++) {
      store.recordMiss('clearance-copy', { n: i })
    }
    const misses = store.loadState().misses
    expect(misses.filter((m) => m.drill === 'entry')).toHaveLength(1)
    expect(misses.filter((m) => m.drill === 'clearance-copy')).toHaveLength(
      MAX_MISSES_PER_DRILL,
    )
    // Chronological order survives the per-drill trim.
    expect(misses[0]!.drill).toBe('entry')
    expect(new Set(misses.map((m) => m.at)).size).toBe(misses.length)
    expect(misses.map((m) => m.at)).toEqual([...misses.map((m) => m.at)].sort((a, b) => a - b))
  })
})
