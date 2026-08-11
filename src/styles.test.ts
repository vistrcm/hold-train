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

/** The declarations of one *class* rule, by exact selector. Comments are
 * stripped first so prose naming a class cannot be mistaken for the rule itself.
 *
 * The model is deliberately small — flat rules, source order, last declaration
 * wins — and every way of leaving it is loud. Each mechanism is guarded
 * separately, because a reader who thinks one covers the rest will delete the
 * parts that actually work. A silent mis-read is a green test computing its
 * ratio from some other rule's numbers.
 *  - the prelude is split on `,` and matched member by member. A selector list
 *    is this sheet's dominant idiom (14 rules) and a scan anchored on
 *    `<selector> {` sees the target only when it happens to be written *last*,
 *    so which side of a comma someone types on decided whether an override was
 *    visible;
 *  - the trailing `(?![\w-])` stops `.entry-answers` *refusing to read at all*
 *    because `.entry-answers-label` exists. It does not decide which block is
 *    read — collection is `member === selector`, exact, so the longer name was
 *    never a candidate — it bounds the specificity **throw** below, which
 *    without it fires on every `-label` sibling and turns a readable sheet into
 *    an unresolvable one. Don't reword this as "stops the wrong block being
 *    read": a reader who believes that goes looking for a substring bug that
 *    exact match already precludes, and relaxes the lookahead. There is no
 *    *leading* boundary and none is wanted: a class selector's own `.` already
 *    delimits it, and a leading boundary would hide the compound
 *    `.pill.entry-answers` — which is why this helper takes a class selector and
 *    nothing else;
 *  - a member the model cannot resolve **throws** rather than being skipped. A
 *    rule whose subject (its rightmost compound) merely contains the selector —
 *    `.pill.entry-answers`, `.entry-drill .entry-answers-label` — outranks the
 *    flat rule on specificity whatever the source order, so the guard cannot say
 *    what renders. "It only applies inside `.foo`" is not a reason to ignore it:
 *    `.entry-answers-label` is *always* inside `.entry-drill`. Only the subject
 *    counts, so `.entry-answers button` styles the button and is ignored;
 *  - collecting **every** matching rule rather than the first is what keeps the
 *    read in step with the cascade. A second `.entry-answers-label { margin-top:
 *    0.2rem }` appended anywhere below wins in a browser, and a first-match read
 *    goes on reporting the value further up the file;
 *  - a rule that **reaches the element without naming its class** is refused on
 *    the same terms. `mentions` tests selector *text*, but the cascade matches
 *    *elements*: `.entry-drill p`, `#entry-answers-label` and `.entry-drill > *`
 *    write the class nowhere, so they were neither collected nor refused —
 *    invisible — while each of them ties or outranks a flat class rule, i.e.
 *    renders. `.foo p { margin }` is this sheet's own idiom for `<p>` margins
 *    (`.entry-feedback p`, `.written-report p`, `.tofrom-feedback p`), so it is
 *    the likeliest future edit to this section, and the id exists only because
 *    `aria-labelledby` needs one. Deciding this needs facts the stylesheet does
 *    not carry — the element's tag, its id, its ancestors — so `context`
 *    supplies them and `entry-drill.test.ts` pins them against the DOM.
 *
 * The comparison is against a single class's (0,1,0), which is all this helper
 * is ever asked for: a member carrying any id, class, attribute or pseudo-class
 * ties or wins and is refused, while one built only from type selectors loses
 * and is ignored — that split is what keeps the live `p { color: … }` from
 * reding the suite. Ancestor compounds are matched loosely (any ancestor,
 * whatever the combinator, in any order) because a tighter model is a selector
 * engine; the looseness only ever over-refuses, which is the direction to err
 * in. An empty `context` claims the element has no other name, so only `*` can
 * reach it — the safe default for a synthetic sheet.
 *
 * The blocks are concatenated in source order, which is the order the cascade
 * resolves them in for one repeated selector; `remValue` then takes the last
 * declaration.
 *
 * A **nested style rule** is refused, not resolved — same rule as the
 * specificity conflict above: what this model cannot answer, it throws on. It
 * does not degrade gracefully into a flat read. The body group is `[^}]*`, which
 * cannot cross a `}` but crosses a `{` freely, so a match containing a nested
 * rule runs only to that rule's *inner* `}` and swallows it whole: the nested
 * rule is never matched and its declarations are dropped silently, which is
 * fail-OPEN. A narrow-width `@media` override of `.entry-answers-label`'s
 * `margin-top` would leave `separates the answer group from the instrument above
 * it` green on a length that no longer renders — and a narrow width is precisely
 * where the row and the panel converge, i.e. the worst case for the defect that
 * guard exists to catch. A *later* nested rule is matched, and then read as
 * though it applied at every width, so which line of the block someone typed on
 * decides which way the guard is wrong.
 *
 * The refusal is on the **shape** — a harvested body that still contains a `{` —
 * and not on a list of at-rule names, because the swallow needs no at-rule at
 * all. Native CSS nesting (`.entry-drill { & .entry-answers-label { … } }`) is
 * the same hole with no keyword to match on, and it is now the default idiom for
 * writing CSS, i.e. the likeliest future edit to this sheet; `@scope` and
 * `@starting-style` reach it too. A name list gets each of those wrong by
 * default, silently. Refusing the shape covers every spelling at once, and what
 * it over-refuses is loud rather than green: a `@keyframes` added anywhere in
 * the sheet throws here even though it cannot touch this rule. Fixing a false
 * red is a minute's work; a false green is the defect this whole helper exists
 * to prevent.
 *
 * ⚠️ Three earlier versions of this docblock each claimed a coverage this code
 * did not have — first that at-rules were concatenated "unconditionally" and the
 * guard "errs toward failing rather than passing" (false in both directions),
 * then that a conditional group rule was "the only fail-open one" (nesting walks
 * straight through a name list), then that "every way of leaving it is loud"
 * while any rule reaching the element by tag, id or `*` left silently. That
 * claim is the more dangerous half of the bug every time: it tells the next
 * session the one edit that reaches the defect is already covered. Note the
 * shape of the recurring miss, too — each version enumerated the *spellings* it
 * knew and called the list closed. State the mechanism, not the enumeration. */
