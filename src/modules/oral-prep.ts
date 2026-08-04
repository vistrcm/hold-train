// Oral-exam prep: self-test flashcards over the ACS Task III.B oral bank.
//
// Two modes:
//   self-test — question → reveal the model answer → self-grade
//               (got it / partial / missed); missed items are recorded with a
//               full snapshot so the Anki misses export can rebuild the card
//   browse    — the whole bank grouped by ACS element, a coverage checklist
//               for the oral
//
// There is no machine-checkable answer here, so the controller enforces
// process instead: the model answer must be revealed before a grade is
// accepted. Only "got it" counts as correct; only "missed" records a miss.

import type { Screen } from '../app/router'
import { store as appStore, type Store } from '../app/store'
import {
  ACS_ELEMENTS,
  ORAL_ITEMS,
  type AcsElement,
  type OralItem,
} from '../content/oral'

export type SelfGrade = 'got' | 'partial' | 'missed'
export type OralMode = 'self-test' | 'browse'

const DRILL_ID = 'oral'

export interface OralSummary {
  total: number
  got: number
  partial: number
  missed: number
}

export interface OralPrepOptions {
  store?: Store
  now?: () => number
  items?: readonly OralItem[]
  mode?: OralMode
}

export interface OralPrepController {
  readonly length: number
  readonly index: number
  readonly finished: boolean
  readonly item: OralItem
  readonly revealed: boolean
  reveal(): void
  /** Records the result and advances; throws before reveal(). */
  grade(grade: SelfGrade): void
  /** Grade counts for a finished run; throws while items remain. */
  summary(): OralSummary
}

export function createOralPrep(options: OralPrepOptions = {}): OralPrepController {
  const store = options.store ?? appStore
  const now = options.now ?? (() => Date.now())
  const items = options.items ?? ORAL_ITEMS
  if (items.length === 0) {
    // renderSelfTest reads the current item immediately, so an empty bank would
    // throw out of Screen.render and leave the app blank. Fail at construction
    // with a message that names the cause, as createWrittenTest does.
    throw new RangeError('oral item bank is empty')
  }

  let index = 0
  let revealed = false
  let shownAt = now()
  const counts: OralSummary = { total: items.length, got: 0, partial: 0, missed: 0 }

  const finished = (): boolean => index >= items.length

  function current(): OralItem {
    const item = items[index]
    if (item === undefined) {
      throw new Error('self-test is finished; no current item')
    }
    return item
  }

  return {
    length: items.length,
    get index() {
      return index
    },
    get finished() {
      return finished()
    },
    get item() {
      return current()
    },
    get revealed() {
      return revealed
    },

    reveal(): void {
      current()
      revealed = true
    },

    grade(grade: SelfGrade): void {
      const item = current()
      if (!revealed) {
        throw new Error('reveal() the model answer before self-grading')
      }
      counts[grade] += 1
      const timeSeconds = (now() - shownAt) / 1000
      store.recordDrillResult(DRILL_ID, { correct: grade === 'got', timeSeconds })
      if (grade === 'missed') {
        store.recordMiss(DRILL_ID, {
          itemId: item.id,
          question: item.question,
          answer: item.answer,
          source: item.source,
          acs: item.acs,
          // Denormalized like every sibling field: the export rebuilds this card
          // from the live item and reads the snapshot only when the id no longer
          // resolves, so a field missing here is one the fallback card drops —
          // and dropping this one exports the answer without the qualification
          // that makes it true (CLAUDE.md: never drop a caveat).
          caveat: item.caveat,
        })
      }
      index += 1
      revealed = false
      shownAt = now()
    },

    summary(): OralSummary {
      if (!finished()) {
        throw new Error('summary is available only after the last item')
      }
      return { ...counts }
    },
  }
}

export interface ElementGroup {
  element: AcsElement
  items: OralItem[]
}

/**
 * The full Task III.B element list in ACS order, each with the items tagged
 * to it. Elements are kept even when empty so the browse view doubles as a
 * coverage checklist.
 */
export function groupByElement(items: readonly OralItem[] = ORAL_ITEMS): ElementGroup[] {
  return ACS_ELEMENTS.map((element) => ({
    element,
    items: items.filter((i) => i.acs.includes(element.code)),
  }))
}

// --- screen -----------------------------------------------------------------

