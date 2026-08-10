import { describe, it, expect } from 'vitest'
// jsdom implements a simplified cascade and cannot answer "would this really
// render?", so the stylesheet is checked as text. These rules are the ones a
// browser silently breaks and no DOM test can see. `?raw` is Vite's own
// loader — no @types/node, no new dependency.
import CSS from './styles.css?raw'
import { COLOUR_LITERAL, CSS_NAMED_COLOURS, HEX_COLOUR, contrastRatio } from './contrast'

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

/** The declarations of one rule, by exact selector. Comments are stripped first
 * so prose naming a class cannot be mistaken for the rule itself.
 *
 * Two different ways of reading the wrong rule, guarded separately: the
 * trailing `\s*\{` is what stops `.entry-answers` harvesting
 * `.entry-answers-label`'s block (the brace must follow the selector, so a
 * longer name never matches), and the leading boundary is what stops it
 * harvesting a *compound* rule that merely ends in it, `.foo.entry-answers`.
 * Only the second needs the boundary — don't merge the two claims, because a
 * later reader who thinks the boundary handles the suffix case will delete the
 * part that actually does. Both return a block silently, so a mis-read is a
 * green test computing its ratio from some other rule's numbers. */
function ruleBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const match = code.match(new RegExp(`(?:^|[};,\\s])${escaped}\\s*\\{([^}]*)\\}`))
  if (match?.[1] === undefined) throw new Error(`styles.css has no ${selector} rule`)
  return match[1]
}

/** One declaration's value as a number of `rem`. Throws rather than handing
 * back `NaN`: both `NaN >= x` and `NaN < x` are false, so a mis-parse would
 * leave a comparison passing for whatever the stylesheet actually said.
 * Unitless `0` is the one length CSS lets you write without a unit; every other
 * notation (px, em, calc) is refused, because comparing two authored lengths
 * only means something when they share a unit. */
function remValue(block: string, prop: string): number {
  const match = block.match(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`))
  const raw = match?.[1]?.trim()
  if (raw === undefined) throw new Error(`no ${prop} declared in {${block.trim()}}`)
  if (raw === '0') return 0
  const rem = raw.match(/^([\d.]+)rem$/)
  const value = Number(rem?.[1])
  if (!Number.isFinite(value)) throw new Error(`${prop}: ${raw} is not a rem length`)
  return value
}

/** Every `--name: value` pair declared in `:root`, colour or not — the type
 * scale and `--touch` live there too. Harvested generically rather than by
 * matching `#`: a regex that only sees hex silently drops `--warn: orange` from
 * the palette, and a value nothing harvests is a value nothing classifies and
 * nothing measures. */
function rootProps(css: string): Map<string, string> {
  const found = new Map<string, string>()
  // The `;` is optional: CSS lets the last declaration of a block omit it, and
  // a harvest that demands one silently drops that declaration. `rootBlock`
  // returns the content without its closing brace, so end-of-string is the
  // other terminator here.
  for (const [, name, value] of rootBlock(css).matchAll(/(--[\w-]+):\s*([^;}]+?)\s*(?=[;}]|$)/g)) {
    found.set(name!, value!.trim())
  }
  return found
}

/** A `:root` value that carries no colour: a length or a bare number. */
const SCALE = /^-?[\d.]+(?:px|rem|em|ch|%|s|ms)?$/

/** The `--name: #value` pairs, the only colours in the app's stylesheet once
 * the two rules below hold. `HEX_COLOUR` comes from the oracle rather than
 * being retyped here, so "is a colour" and "is a colour `contrastRatio` can
 * read" cannot diverge — a local `{3,8}` copy admitted `#rrggbbaa`, which then
 * threw from inside the contrast test with the palette test still green. */
function palette(css: string): Map<string, string> {
  return new Map([...rootProps(css)].filter(([, value]) => HEX_COLOUR.test(value)))
}

/** Declaration values outside `:root`, with comments and quoted strings removed
 * so prose and font names cannot be mistaken for a paint. Property names are
 * excluded — only what sits right of the colon is scanned. */