interface Context {
  /** Simple selectors the element itself carries besides the queried class. */
  readonly also?: readonly string[]
  /** Simple selectors carried by any of its ancestors. */
  readonly within?: readonly string[]
}

/** One compound's simple selectors. The alternation is ordered so an attribute
 * or a pseudo is one token rather than being shredded into bare words. */
const SIMPLE = /\*|::?[\w-]+(?:\([^)]*\))?|\[[^\]]*\]|[.#]?[\w-]+/g

/** Could this compound select an element carrying exactly `names`? `*` selects
 * anything; every other token has to be a name the element is known to carry,
 * so an unlisted one (`:first-child`, `[hidden]`) reads as "cannot match" —
 * sound only because `context` is asserted complete against the DOM. */
function reaches(compound: string, names: ReadonlySet<string>): boolean {
  const parts = compound.match(SIMPLE) ?? []
  return parts.length > 0 && parts.every((part) => part === '*' || names.has(part))
}

/** Carries an id, class, attribute or pseudo-class anywhere, so its specificity
 * is at least (0,1,0) — a tie with the queried class, which source order then
 * decides, or a win. Ties are refused with the wins: a tie added below the
 * class rule renders. */
const OUTRANKS = /[#.[:]/

function ruleBlock(css: string, selector: string, context: Context = {}): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const mentions = new RegExp(`${escaped}(?![\\w-])`)
  const own = new Set([selector, ...(context.also ?? [])])
  const anywhere = new Set([...own, ...(context.within ?? [])])
  const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  // The boundary is a lookbehind rather than a consumed character: one rule's
  // closing `}` is the next rule's boundary, and a match that eats it leaves the
  // rule right after it unmatchable — which is exactly the repeated-selector
  // case this scan was widened to catch.
  const blocks: string[] = []
  for (const rule of code.matchAll(/(?:^|(?<=[{};]))\s*([^{}]*?)\s*\{([^}]*)\}/g)) {
    // Refused rather than parsed — see the docblock. A body that still holds a
    // `{` is one whose nested rule this match just swallowed, and the fail-open
    // case is precisely that the swallowed rule produces no match of its own to
    // inspect. Tested on the comment-stripped text, so a brace in prose cannot
    // trip it.
    if (rule[2]!.includes('{')) {
      throw new Error(`${rule[1]!.trim()} nests a style rule; this guard reads flat rules only`)
    }
    for (const member of rule[1]!.split(',').map((part) => part.trim())) {
      if (member === selector) {
        blocks.push(rule[2]!)
        continue
      }
      const compounds = member.split(/[\s>+~]+/).filter(Boolean)
      const subject = compounds.at(-1) ?? ''
      if (mentions.test(subject)) {
        throw new Error(`${member} also styles ${selector}: this guard cannot resolve specificity`)
      }
      // The same refusal, reached from the DOM rather than from the selector
      // text — see the docblock. A member can only match if its subject names
      // this element and every compound above it names something on the path to
      // it; `anywhere` is the union rather than `within` alone so that a
      // self-named ancestor is assumed to match, which over-refuses and never
      // under-refuses.
      const claimed =
        reaches(subject, own) && compounds.slice(0, -1).every((part) => reaches(part, anywhere))
      if (claimed && OUTRANKS.test(member)) {
        throw new Error(`${member} reaches ${selector}: this guard cannot resolve specificity`)
      }
    }
  }
  if (blocks.length === 0) throw new Error(`styles.css has no ${selector} rule`)
  return blocks.join(';')
}