const GRADE_LABELS: Record<SelfGrade, string> = {
  got: 'Got it',
  partial: 'Partial',
  missed: 'Missed',
}

function answerHtml(item: OralItem): string {
  const caveat = item.caveat ? `<p class="oral-caveat">⚠ ${item.caveat}</p>` : ''
  return `
    <p class="oral-answer">${item.answer}</p>
    ${caveat}
    <p class="oral-source"><cite>${item.source}</cite></p>
  `
}

export function renderOralPrep(el: HTMLElement, options: OralPrepOptions = {}): void {
  const mode = options.mode ?? 'self-test'

  el.innerHTML = `
    <section class="oral-prep">
      <h1>Oral Prep</h1>
      <div class="oral-modes" role="group" aria-label="Oral prep mode">
        <button class="oral-mode" data-mode="self-test" aria-pressed="${mode === 'self-test'}">Self-test</button>
        <button class="oral-mode" data-mode="browse" aria-pressed="${mode === 'browse'}">Browse by ACS element</button>
      </div>
      <div class="oral-body"></div>
    </section>
  `
  const body = el.querySelector<HTMLElement>('.oral-body')!
  for (const btn of el.querySelectorAll<HTMLButtonElement>('.oral-mode')) {
    btn.addEventListener('click', () => {
      renderOralPrep(el, { ...options, mode: btn.dataset['mode'] as OralMode })
    })
  }

  if (mode === 'browse') {
    renderBrowse(body, options.items ?? ORAL_ITEMS)
    return
  }
  renderSelfTest(body, options)
}

function renderSelfTest(body: HTMLElement, options: OralPrepOptions): void {
  const prep = createOralPrep(options)

  body.innerHTML = `
    <p class="oral-progress"></p>
    <p class="oral-question"></p>
    <div class="oral-panel" aria-live="polite"></div>
    <div class="oral-actions"></div>
  `
  const progressEl = body.querySelector<HTMLElement>('.oral-progress')!
  const questionEl = body.querySelector<HTMLElement>('.oral-question')!
  const panelEl = body.querySelector<HTMLElement>('.oral-panel')!
  const actionsEl = body.querySelector<HTMLElement>('.oral-actions')!

  function showItem(): void {
    progressEl.textContent = `Item ${prep.index + 1} of ${prep.length}`
    questionEl.textContent = prep.item.question
    panelEl.innerHTML = ''
    actionsEl.innerHTML = '<button class="oral-reveal">Reveal answer</button>'
    actionsEl.querySelector<HTMLButtonElement>('.oral-reveal')!.addEventListener('click', () => {
      prep.reveal()
      panelEl.innerHTML = answerHtml(prep.item)
      actionsEl.innerHTML = (Object.keys(GRADE_LABELS) as SelfGrade[])
        .map((g) => `<button class="oral-grade" data-grade="${g}">${GRADE_LABELS[g]}</button>`)
        .join('')
      for (const btn of actionsEl.querySelectorAll<HTMLButtonElement>('.oral-grade')) {
        btn.addEventListener('click', () => {
          prep.grade(btn.dataset['grade'] as SelfGrade)
          if (prep.finished) {
            showSummary()
            return
          }
          showItem()
        })
      }
    })
  }

  function showSummary(): void {
    const s = prep.summary()
    progressEl.textContent = ''
    questionEl.textContent = ''
    actionsEl.innerHTML = ''
    panelEl.innerHTML = `
      <div class="oral-summary">
        <p>Run complete: ${s.got} got, ${s.partial} partial, ${s.missed} missed of ${s.total}.</p>
        <p>Missed items are saved and will feed the Anki "my misses" deck.</p>
      </div>
    `
  }

  showItem()
}

function renderBrowse(body: HTMLElement, items: readonly OralItem[]): void {
  body.innerHTML = groupByElement(items)
    .map(
      (g) => `
        <section class="oral-element">
          <h2><span class="oral-element-code">${g.element.code}</span> ${g.element.text}</h2>
          ${g.items
            .map(
              (item) => `
                <details class="oral-browse-item">
                  <summary>${item.question}</summary>
                  ${answerHtml(item)}
                </details>
              `,
            )
            .join('')}
        </section>
      `,
    )
    .join('')
}

export const oralPrepScreen: Screen = {
  path: 'oral-prep',
  title: 'Oral Prep',
  render(el) {
    renderOralPrep(el)
  },
}
