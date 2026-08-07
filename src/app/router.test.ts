import { describe, it, expect, beforeEach } from 'vitest'
import README from '../../README.md?raw'
import { createRouter, type Screen } from './router'

// The label exists as two hand-written copies: router.ts renders it, README
// states it. Both assertions below read this constant, so renaming the link in
// router.ts alone fails the DOM pin, and updating the constant alone fails the
// README pin until the prose says the same thing.
const HOME_LABEL = '← Home'

function screen(path: string, title: string): Screen & { renders: number } {
  const s = {
    path,
    title,
    renders: 0,
    render(el: HTMLElement) {
      s.renders++
      el.textContent = title
    },
  }
  return s
}

describe('createRouter', () => {
  let root: HTMLElement
  let a: ReturnType<typeof screen>
  let b: ReturnType<typeof screen>

  beforeEach(() => {
    root = document.createElement('div')
    a = screen('entry-drill', 'Entry Drill')
    b = screen('written-test', 'Written Test')
    window.location.hash = ''
  })

  it('resolves a registered route from its hash', () => {
    const router = createRouter([a, b], root)
    expect(router.resolve('#/written-test')).toBe(b)
  })

  it('resolves empty hash to the home screen', () => {
    const router = createRouter([a, b], root)
    const home = router.resolve('')
    expect(home.path).toBe('')
    expect(router.resolve('#/')).toBe(home)
  })

  it('falls back to home for unknown routes', () => {
    const router = createRouter([a, b], root)
    expect(router.resolve('#/no-such-module').path).toBe('')
  })

  it('home screen lists all registered modules as hash links', () => {
    const router = createRouter([a, b], root)
    router.resolve('').render(root)
    const links = [...root.querySelectorAll('a')].map((el) => el.getAttribute('href'))
    expect(links).toContain('#/entry-drill')
    expect(links).toContain('#/written-test')
  })

  it('renderCurrent renders the screen for the current location hash', () => {
    const router = createRouter([a, b], root)
    window.location.hash = '#/entry-drill'
    router.renderCurrent()
    expect(root.textContent).toContain('Entry Drill')
    expect(root.querySelector('a.home-link')).not.toBeNull()
    expect(a.renders).toBe(1)
  })

  // start() registers a window hashchange listener with no teardown, so started
  // routers outlive their test. Harmless while every test builds a fresh root
  // and fixtures, but a test must not count renders after another dispatch.
  it('re-renders when the hash changes', async () => {
    const router = createRouter([a, b], root)
    router.start()
    window.location.hash = '#/written-test'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(root.textContent).toContain('Written Test')
    expect(root.querySelector('a.home-link')).not.toBeNull()
  })

  it('renders a home link pointing at #/ on module screens', () => {
    const router = createRouter([a, b], root)
    window.location.hash = '#/entry-drill'
    router.renderCurrent()
    const link = root.querySelector('a.home-link')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('#/')
    expect(link!.textContent).toBe(HOME_LABEL)
  })

  it('README states the same label the router renders', () => {
    // README is an asserted artifact here (dashboard.test.ts diffs its route
    // table); a comment-only "keep them in sync" is the drift class this repo
    // closes with ?raw imports.
    expect(README).toContain(HOME_LABEL)
  })

  it('renderCurrent falls back to home without a home link for unknown routes', () => {
    const router = createRouter([a, b], root)
    window.location.hash = '#/no-such-module'
    router.renderCurrent()
    expect(root.querySelector('a.home-link')).toBeNull()
    expect(root.textContent).toContain('Hold Train')
  })

  it('does not render the home link on the home screen', () => {
    const router = createRouter([a, b], root)
    window.location.hash = ''
    router.renderCurrent()
    expect(root.querySelector('a.home-link')).toBeNull()
    expect(root.textContent).toContain('Hold Train')
  })

  it('renders the screen content alongside the nav, not clobbered by it', () => {
    // real screens write innerHTML on the element they're given — handing them
    // root instead of a child container would wipe the nav
    const c: Screen = {
      path: 'wind-lab',
      title: 'Wind Lab',
      render(el) {
        el.innerHTML = '<h1>Wind Lab</h1>'
      },
    }
    const router = createRouter([a, b, c], root)
    window.location.hash = '#/wind-lab'
    router.renderCurrent()
    expect(root.firstElementChild!.tagName).toBe('NAV')
    expect(root.querySelector('nav a.home-link')).not.toBeNull()
    expect(root.querySelector('h1')!.textContent).toBe('Wind Lab')
  })

  it('hashchange back to home re-renders without the home link', () => {
    const router = createRouter([a, b], root)
    router.start()
    window.location.hash = '#/entry-drill'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(root.querySelector('a.home-link')).not.toBeNull()
    window.location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    expect(root.querySelector('a.home-link')).toBeNull()
    expect(root.textContent).toContain('Hold Train')
  })
})

// CLAUDE.md: the router owns all chrome around screens, and screens must not
// add their own home/back links. Nothing structural stops a module from
// rendering a second one (two stacked home links, suite green), so pin the
// convention the way this repo pins its others: scan the shipping sources.
describe('home-link ownership', () => {
  const MODULES = import.meta.glob<string>('../modules/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  it('no screen module renders its own home link', () => {
    const shipping = Object.entries(MODULES).filter(([path]) => !path.endsWith('.test.ts'))
    expect(shipping.length, 'glob matched no module files').toBeGreaterThan(0)
    for (const [path, source] of shipping) {
      // exact 'href="#/"' only — module links to sibling routes ('#/entry-drill')
      // are legitimate and do not match
      expect(source, `${path} renders its own home link — the router owns that chrome`)
        .not.toContain('home-link')
      expect(source, `${path} links to home — the router owns that chrome`)
        .not.toContain('href="#/"')
    }
  })
})