/** What else can set the property being read.
 *
 * A longhand's name is not the only way to set it, and the cascade does not care
 * which name was used — so a `margin: 0` written after `margin-top: 1.5rem`
 * renders 0 while a read that searches for `margin-top` still finds 1.5. Rather
 * than teach `remValue` to expand shorthands (a CSS parser's job, and one more
 * thing to get subtly wrong), it refuses: whichever of these is declared last
 * must be the property asked for. */
const OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  'margin-top': ['margin', 'margin-block', 'margin-block-start'],
  'margin-bottom': ['margin', 'margin-block', 'margin-block-end'],
  gap: ['row-gap', 'column-gap'],
}

/** One declaration's value as a number of `rem`.
 *
 * The **last** declaration of the property, not the first: two declarations in
 * one block are legal CSS and the later one wins, so a first-match read reports
 * a length the browser has already discarded. Same reason `ruleBlock` returns
 * every matching rule — between them they are this file's whole model of the
 * cascade, which is the thing jsdom cannot answer and this file exists to
 * replace.
 *
 * The refusal is the point, and it is a refusal of the *unit*, not of `NaN`:
 * comparing two authored lengths only means something when they share one, and
 * a lenient parse is what would pass a wrong ratio silently — `margin-top: 24px`
 * against `gap: 0.5rem` compares 24 to 1.5 and clears `3 × gap` by a factor of
 * 16 while the rendered gap is *smaller* than the buttons' own. Unitless `0` is
 * the one length CSS lets you write without a unit, so it is the one exemption.
 *
 * Throwing rather than returning `NaN` buys a legible failure, not a caught
 * one: `toBeGreaterThan`/`toBeGreaterThanOrEqual` both fail on `NaN`, so a NaN
 * return would already red the suite — just with a message about spacing rather
 * than about notation. Don't restate that as "NaN would leave the test green".
 */
