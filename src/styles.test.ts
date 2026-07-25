import { describe, it, expect } from 'vitest'
// jsdom implements a simplified cascade and cannot answer "would this really
// render?", so the stylesheet is checked as text. These rules are the ones a
// browser silently breaks and no DOM test can see. `?raw` is Vite's own
// loader — no @types/node, no new dependency.
import CSS from './styles.css?raw'
import { COLOUR_LITERAL, CSS_NAMED_COLOURS, contrastRatio } from './contrast'

/** What a colour does decides its threshold: SC 1.4.3 asks 4.5:1 of text,
 * SC 1.4.11 asks 3:1 of a graphical object. `backdrop` names the two surfaces
 * every other role is measured against.
 *
 * Every colour in `:root` must appear here — the test below fails on one that
 * does not, rather than skipping it. A hand-listed set of roles measured only
 * what existed when the list was typed, so a new `--warn` could be added and
 * ship with zero contrast assertions. */
const TIERS: Readonly<Record<string, 'text' | 'graphic' | 'backdrop'>> = {
  '--bg': 'backdrop',
  '--surface': 'backdrop',
  '--text': 'text',
  '--text-dim': 'text',
  '--accent': 'text',
  '--ok': 'text',
  '--err': 'text',
  '--border': 'graphic',
}

const MINIMUM = { text: 4.5, graphic: 3 } as const

function rootBlock(css: string): string {
  const match = css.match(/:root\s*\{([\s\S]*?)\}/)
  if (!match?.[1]) throw new Error('styles.css has no :root block')
  return match[1]
}

/** Every `--name: value` pair declared in `:root`, colour or not — the type
 * scale and `--touch` live there too. Harvested generically rather than by
 * matching `#`: a regex that only sees hex silently drops `--warn: orange` from
 * the palette, and a value nothing harvests is a value nothing classifies and
 * nothing measures. */
function rootProps(css: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const [, name, value] of rootBlock(css).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    found.set(name!, value!.trim())
  }
  return found
}

/** A `:root` value that carries no colour: a length or a bare number. */
const SCALE = /^-?[\d.]+(?:px|rem|em|ch|%|s|ms)?$/

const HEX = /^#[0-9a-fA-F]{3,8}$/

/** The `--name: #value` pairs, the only colours in the app's stylesheet once
 * the two rules below hold. */
function palette(css: string): Map<string, string> {
  return new Map([...rootProps(css)].filter(([, value]) => HEX.test(value)))
}

/** Declaration values outside `:root`, with comments and quoted strings removed
 * so prose and font names cannot be mistaken for a paint. Property names are
 * excluded — only what sits right of the colon is scanned. */
function declarationValues(css: string): Array<readonly [string, string]> {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/'[^']*'|"[^"]*"/g, ' ')
  const outside = code.replace(rootBlock(code), ' ')
  // A plain ident then `:` then a value terminated by `;` — selectors such as
  // `p:first-child {` or `input:not([type=])` end in `{` or `,` and never match.
  return [...outside.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map(
    ([, prop, value]) => [prop!, value!] as const,
  )
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
  // palette the single place a colour can enter the stylesheet. The functional
  // notations count too — the guard used to match hex only, so the notation it
  // could not see was a free way back in.
  it('declares every colour in :root and nowhere else', () => {
    const root = rootBlock(CSS)
    // Non-vacuous: the rule is only meaningful if :root really holds the palette.
    expect(root.match(COLOUR_LITERAL)?.length ?? 0).toBeGreaterThanOrEqual(7)
    const outside = CSS.replace(root, '').match(COLOUR_LITERAL) ?? []
    expect(outside).toEqual([])
  })

  // The third notation, and the one the scan above is blind to by construction:
  // `COLOUR_LITERAL` omits named colours because matching bare words against
  // TypeScript prose is all false positives. In CSS a declaration value is a
  // bounded grammar, so the same word can be matched safely — `color: crimson`
  // used to pass every guard in this file.
  it('paints with no named colour outside :root', () => {
    const values = declarationValues(CSS)
    // Non-vacuous: a harvest that matched nothing — one stray character in the
    // declaration regex does it — passes this for any stylesheet at all.
    expect(values.length, 'declaration harvest found nothing').toBeGreaterThan(50)
    expect(values.some(([prop]) => prop === 'background')).toBe(true)

    const strays: string[] = []
    for (const [prop, value] of values) {
      for (const word of value.toLowerCase().match(/[a-z]+/g) ?? []) {
        if (CSS_NAMED_COLOURS.has(word)) strays.push(`${prop}: ${value.trim()}`)
      }
    }
    expect(strays, 'route colours through a var(--x) declared in :root').toEqual([])
  })

  // A `:root` colour the harvest cannot read is a colour the role table cannot
  // classify and the oracle cannot measure — it would ship with zero assertions
  // exactly like an unlisted role. `contrastRatio` reads hex, so hex it is.
  it('declares every :root colour as a hex the oracle can read', () => {
    const unreadable = [...rootProps(CSS)]
      .filter(([, value]) => !HEX.test(value) && !SCALE.test(value))
      .map(([name, value]) => `${name}: ${value}`)
    expect(unreadable, 'a :root value must be a #hex colour or a length').toEqual([])
  })

  // The contrast test below can only judge roles it is told about, so the role
  // table has to cover the palette exhaustively rather than sample it.
  it('classifies every colour declared in :root', () => {
    const unclassified = [...palette(CSS).keys()].filter((name) => !(name in TIERS))
    expect(unclassified, 'add these to TIERS as text/graphic/backdrop').toEqual([])
  })

  // Computed, not eyeballed. WCAG SC 1.4.3 wants 4.5:1 for normal text and
  // SC 1.4.11 wants 3:1 for UI component boundaries; neither may be met by
  // rounding a computed value up, so the raw ratio is compared.
  it('clears WCAG contrast for every palette role', () => {
    const colours = palette(CSS)
    const backdrops = [...colours].filter(([name]) => TIERS[name] === 'backdrop')
    expect(backdrops.map(([name]) => name).sort()).toEqual(['--bg', '--surface'])

    const failures: string[] = []
    for (const [name, value] of colours) {
      const tier = TIERS[name]
      if (tier === undefined || tier === 'backdrop') continue
      for (const [backdrop, against] of backdrops) {
        const ratio = contrastRatio(value, against)
        if (ratio < MINIMUM[tier]) {
          failures.push(`${name} on ${backdrop}: ${ratio.toFixed(2)} < ${MINIMUM[tier]}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  // The two backdrops are 1.13:1 apart, so a `background: var(--surface)` tile
  // on the `--bg` page has no edge a browser can draw — SC 1.4.11 asks 3:1 of
  // an interactive component's visual boundary. The largest tap targets in the
  // app (every answer button, every home-screen module tile) therefore carry an
  // explicit `--border` edge instead of relying on the fill difference.
  it('gives surface-filled tap targets a boundary the fill cannot supply', () => {
    const colours = palette(CSS)
    const bg = colours.get('--bg')!
    const surface = colours.get('--surface')!
    const border = colours.get('--border')!
    // Why the rule exists: if these two ever diverge enough, drop it knowingly.
    expect(contrastRatio(surface, bg)).toBeLessThan(3)
    expect(contrastRatio(border, bg)).toBeGreaterThanOrEqual(3)
    expect(CSS).toMatch(/button,\s*\.module-link\s*\{[^}]*border:\s*1px solid var\(--border\)/)
    // `border: none` here would outrank the shared rule by source order.
    expect(CSS).not.toMatch(/\bbutton\s*\{[^}]*border:\s*none/)
  })
})
