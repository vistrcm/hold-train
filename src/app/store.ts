// Progress store: versioned localStorage persistence for drill stats and
// misses. Misses keep a scenario snapshot so the Anki "my misses" export can
// rebuild the card later. Corrupt or unavailable storage never throws — the
// store degrades to an empty state or an in-memory copy.

export const STATE_VERSION = 1

/** Recent results kept per drill, sized to the entry benchmark window. */
export const RECENT_WINDOW = 20

/** Newest misses kept for the Anki export; older ones are dropped. */
export const MAX_MISSES = 200

/**
 * Entry-drill proficiency target: of the last 20 timed answers, 18 correct in
 * under 10 s each, and 95% answered in under 15 s.
 */
export const ENTRY_BENCHMARK = {
  window: RECENT_WINDOW,
  minCorrectUnderTarget: 18,
  targetSeconds: 10,
  maxSeconds: 15,
  minFractionUnderMax: 0.95,
} as const

export interface DrillResult {
  correct: boolean
  timeSeconds: number
}

export interface DrillStats {
  attempts: number
  correct: number
  totalTimeSeconds: number
  /** Last RECENT_WINDOW results, oldest first. */
  recent: DrillResult[]
}

export interface Miss {
  drill: string
  /** Epoch milliseconds. */
  at: number
  scenario: unknown
}

export interface AppState {
  v: typeof STATE_VERSION
  drills: Record<string, DrillStats>
  misses: Miss[]
}

/** The subset of the Storage API the store needs; localStorage satisfies it. */
export interface StateStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface StoreOptions {
  storage?: StateStorage | undefined
  now?: () => number
}

export interface Store {
  loadState(): AppState
  saveState(state: AppState): void
  recordDrillResult(drill: string, result: DrillResult): AppState
  recordMiss(drill: string, scenario: unknown): AppState
}

const KEY = 'hold-train'

export function emptyState(): AppState {
  return { v: STATE_VERSION, drills: {}, misses: [] }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isDrillResult(x: unknown): x is DrillResult {
  return isRecord(x) && typeof x['correct'] === 'boolean' && Number.isFinite(x['timeSeconds'])
}

function isDrillStats(x: unknown): x is DrillStats {
  return (
    isRecord(x) &&
    Number.isFinite(x['attempts']) &&
    Number.isFinite(x['correct']) &&
    Number.isFinite(x['totalTimeSeconds']) &&
    Array.isArray(x['recent']) &&
    x['recent'].every(isDrillResult)
  )
}

function isMiss(x: unknown): x is Miss {
  return isRecord(x) && typeof x['drill'] === 'string' && Number.isFinite(x['at'])
}

function isAppState(x: unknown): x is AppState {
  return (
    isRecord(x) &&
    x['v'] === STATE_VERSION &&
    isRecord(x['drills']) &&
    Object.values(x['drills']).every(isDrillStats) &&
    Array.isArray(x['misses']) &&
    x['misses'].every(isMiss)
  )
}

function defaultStorage(): StateStorage | undefined {
  // Reading window.localStorage throws SecurityError when the browser blocks
  // site data. This runs at module scope (`export const store` below), so an
  // uncaught throw here would blank the whole app instead of one drill's stats.
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export function createStore(options: StoreOptions = {}): Store {
  const storage = 'storage' in options ? options.storage : defaultStorage()
  const now = options.now ?? Date.now
  // Latest state that could not be persisted (quota exceeded, no storage).
  let memory: AppState | null = null

  function loadState(): AppState {
    if (memory !== null) {
      return structuredClone(memory)
    }
    let raw: string | null
    try {
      raw = storage?.getItem(KEY) ?? null
    } catch {
      return emptyState()
    }
    if (raw === null) {
      return emptyState()
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      return isAppState(parsed) ? parsed : emptyState()
    } catch {
      return emptyState()
    }
  }

  function saveState(state: AppState): void {
    memory = null
    try {
      storage?.setItem(KEY, JSON.stringify(state))
    } catch {
      memory = structuredClone(state)
    }
    if (storage === undefined) {
      memory = structuredClone(state)
    }
  }

  function recordDrillResult(drill: string, result: DrillResult): AppState {
    if (!Number.isFinite(result.timeSeconds) || result.timeSeconds < 0) {
      throw new RangeError(`timeSeconds must be a non-negative number, got ${result.timeSeconds}`)
    }
    const state = loadState()
    const stats = state.drills[drill] ?? {
      attempts: 0,
      correct: 0,
      totalTimeSeconds: 0,
      recent: [],
    }
    stats.attempts += 1
    stats.correct += result.correct ? 1 : 0
    stats.totalTimeSeconds += result.timeSeconds
    stats.recent = [...stats.recent, { ...result }].slice(-RECENT_WINDOW)
    state.drills[drill] = stats
    saveState(state)
    return state
  }

  function recordMiss(drill: string, scenario: unknown): AppState {
    const state = loadState()
    state.misses.push({ drill, at: now(), scenario: structuredClone(scenario) })
    // Bounded so a long study history cannot grow past the storage quota, which
    // fails silently into the memory fallback and loses every stat on reload.
    state.misses = state.misses.slice(-MAX_MISSES)
    saveState(state)
    return state
  }

  return { loadState, saveState, recordDrillResult, recordMiss }
}

/** App-wide store bound to localStorage. */
export const store = createStore()

export function averageTimeSeconds(stats: DrillStats | undefined): number | null {
  if (stats === undefined || stats.attempts === 0) {
    return null
  }
  return stats.totalTimeSeconds / stats.attempts
}

export interface BenchmarkReport {
  /** Results considered (size of the recent window, up to 20). */
  attempts: number
  correct: number
  /** Correct answers under the 10 s target. */
  correctUnderTarget: number
  medianTimeSeconds: number | null
  /** ≥18 of a full 20-result window correct in under 10 s. */
  accuracyMet: boolean
  /** ≥95% of the window answered in under 15 s. */
  speedMet: boolean
  met: boolean
}

/** Scores a drill's recent window against ENTRY_BENCHMARK. */
export function benchmarkReport(stats: DrillStats | undefined): BenchmarkReport {
  const recent = stats?.recent ?? []
  const b = ENTRY_BENCHMARK
  const correct = recent.filter((r) => r.correct).length
  const correctUnderTarget = recent.filter(
    (r) => r.correct && r.timeSeconds < b.targetSeconds,
  ).length
  const underMax = recent.filter((r) => r.timeSeconds < b.maxSeconds).length

  const times = recent.map((r) => r.timeSeconds).sort((x, y) => x - y)
  let medianTimeSeconds: number | null = null
  const mid = Math.floor(times.length / 2)
  if (times.length % 2 === 1) {
    medianTimeSeconds = times[mid] ?? null
  } else if (times.length > 0) {
    medianTimeSeconds = ((times[mid - 1] ?? 0) + (times[mid] ?? 0)) / 2
  }

  const fullWindow = recent.length >= b.window
  const accuracyMet = fullWindow && correctUnderTarget >= b.minCorrectUnderTarget
  const speedMet = recent.length > 0 && underMax / recent.length >= b.minFractionUnderMax
  return {
    attempts: recent.length,
    correct,
    correctUnderTarget,
    medianTimeSeconds,
    accuracyMet,
    speedMet,
    met: accuracyMet && speedMet,
  }
}