function remValue(block: string, prop: string): number {
  const family = [prop, ...(OVERRIDES[prop] ?? [])]
  const declared = [...block.matchAll(/(?:^|[;{\s])([\w-]+)\s*:\s*([^;}]+)/g)]
    .map(([, name, value]) => [name!, value!.trim()] as const)
    .filter(([name]) => family.includes(name))
  // The one thing source order does not decide, so the last-declaration model
  // cannot answer it: `!important` beats every normal declaration of the same
  // property in the same origin, whatever follows it. Refused rather than
  // resolved, for the same reason a nested rule is. Fail-open in the direction
  // that matters — `.entry-answers-label { margin-top: 0 !important }` in an
  // earlier rule renders 0 while a last-declaration read goes on reporting the
  // 1.5rem underneath it. (On the *winning* declaration it already throws, but
  // with a message about notation: `1.5rem !important` is not a rem length.)
  const important = declared.find(([, value]) => /!\s*important\b/i.test(value))
  if (important) {
    throw new Error(`${important[0]}: ${important[1]} wins on !important whatever the order`)
  }
  const last = declared.at(-1)
  if (last === undefined) throw new Error(`no ${prop} declared in {${block.trim()}}`)
  const [name, raw] = last
  if (name !== prop) {
    throw new Error(`${prop} is set by a later ${name}: ${raw} — declare the longhand instead`)
  }
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
  // would look like a stylesheet defect. Each mechanism therefore gets an
  // assertion that fails when that mechanism *alone* is removed —
  // mutation-checked, not assumed. The synthetic this replaces put all of its
  // decoys *before* the target rule, so the last-declaration read masked every
  // leak: all four of its expectations passed with the leading boundary deleted
  // outright, and the comment above them named mechanisms nothing exercised.
  // Order the decoys so a leaked block would *win*, or the case proves nothing.
  it('reads a rule by exact selector, not by substring', () => {
    // A selector list with the target in the middle — this sheet's dominant
    // idiom, and invisible to a scan anchored on `<selector> {`. It is last in
    // source order, so a member-blind read reports the 0.5rem above it.
    const listed =
      '.row {\n  gap: 0.5rem;\n}\n.row-label {\n  margin-top: 1rem;\n}\n' +
      '.hint,\n.row,\n.note {\n  gap: 2rem;\n}\n'
    expect(remValue(ruleBlock(listed, '.row'), 'gap')).toBe(2)
    // …and the longer name is not swept up with it, in either direction.
    expect(ruleBlock(listed, '.row')).not.toMatch(/margin-top/)
    expect(remValue(ruleBlock(listed, '.row-label'), 'margin-top')).toBe(1)

    // A rule that also styles the element but outranks it on specificity is
    // refused, not skipped: source order no longer decides, so the guard cannot
    // say what renders. `.panel .row` is the live shape — `.entry-answers-label`
    // is always inside `.entry-drill`, so a descendant rule always applies.
    const compound = '.pill.row {\n  gap: 9rem;\n}\n.row {\n  gap: 0.5rem;\n}\n'
    const descendant = '.panel .row {\n  gap: 7rem;\n}\n.row {\n  gap: 0.5rem;\n}\n'
    expect(() => ruleBlock(compound, '.row')).toThrow(/cannot resolve specificity/)
    expect(() => ruleBlock(descendant, '.row')).toThrow(/cannot resolve specificity/)
    // Only the *subject* counts: `.row button` styles the button, and refusing
    // it would red the suite over a rule that cannot touch the row at all.
    const inner = '.row button {\n  gap: 9rem;\n}\n.row {\n  gap: 0.5rem;\n}\n'
    expect(remValue(ruleBlock(inner, '.row'), 'gap')).toBe(0.5)

    expect(() => ruleBlock(listed, '.missing')).toThrow(/no \.missing rule/)
    // Unitless zero is a length; px is not one this guard may compare.
    expect(remValue('margin-top: 0;', 'margin-top')).toBe(0)
    expect(() => remValue('gap: 8px;', 'gap')).toThrow(/not a rem length/)
  })

  // A fail-OPEN mechanism (not the only one — see the test after this):
  // the body group is `[^}]*`, so a match stops at the first inner `}` and the
  // rule nested there is swallowed into the outer *body* — never matched, never
  // collected, silently gone. Every synthetic below returned the unconditional
  // 1.5rem before this refusal existed, i.e. the margin the nested block has
  // just cancelled at exactly the width where the row and the panel converge.
  // Position-dependent, too, which is why the second case exists: a *later*
  // nested rule IS matched, and is then read as if it applied unconditionally.
  //
  // The refusal is on the shape, not on a list of at-rule names, so the cases
  // are chosen to span the spellings a name list gets wrong: native nesting
  // carries no at-rule keyword at all, and `@scope` was in no such list here.
  // Those two are the ones that shipped past the earlier name-matching version.
  it('refuses a nested style rule rather than reading past it', () => {
    const label = '.row-label {\n  margin-top: 1.5rem;\n}\n'
    const swallowed = `${label}@media (max-width: 400px) {\n  .row-label {\n    margin-top: 0;\n  }\n}\n`
    const harvested =
      `${label}@media (max-width: 400px) {\n  .other {\n    gap: 0;\n  }\n` +
      '  .row-label {\n    margin-top: 0;\n  }\n}\n'
    // No keyword to match on, and the default idiom for writing CSS today.
    const nested = `${label}.panel {\n  & .row-label {\n    margin-top: 0;\n  }\n}\n`
    const scoped = `${label}@scope (.panel) {\n  .row-label {\n    margin-top: 0;\n  }\n}\n`
    for (const [name, sheet] of [
      ['@media, swallowed', swallowed],
      ['@media, harvested later', harvested],
      ['@supports', `${label}@supports (display: grid) {\n  .row-label {\n  }\n}\n`],
      ['native nesting', nested],
      ['@scope', scoped],
    ] as const) {
      expect(() => ruleBlock(sheet, '.row-label'), name).toThrow(/flat rules only/)
    }
    // Non-vacuous in the other direction: the refusal is of the nested rule, not
    // of every sheet, and `styles.css` carries none today (88 rules, 88 open
    // braces) — the spacing guard below reads the real file and would throw here
    // if that changed.
    expect(remValue(ruleBlock(label, '.row-label'), 'margin-top')).toBe(1.5)
    // …and a brace in prose is not a nested rule: comments are stripped before
    // the scan, so a docblock drawing the shape it refuses cannot red the suite.
    expect(
      remValue(ruleBlock(`/* .panel { & .row-label {} } */\n${label}`, '.row-label'), 'margin-top'),
    ).toBe(1.5)
  })

  // The other fail-OPEN one, and the one every earlier version was blind to: a
  // rule does not have to *name* the class to set the property. `mentions` tests
  // selector text, so a subject reaching the element by tag, by id or by `*` was
  // neither collected nor refused — invisible. Each of the three below, appended
  // verbatim to the real styles.css, left `separates the answer group…` still
  // reporting `margin-top: 1.5rem` against `gap: 0.5rem` while a browser renders
  // 5.6 px of separation against an 8 px inter-button gap: the exact 0-ish : 1
  // defect this branch exists to close, restored, suite green.
  it('refuses a rule that reaches the element without naming its class', () => {
    const label = '.row-label {\n  margin-top: 1.5rem;\n}\n'
    // The live shape: a <p id> inside .panel. `also` is what the element is,
    // `within` is what it sits in.
    const ctx = { also: ['p', '#row-label'], within: ['.panel'] } as const
    for (const [name, rule] of [
      // The sheet's own idiom for <p> margins, four rules of it already.
      ['descendant type', '.panel p {\n  margin: 0.35rem 0;\n}\n'],
      // The id exists only because `aria-labelledby` needs one, and `#app`
      // shows this sheet already selects on one.
      ['id', '#row-label {\n  margin-top: 0;\n}\n'],
      // A tie, not a win — refused with the wins, because a tie below the class
      // rule renders.
      ['universal child', '.panel > * {\n  margin: 0;\n}\n'],
    ] as const) {
      expect(() => ruleBlock(`${label}${rule}`, '.row-label', ctx), name).toThrow(
        /reaches \.row-label/,
      )
    }
    // Non-vacuous in the other direction, and this half is why the refusal is
    // specificity-aware rather than a blanket "could it match": both of these
    // are live in styles.css (`p { color: … }`, `.entry-feedback p { margin }`)
    // and neither changes what renders — a bare type rule is (0,0,1) against the
    // class's (0,1,0), and a descendant rule under an ancestor this element does
    // not have cannot match it at all. Refusing either would red the suite over
    // a rule the browser already discards.
    const loses = `${label}p {\n  margin: 0;\n}\n`
    const elsewhere = `${label}.other p {\n  margin: 0;\n}\n`
    expect(remValue(ruleBlock(loses, '.row-label', ctx), 'margin-top')).toBe(1.5)
    expect(remValue(ruleBlock(elsewhere, '.row-label', ctx), 'margin-top')).toBe(1.5)
    // An unnamed context claims no other name, so only `*` reaches — which is
    // what makes the three refusals above turn on the context and not on luck.
    const unnamed = `${label}#row-label {\n  margin-top: 0;\n}\n`
    expect(remValue(ruleBlock(unnamed, '.row-label'), 'margin-top')).toBe(1.5)
  })

  // The misread no boundary can catch, because the rule it reads is the right
  // one: a browser resolves the LAST declaration and a first-match read reports
  // a length that never renders. Three ordinary edits reach it — a second rule
  // for the same selector further down the sheet, a second declaration inside
  // the rule, and a shorthand that sets the same edge under another name — and
  // all three put the answer buttons back flush against the panel with the
  // spacing guard below still green.
  it('resolves a property the way the cascade does: last declaration wins', () => {
    const repeated = '.row {\n  margin-top: 1.5rem;\n}\n.row {\n  margin-top: 0.2rem;\n}\n'
    expect(remValue(ruleBlock(repeated, '.row'), 'margin-top')).toBe(0.2)
    expect(remValue('margin-top: 1.5rem; margin-top: 0.2rem;', 'margin-top')).toBe(0.2)
    // A shorthand is not expanded — that is a CSS parser's job — but it may not
    // be read past either, so the guard refuses rather than reporting a stale
    // longhand. `margin` and its logical spelling both reach `margin-top`.
    for (const later of ['margin: 0', 'margin-block: 0', 'margin-block-start: 0']) {
      expect(() => remValue(`margin-top: 1.5rem; ${later};`, 'margin-top'), later).toThrow(
        /set by a later/,
      )
    }
    expect(() => remValue('gap: 0.5rem; column-gap: 0;', 'gap')).toThrow(/set by a later/)
    // …and the one declaration source order does NOT decide. `ruleBlock` joins
    // every rule for the selector, so the loser here is what a first repeated
    // rule would leave behind: the read reports 1.5rem, the browser renders 0.
    expect(() => remValue('margin-top: 0 !important; margin-top: 1.5rem;', 'margin-top')).toThrow(
      /wins on !important/,
    )
    // Also refused when it is the winner, so the message is about the cascade
    // rather than about `1.5rem !important` not parsing as a length.
    expect(() => remValue('margin-top: 1.5rem !important;', 'margin-top')).toThrow(
      /wins on !important/,
    )
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
  //
  // Scope, so the next reader knows what this does NOT see: it compares the two
  // authored lengths and cannot know the containing block. That is sound while
  // `.entry-drill` contributes no spacing of its own — it carries no rule at all
  // today — but flex-column-with-gap is this stylesheet's idiom for stacked
  // groups (`.written-options`, `.copy-form`, `.dash-cards`), and under one of
  // those the margins stop collapsing and *both* distances gain the container's
  // gap. The bottom half is the one that breaks: label-to-row becomes
  // `gap + 0.35rem` while this still reads 0.35. Style that section and this
  // guard needs re-deriving, not just re-running.
  it('separates the answer group from the instrument above it', () => {
    // Every other name a rule could reach these two elements by, so `ruleBlock`
    // can refuse an override that never writes the class. `<p id=…>` and `<div>`
    // inside `section.entry-drill`, inside the fresh `<div>` the router hands
    // each screen, inside `#app` in `<body>`. A claim about the DOM, not about
    // this sheet, so it is pinned there: `carries only the names the stylesheet
    // guard is told about` in entry-drill.test.ts. Add a second class here and
    // forget it, and the guard resumes refusing the wrong set.
    const WITHIN = ['.entry-drill', 'section', 'div', '#app', 'body', 'html']
    const label = ruleBlock(CSS, '.entry-answers-label', {
      also: ['p', '#entry-answers-label'],
      within: WITHIN,
    })
    const row = ruleBlock(CSS, '.entry-answers', { also: ['div'], within: WITHIN })
    // Non-vacuous: `ruleBlock` throws on a selector typo, and these pin that it
    // found two *different* rules rather than the same block twice.
    expect(label, 'the label rule carries the separating margin').toMatch(/margin-top:/)
    expect(row, 'the answer row is the flex container').toMatch(/display:\s*flex/)
    expect(label).not.toBe(row)

    // A margin separates nothing on an element that generates no box, or one
    // taken out of flow, and this is the only place that is visible: the DOM
    // half in entry-drill.test.ts reads `label.hidden`, which reflects the HTML
    // attribute and sees no CSS. Make the label screen-reader-only — `display:
    // none`, `display: contents`, the `position: absolute` + `clip` idiom — and
    // `.entry-answers` follows `.entry-hsi` with nothing between them, i.e. the
    // buttons flush against the G1000 rect again, while every number below still
    // reads 1.5rem against 0.5rem and passes.
    //
    // Refused as a *property*, not as a list of values: `display: none` and
    // `position: absolute` were the two spellings the first version enumerated,
    // and `display: contents` — which keeps the text and drops the box, so the
    // margin vanishes with nothing on screen to show for it — walked straight
    // through. Which values still generate an in-flow box is a question this
    // guard would have to model, and the label needs neither property, so both
    // are refused outright. A `display: block` that changes nothing reds here;
    // that costs a minute, and the alternative is the defect shipping green.
    expect(
      label,
      'the label must generate a box in normal flow: no display or position here',
    ).not.toMatch(/(?:^|[;{\s])(?:display|position)\s*:/)

    // A `gap` of 0 would satisfy any margin at all, so the ratio is only
    // meaningful once the intra-group spacing is known positive. Both parses
    // are pinned finite by these two comparisons: `remValue` throws on a
    // notation it cannot read, and NaN fails both of them.
    const between = remValue(row, 'gap')
    const separation = remValue(label, 'margin-top')
    expect(between, 'inter-button gap must be a real distance').toBeGreaterThan(0)
    expect(separation, 'answer group reads as part of the panel').toBeGreaterThanOrEqual(3 * between)

    // The invariant has two sides and only one of them was guarded. The design
    // is "the gap above the group exceeds the gaps inside it", so the label's
    // own bottom margin is as load-bearing as its top one: raise it to the
    // separation above and the label stops naming the row and becomes a third
    // free-floating element between panel and buttons — the same grouping
    // defect arriving from the other side, with the ratio above still passing.
    // It is stated in the stylesheet's comment; this is what makes it hold.
    const binding = remValue(label, 'margin-bottom')
    expect(binding, 'the label must bind to the buttons it names').toBeLessThan(between)
  })
})