function declarationValues(css: string): Array<readonly [string, string]> {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/'[^']*'|"[^"]*"/g, ' ')
  const outside = code.replace(rootBlock(code), ' ')
  // A plain ident then `:` then a value terminated by `;` OR by the block's
  // closing `}` — selectors such as `p:first-child {` or `@media (min-width:
  // 640px) {` end in `{` and never match, because `{` is neither a legal value
  // character nor a terminator. The `}` alternative is not optional polish: CSS
  // lets the last declaration of a block omit its semicolon, and demanding one
  // let `{ ...; color: crimson }` past the named-colour scan below — the one
  // notation that scan exists to catch.
  return [...outside.matchAll(/([\w-]+)\s*:\s*([^;{}]+?)\s*(?=[;}])/g)].map(
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

  // The scan above is only as good as the harvest under it, and a harvest that
  // required a trailing `;` read right past the last declaration of every block
  // — where a hand-formatted stylesheet is exactly where the semicolon gets
  // left off. Pinned against a synthetic sheet rather than the real one, so the
  // guard keeps holding after someone tidies styles.css.
  it('harvests a final declaration that omits its semicolon', () => {
    // No hex in the fixture: `palette.test.ts` sweeps this file for literals
    // too, and `rootBlock` only needs a `:root` block to exist, not a colour.
    const synthetic = ':root {\n  --touch: 44px;\n}\n.verdict {\n  font-weight: 700;\n  color: crimson\n}\n'
    const values = declarationValues(synthetic)
    expect(values).toEqual([
      ['font-weight', '700'],
      ['color', 'crimson'],
    ])
  })

  // A `:root` colour the harvest cannot read is a colour the role table cannot
  // classify and the oracle cannot measure — it would ship with zero assertions
  // exactly like an unlisted role. `contrastRatio` reads hex, so hex it is.
  it('declares every :root colour as a hex the oracle can read', () => {
    const unreadable = [...rootProps(CSS)]
      .filter(([, value]) => !HEX_COLOUR.test(value) && !SCALE.test(value))
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

  // The whole spacing guard below rests on `ruleBlock` reading the rule it was
  // asked for: every wrong read returns a block rather than throwing, so the
  // ratio would be computed from some other rule's numbers and the failure
  // would look like a stylesheet defect. Both misreads are exercised — the
  // compound `.pill.row` (killed by the leading boundary) and the longer
  // `.row-label` (killed by requiring the brace to follow). Pinned against a
  // synthetic sheet so it keeps holding after styles.css is tidied.
  it('reads a rule by exact selector, not by substring', () => {
    const synthetic =
      '.pill.row {\n  gap: 9rem;\n}\n.row-label {\n  margin-top: 1rem;\n}\n.row {\n  gap: 0.5rem;\n}\n'
    expect(remValue(ruleBlock(synthetic, '.row'), 'gap')).toBe(0.5)
    expect(remValue(ruleBlock(synthetic, '.row-label'), 'margin-top')).toBe(1)
    expect(remValue(ruleBlock(synthetic, '.pill.row'), 'gap')).toBe(9)
    expect(() => ruleBlock(synthetic, '.missing')).toThrow()
    // Unitless zero is a length; px is not one this guard may compare.
    expect(remValue('margin-top: 0;', 'margin-top')).toBe(0)
    expect(() => remValue('gap: 8px;', 'gap')).toThrow(/not a rem length/)
  })

  // The answer buttons are page controls sitting directly beneath a filled,
  // hard-edged instrument region — the HSI panel rect fills its whole viewBox,
  // so the whitespace that used to be page is now panel. Without a separating
  // margin the row is 0 px from that edge and 8 px from itself: each button is
  // strictly closer to the instrument than to its neighbours, and the row reads
  // as attached hardware (a bezel, a softkey strip) rather than as the answer
  // input. The label carries the margin, not the row, so the gap opens above
  // the group instead of between the label and the buttons it names.
  //
  // The 3x multiplier is a CHOSEN CONVENTION with no published basis, and is to
  // be treated like `PARALLEL_INTERCEPT_DEG`: a legibility choice, never
  // justified by a source. A search of the Gestalt primary sources, Carbon,
  // Atlassian, MIL-STD-1472G, HF-STD-001B and WCAG 2.2 found no inter-group :
  // intra-group ratio to cite — Palmer's common-region work is
  // demonstration-only and says outright that when grouping factors oppose
  // there is "no way to predict the outcome", and the case here (an element
  // flush against but *outside* a filled region) is unmeasured in all of it.
  // Do not "improve" this number by attaching a citation to it.
  it('separates the answer group from the instrument above it', () => {
    const label = ruleBlock(CSS, '.entry-answers-label')
    const row = ruleBlock(CSS, '.entry-answers')
    // Non-vacuous: `ruleBlock` throws on a selector typo, and these pin that it
    // found two *different* rules rather than the same block twice.
    expect(label, 'the label rule carries the separating margin').toMatch(/margin-top:/)
    expect(row, 'the answer row is the flex container').toMatch(/display:\s*flex/)
    expect(label).not.toBe(row)

    // A `gap` of 0 would satisfy any margin at all, so the ratio is only
    // meaningful once the intra-group spacing is known positive. Both parses
    // are pinned finite by these two comparisons: `remValue` throws on a
    // notation it cannot read, and NaN fails both of them.
    const between = remValue(row, 'gap')
    const separation = remValue(label, 'margin-top')
    expect(between, 'inter-button gap must be a real distance').toBeGreaterThan(0)
    expect(separation, 'answer group reads as part of the panel').toBeGreaterThanOrEqual(3 * between)
  })
})
