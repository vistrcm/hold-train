// The route registry lives in main.ts (project convention), and main.ts
// boots the router on import — so this test provides the #app root first and
// imports dynamically. Testing the REAL registry closes the gap where a
// screen exists as a module but was never registered: its links would pass
// screen-object tests yet 404 to home in the app.

import { beforeAll, describe, expect, it } from 'vitest'
import type { Screen } from './app/router'
import { LESSONS } from './content/lessons'

let screens: Screen[]

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>'
  ;({ screens } = await import('./main'))
})

describe('route registry (main.ts)', () => {
  it('registers all eight screens under unique paths', () => {
    const paths = screens.map((s) => s.path)
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toEqual(
      expect.arrayContaining([
        'learn',
        'entry-drill',
        'written-test',
        'oral-prep',
        'wind-lab',
        'clearance-copy',
        'anki',
        'dashboard',
      ]),
    )
  })

  it('every lesson drill link targets a registered route', () => {
    const paths = new Set(screens.map((s) => s.path))
    for (const lesson of LESSONS) {
      expect(paths.has(lesson.drillPath), `${lesson.id}: ${lesson.drillPath}`).toBe(true)
    }
  })

  it('boots the router into the #app root', () => {
    expect(document.querySelector('#app')!.innerHTML).not.toBe('')
  })
})
