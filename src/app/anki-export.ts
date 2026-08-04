// Anki export: serializes the fixed core deck and the personalized misses
// deck to Anki-importable TSV (front \t back \t space-separated tags) and
// offers them as Blob downloads. Misses come from the progress store's
// scenario snapshots (entry drill, written test, oral prep); malformed or
// unknown snapshots are skipped rather than corrupting the deck.
//
// Bank-backed cards (written, oral) are rebuilt from the LIVE item, looked up by
// the id the snapshot records, and fall back to the snapshot's own prose only
// when that id no longer resolves. The snapshot denormalizes the prose so a card
// survives its item being deleted, but that also freezes the fact: a miss
// recorded before the 2026-08-02 parallel-rejoin correction otherwise
// regenerates the inverted gloss on every export, and the re-import step this
// screen renders would be false for exactly the deck it is telling the user to
// refresh.
//
// Entry cards freeze the same way, and it is WORSE there, not better: `expected`
// and `alternates` are `determineEntry` output snapshotted at miss time, so an
// engine correction (this repo has shipped two) leaves the deck teaching the old
// ENTRY SECTOR — the one fact CLAUDE.md opens by calling negative training. So
// the answer is re-derived from the engine, off the `heading`/`holdSpec` the
// snapshot already records.
//
// The scenario TEXT (`clearanceText`, `chartNote`) stays frozen, deliberately.
// It is re-derivable only from `seed`, and `generateScenario` maps a seed through
// the fixture lists — so after a fixture rename (docs/content-audit.md, the
// PUBLISHED_HOLDS/FIXES correction) the same seed yields a DIFFERENT hold, and
// the card would silently swap the question the user actually missed. Frozen
// prose that is merely dated beats a correct answer to an unasked question.

import { CORE_DECK, type AnkiCard } from '../content/anki-deck'
import { ORAL_ITEMS } from '../content/oral'
import { QUESTIONS } from '../content/questions'
import { determineEntry, type TurnDirection } from '../engine/entry'
import type { Screen } from './router'
import { store as appStore, type Miss, type Store } from './store'
import { courseText } from '../format'

export const CORE_FILENAME = 'hold-train-core.tsv'
export const MISSES_FILENAME = 'hold-train-misses.tsv'

/** Entry answers are engine-generated; the miss card cites the entry rules. */
const ENTRY_MISS_SOURCE = 'AIM 5-3-8 j3 (entry procedures)'

// Tabs would split the field; newlines would split the card. Anki renders
// HTML, so line breaks survive as <br>.
//
// Double quotes have to go too: Anki's text importer is an RFC4180 reader, so a
// field that STARTS with `"` is read as a quoted field — the quotes are stripped
// and an odd count swallows the following tab. The core deck quotes ATC
// phraseology ('"Hold northeast of ABC as published" — ...'), which is exactly
// that shape. &quot; renders as a plain quote on the card.
function escapeField(text: string): string {
  return text
    .replace(/\t/g, ' ')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/"/g, '&quot;')
}

