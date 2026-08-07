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

  // router.test.ts drives the home-link chrome only with fake screens; this is
  // the one place a real registered screen renders inside the nav + child
  // container structure through the real hashchange path.
  it('renders a module route with the home-link nav via the real router', () => {
    window.location.hash = '#/learn'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    const app = document.querySelector('#app')!
    expect(app.querySelector('a.home-link')).not.toBeNull()
    const heading = app.querySelector('h1')
    expect(heading).toBeTruthy()
    expect(heading!.textContent).not.toBe('Hold Train')
    window.location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(app.querySelector('a.home-link')).toBeNull()
  })

  // Every other UI test injects `{ store, seed }`, so the no-argument path each
  // screen actually takes in the browser — real localStorage, real clock, seed
  // from Date.now() — is otherwise never executed. A screen that throws there
  // leaves the router's root showing only the home-link nav over an empty
  // container, with the whole suite green.
  it('every registered screen renders from the real default path', () => {
    for (const screen of screens) {
      const el = document.createElement('div')
      expect(() => screen.render(el), `${screen.path} threw`).not.toThrow()
      expect(el.innerHTML.trim(), `${screen.path} rendered nothing`).not.toBe('')
      expect(el.querySelector('h1'), `${screen.path} has no heading`).toBeTruthy()
    }
  })
})
