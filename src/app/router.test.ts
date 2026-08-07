import { describe, it, expect, beforeEach } from 'vitest'
import { createRouter, type Screen } from './router'

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
  })

  it('does not render the home link on the home screen', () => {
    const router = createRouter([a, b], root)
    window.location.hash = ''
    router.renderCurrent()
    expect(root.querySelector('a.home-link')).toBeNull()
    expect(root.textContent).toContain('Hold Train')
  })

  it('renders the screen content alongside the nav, not clobbered by it', () => {
    const router = createRouter([a, b], root)
    window.location.hash = '#/written-test'
    router.renderCurrent()
    expect(root.querySelector('a.home-link')).not.toBeNull()
    expect(root.textContent).toContain('Written Test')
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
