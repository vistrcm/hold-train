// Anki export: serializes the fixed core deck and the personalized misses
// deck to Anki-importable TSV (front \t back \t space-separated tags) and
// offers them as Blob downloads. Misses come from the progress store's
// scenario snapshots (entry drill, written test, oral prep); malformed or
// unknown snapshots are skipped rather than corrupting the deck.

import { CORE_DECK, type AnkiCard } from '../content/anki-deck'
import type { Screen } from './router'
import { store as appStore, type Miss, type Store } from './store'

export const CORE_FILENAME = 'hold-train-core.tsv'
export const MISSES_FILENAME = 'hold-train-misses.tsv'

/** Entry answers are engine-generated; the miss card cites the entry rules. */
const ENTRY_MISS_SOURCE = 'AIM 5-3-8 j3 (entry procedures)'

// Tabs would split the field; newlines would split the card. Anki renders
// HTML, so line breaks survive as <br>.
function escapeField(text: string): string {
  return text.replace(/\t/g, ' ').replace(/\r\n|\r|\n/g, '<br>')
}

export function serializeDeck(cards: readonly AnkiCard[]): string {
  return cards
    .map((c) => {
      const back = `${c.back}<br>— ${c.source}`
      return `${escapeField(c.front)}\t${escapeField(back)}\t${c.tags.join(' ')}`
    })
    .join('\n')
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function str(x: unknown): string | null {
  return typeof x === 'string' && x.trim() !== '' ? x : null
}

function entryMissCard(drill: string, s: Record<string, unknown>): AnkiCard | null {
  const clearanceText = str(s['clearanceText'])
  const expected = str(s['expected'])
  if (clearanceText === null || expected === null || !Number.isFinite(s['heading'])) {
    return null
  }
  const alternates = Array.isArray(s['alternates']) ? s['alternates'].filter(Boolean) : []
  const also = alternates.length > 0 ? ` (also acceptable: ${alternates.join(', ')})` : ''
  const chosen = str(s['chosen'])
  const missed = chosen === null ? '' : `\nYou answered: ${chosen}.`
  return {
    front: `${clearanceText}\nYour heading: ${s['heading']}° — which entry?`,
    back: `Correct entry: ${expected}${also}.${missed}`,
    source: ENTRY_MISS_SOURCE,
    tags: ['miss', drill],
  }
}

function writtenMissCard(drill: string, s: Record<string, unknown>): AnkiCard | null {
  const question = str(s['question'])
  const correctOption = str(s['correctOption'])
  const source = str(s['source'])
  if (question === null || correctOption === null || source === null) {
    return null
  }
  const explanation = str(s['explanation'])
  const topic = str(s['topic'])
  return {
    front: question,
    back: explanation === null ? correctOption : `${correctOption}\n${explanation}`,
    source,
    tags: topic === null ? ['miss', drill] : ['miss', drill, topic],
  }
}

function oralMissCard(s: Record<string, unknown>): AnkiCard | null {
  const question = str(s['question'])
  const answer = str(s['answer'])
  const source = str(s['source'])
  if (question === null || answer === null || source === null) {
    return null
  }
  const acs = str(s['acs'])
  return {
    front: question,
    back: answer,
    source,
    tags: acs === null ? ['miss', 'oral'] : ['miss', 'oral', acs],
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
  a.click()
  URL.revokeObjectURL(url)
}

export interface AnkiExportOptions {
  store?: Store
}

export function renderAnkiExport(el: HTMLElement, options: AnkiExportOptions = {}): void {
  const store = options.store ?? appStore
  const missCards = missesToCards(store.loadState().misses)

  const missesBody =
    missCards.length === 0
      ? '<p class="anki-empty">No misses recorded yet — drill first; missed items become cards here.</p>'
      : `<p>Cards rebuilt from your missed entry scenarios, written questions, and oral items.</p>`
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
