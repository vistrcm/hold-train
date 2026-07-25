import { describe, it, expect } from 'vitest'
// jsdom implements a simplified cascade and cannot answer "would this really
// render?", so the stylesheet is checked as text. These rules are the ones a
// browser silently breaks and no DOM test can see. `?raw` is Vite's own
// loader — no @types/node, no new dependency.
import CSS from './styles.css?raw'
import { contrastRatio } from './contrast'

/** A colour literal in any of the four hex forms CSS accepts. The negative
 * lookahead keeps ID selectors (`#app`) and longer identifiers out. */
const HEX_LITERAL = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g

function rootBlock(css: string): string {
  const match = css.match(/:root\s*\{([\s\S]*?)\}/)
  if (!match?.[1]) throw new Error('styles.css has no :root block')
  return match[1]
}

/** `--name: #value` pairs declared in `:root`, the only colours in the app's
 * stylesheet once the no-stray-hex rule below holds. */
function palette(css: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, value] of rootBlock(css).matchAll(
    /(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g,
  )) {
    found.set(name!, value!)
  }
  return found
}

describe('styles.css', () => {
  // Vitest blanks CSS imports unless `test.css.include` matches, and an empty
  // string would let both assertions below pass vacuously.
  it('is actually loaded', () => {
    expect(CSS.length).toBeGreaterThan(1000)
  })

  // Every screen hides elements with the `hidden` attribute (`.copy-form`,
  // `.entry-next`, `.written-figure`, ...). That attribute only works through a
  // UA-stylesheet rule, which ANY author `display` declaration outranks by
  // cascade origin — so without an explicit author rule, adding `display` to a
  // hidden-toggled element silently stops hiding it.
  it('forces [hidden] to win over author display declarations', () => {
    const rule = /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/
    expect(CSS).toMatch(rule)
  })

  it('defines every custom property it references', () => {
    const defined = new Set<string>()
    for (const [, name] of CSS.matchAll(/^\s*(--[\w-]+):/gm)) {
      defined.add(name!)
    }
    const used = new Set<string>()
    for (const [, name] of CSS.matchAll(/var\(\s*(--[\w-]+)/g)) {
      used.add(name!)
    }
    // A `var(--x, fallback)` that silently resolves to the fallback is how the
    // dashboard ended up with an off-palette, sub-4.5:1 "Ready" colour.
    expect([...used].filter((name) => !defined.has(name))).toEqual([])
  })

  // The app renders on paper-white surfaces; `color-scheme` is what tells the
  // browser to match its own widgets (form controls, scrollbars, the canvas
  // before the stylesheet lands) to that, so it cannot be left on `dark`.
  it('declares a light color-scheme', () => {
    expect(CSS).toMatch(/color-scheme:\s*light\s*;/)
    expect(CSS).not.toMatch(/color-scheme:\s*dark/)
  })

  // The `var()`-is-defined test above can only see colours that already go
  // through a custom property, so a raw literal escapes both it and the
  // contrast check below. Forcing every colour into `:root` is what makes the
  // palette the single place a colour can enter the stylesheet.
  it('declares every colour in :root and nowhere else', () => {
    const root = rootBlock(CSS)
    // Non-vacuous: the rule is only meaningful if :root really holds the palette.
    expect(root.match(HEX_LITERAL)?.length ?? 0).toBeGreaterThanOrEqual(7)
    const outside = CSS.replace(root, '').match(HEX_LITERAL) ?? []
    expect(outside).toEqual([])
  })

  // Computed, not eyeballed. WCAG SC 1.4.3 wants 4.5:1 for normal text and
  // SC 1.4.11 wants 3:1 for UI component boundaries; neither may be met by
  // rounding a computed value up, so the raw ratio is compared.
  it('clears WCAG contrast for every palette role', () => {
    const colours = palette(CSS)
    const bg = colours.get('--bg')
    const surface = colours.get('--surface')
    expect(bg).toBeDefined()
    expect(surface).toBeDefined()

    const roles: ReadonlyArray<readonly [string, number]> = [
      ['--text', 4.5],
      ['--text-dim', 4.5],
      ['--accent', 4.5],
      ['--ok', 4.5],
      ['--err', 4.5],
      // A border is a graphical object, not text: 3:1 per SC 1.4.11.
      ['--border', 3],
    ]

    const failures: string[] = []
    for (const [name, min] of roles) {
      const value = colours.get(name)
      if (!value) {
        failures.push(`${name} is not declared in :root`)
        continue
      }
      for (const [backdrop, against] of [
        ['--bg', bg!],
        ['--surface', surface!],
      ] as const) {
        const ratio = contrastRatio(value, against)
        if (ratio < min) {
          failures.push(`${name} on ${backdrop}: ${ratio.toFixed(2)} < ${min}`)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