export function serializeDeck(cards: readonly AnkiCard[]): string {
  return cards
    .map((c) => {
      const back = `${c.back}<br>— ${c.source}`
      // Tags are space-separated in Anki's third column, so the join itself is
      // the delimiter — escape each tag, don't escape the joined string.
      const tags = c.tags.map(escapeField).join(' ')
      return `${escapeField(c.front)}\t${escapeField(back)}\t${tags}`
    })
    .join('\n')
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function str(x: unknown): string | null {
  return typeof x === 'string' && x.trim() !== '' ? x : null
}

/**
 * The snapshot's hold, if it still carries the two fields `determineEntry` needs.
 *
 * Validated rather than cast: this comes back off localStorage as `unknown`, and
 * `determineEntry` throws RangeError on a bad course — an export must not be
 * takeable down by one malformed miss. A snapshot that fails this simply keeps
 * its frozen answer, which is the pre-existing behaviour.
 */
function snapshotHold(x: unknown): { inboundCourse: number; turnDirection: TurnDirection } | null {
  if (!isRecord(x)) {
    return null
  }
  const inboundCourse = x['inboundCourse']
  const turnDirection = x['turnDirection']
  if (typeof inboundCourse !== 'number' || !Number.isFinite(inboundCourse)) {
    return null
  }
  if (inboundCourse < 0 || inboundCourse >= 360) {
    return null
  }
  if (turnDirection !== 'right' && turnDirection !== 'left') {
    return null
  }
  return { inboundCourse, turnDirection }
}

function entryMissCard(drill: string, s: Record<string, unknown>): AnkiCard | null {
  const clearanceText = str(s['clearanceText'])
  const heading = s['heading']
  if (clearanceText === null || typeof heading !== 'number') {
    return null
  }
  // Range-checked against the ENGINE's domain, not merely for finiteness:
  // `heading` is the second argument the re-derivation below feeds
  // `determineEntry`, which throws RangeError outside [0, 360) exactly as it
  // does for `snapshotHold`'s `inboundCourse`. Guarding one of the pair and not
  // the other left `missesToCards` — uncaught, called after the router has
  // cleared `#app` — takeable down by a single hand-edited miss. Dropped rather
  // than answered from the frozen snapshot because the heading IS the question
  // on the card front ("Your heading: … — which entry?"): a card asking about
  // 400° has no correct answer to fall back to, and this is the same disposition
  // a non-numeric heading already got.
  if (!Number.isFinite(heading) || heading < 0 || heading >= 360) {
    return null
  }
  // Re-derive the answer from the engine when the snapshot carries enough to do
  // it, so an entry-sector correction reaches decks already recorded. Falls back
  // to the frozen answer for a pre-`holdSpec` or malformed snapshot.
  const hold = snapshotHold(s['holdSpec'])
  const live = hold === null ? null : determineEntry(heading, hold)
  const expected = live === null ? str(s['expected']) : live.primary
  if (expected === null) {
    return null
  }
  const alternates: readonly string[] =
    live === null
      ? Array.isArray(s['alternates'])
        ? s['alternates'].filter((a): a is string => typeof a === 'string' && a.trim() !== '')
        : []
      : live.alternates
  const also = alternates.length > 0 ? ` (also acceptable: ${alternates.join(', ')})` : ''
  const chosen = str(s['chosen'])
  const missed = chosen === null ? '' : `\nYou answered: ${chosen}.`
  // "As published" clearances state neither course nor turns — the snapshot's
  // plate line is what makes the card answerable away from the drill.
  const chart = str(s['chartNote'])
  const chartLine = chart === null ? '' : `\n${chart}`
  return {
    front: `${clearanceText}${chartLine}\nYour heading: ${courseText(heading)} — which entry?`,
    back: `Correct entry: ${expected}${also}.${missed}`,
    source: ENTRY_MISS_SOURCE,
    tags: ['miss', drill],
  }
}

function writtenMissCard(drill: string, s: Record<string, unknown>): AnkiCard | null {
  const live = QUESTIONS.find((q) => q.id === str(s['questionId']))
  const question = live?.question ?? str(s['question'])
  // Spelled with `?.`/`??` like every sibling, and that uniformity is the point:
  // as a ternary on `live`, an out-of-range `answerIndex` made this the one field
  // that could not fall back, so a single malformed bank entry dropped the whole
  // card out of the export instead of degrading to the snapshot. Optional
  // chaining and `noUncheckedIndexedAccess` both yield `undefined`, which `??`
  // absorbs — the live arm here is genuinely optional, unlike its siblings.
  const correctOption = live?.options[live.answerIndex] ?? str(s['correctOption'])
  const source = live?.source ?? str(s['source'])
  if (question === null || correctOption === null || source === null) {
    return null
  }
  const explanation = live?.explanation ?? str(s['explanation'])
  const topic = live?.topic ?? str(s['topic'])
  return {
    front: question,
    back: explanation === null ? correctOption : `${correctOption}\n${explanation}`,
    source,
    tags: topic === null ? ['miss', drill] : ['miss', drill, topic],
  }
}

function oralMissCard(s: Record<string, unknown>): AnkiCard | null {
  const live = ORAL_ITEMS.find((i) => i.id === str(s['itemId']))
  const question = live?.question ?? str(s['question'])
  const answer = live?.answer ?? str(s['answer'])
  const source = live?.source ?? str(s['source'])
  if (question === null || answer === null || source === null) {
    return null
  }
  // Oral items tag every ACS element they cover (acs is a string array).
  const snapshotAcs = Array.isArray(s['acs'])
    ? s['acs'].filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : []
  const acs = live?.acs ?? snapshotAcs
  // `OralItem.caveat` is a separate field (oral-prep.ts renders it as `⚠ …`
  // beside the answer), and `AnkiCard` has none — which is exactly the case
  // CLAUDE.md's "never drop a caveat because the type has no field for it"
  // names. Folded into the back rather than lost: the `entries` item's own
  // caveat is the ±5° tolerance that makes a boundary heading's second entry
  // correct, so a card drilled without it teaches a harder rule than the AIM's.
  //
  // Ternary on `live`, not `live?.caveat ?? str(...)`: the caveat is the one
  // field whose ABSENCE is meaningful, so `??` would read a live item that has
  // had its caveat retired as "no live value" and resurrect the stale one off
  // the snapshot — the frozen-fact bug this whole rebuild exists to close,
  // running backwards. Live wins outright; the snapshot answers only the
  // retired-id case, which is the case delete-resilience is for.
  const caveat = live === undefined ? str(s['caveat']) : live.caveat
  return {
    front: question,
    back: caveat === undefined || caveat === null ? answer : `${answer}\n⚠ ${caveat}`,
    source,
    tags: ['miss', 'oral', ...acs],
  }
}

export function missesToCards(misses: readonly Miss[]): AnkiCard[] {
  const cards: AnkiCard[] = []
  for (const miss of misses) {
    if (!isRecord(miss.scenario)) {
      continue
    }
    let card: AnkiCard | null = null
    if (miss.drill === 'entry' || miss.drill === 'entry-learn') {
      card = entryMissCard(miss.drill, miss.scenario)
    }
    if (miss.drill === 'written' || miss.drill === 'written-exam') {
      card = writtenMissCard(miss.drill, miss.scenario)
    }
    if (miss.drill === 'oral') {
      card = oralMissCard(miss.scenario)
    }
    if (card !== null) {
      cards.push(card)
    }
  }
  return cards
}

export function downloadTsv(filename: string, tsv: string): void {
  const blob = new Blob([tsv], { type: 'text/tab-separated-values' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  // click() only queues the navigation that reads the blob URL, and a detached
  // anchor's activation is a no-op in some browsers. Attach it, then tear down
  // in a later task so the queued fetch still resolves the URL.
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 0)
}

export interface AnkiExportOptions {
  store?: Store
}

export function renderAnkiExport(el: HTMLElement, options: AnkiExportOptions = {}): void {
  const store = options.store ?? appStore
  const misses = store.loadState().misses
  const missCards = missesToCards(misses)

  // Telling a student who has only drilled the copy or wind lab "no misses
  // recorded yet" contradicts the Progress screen they just came from and reads
  // as lost data. Those drills are tracked; they just have no card converter yet.
  const missesBody =
    missCards.length > 0
      ? `<p>Cards rebuilt from your missed entry scenarios, written questions, and oral items.</p>`
      : misses.length > 0
        ? `<p class="anki-empty">Your ${misses.length} recorded miss${misses.length === 1 ? '' : 'es'}
             are all from drills that do not export cards yet — clearance copy, the TO/FROM
             micro-drill and the wind lab are tracked on the Progress screen only. Entry, written
             and oral misses become cards here.</p>`
        : '<p class="anki-empty">No misses recorded yet — drill first; missed items become cards here.</p>'
  el.innerHTML = `
    <h1>Anki Export</h1>
    <section>
      <h2>Core deck</h2>
      <p>The ROTE / TRAP / SAFETY call-outs, each with its FAA citation on the back.</p>
      <button class="anki-core">Download core deck (${CORE_DECK.length} cards)</button>
    </section>
    <section>
      <h2>My misses</h2>
      ${missesBody}
      <button class="anki-misses" ${missCards.length === 0 ? 'disabled' : ''}>
        Download misses deck (${missCards.length} cards)
      </button>
    </section>
    <section>
      <h2>Importing into Anki</h2>
      <ol>
        <li>In Anki, choose File → Import and pick the downloaded .tsv file.</li>
        <li>Fields are separated by tab characters: front, back, tags.</li>
        <li>Allow HTML in fields so the line breaks on card backs render.</li>
        <li>
          <strong>Re-download and re-import after a content correction.</strong>
          Cards already in your deck are not updated by fixes made here, so a
          corrected fact stays wrong in your deck until you import again.
          Corrections are logged in <code>docs/content-audit.md</code> — the
          2026-08-02 parallel-entry rejoin fix changed a core card. Import into
          the same notetype you used before and leave Anki's existing-notes
          setting on <em>Update</em>; card fronts are stable unless a correction
          rewords a question (miss cards are rebuilt from the live bank item, so
          a reworded question changes the front — a reworded answer does not), so
          matching notes <em>should</em> update rather than duplicate — but this file is a bare
          TSV with no <code>#notetype:</code> or <code>#deck:</code> header, so
          update-vs-duplicate is a setting on Anki's import screen, not a
          property of the download. Check the import preview before confirming.
          (Unverified against a specific Anki version.)
        </li>
      </ol>
    </section>
  `

  el.querySelector<HTMLButtonElement>('.anki-core')?.addEventListener('click', () => {
    downloadTsv(CORE_FILENAME, serializeDeck(CORE_DECK))
  })
  el.querySelector<HTMLButtonElement>('.anki-misses')?.addEventListener('click', () => {
    downloadTsv(MISSES_FILENAME, serializeDeck(missCards))
  })
}

export const ankiExportScreen: Screen = {
  path: 'anki',
  title: 'Anki Export',
  render(el) {
    renderAnkiExport(el)
  },
}
