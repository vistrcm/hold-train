// Learn: concise lesson pages in instructional order.
//
// Pure presentation over src/content/lessons.ts — no state beyond which
// lesson is open, no store. Each page renders its paragraphs with their FAA
// citations and ends with a link into the drill that practices the lesson.

import type { Screen } from '../app/router'
import { LESSONS, type Lesson } from '../content/lessons'

export interface LearnOptions {
  /** Open a specific lesson; unknown or absent id shows the lesson list. */
  lessonId?: string
}

export function renderLearn(el: HTMLElement, options: LearnOptions = {}): void {
  const lesson = LESSONS.find((l) => l.id === options.lessonId)
  if (lesson === undefined) {
    renderList(el)
    return
  }
  renderLesson(el, lesson)
}

function renderList(el: HTMLElement): void {
  el.innerHTML = `
    <section class="learn">
      <h1>Learn</h1>
      <p>Short lessons in study order — read once, then drill.</p>
      <ol class="lesson-list">
        ${LESSONS.map(
          (l) => `<li><button class="lesson-link" data-lesson="${l.id}">${l.title}</button></li>`,
        ).join('')}
      </ol>
    </section>
  `
  for (const btn of el.querySelectorAll<HTMLButtonElement>('.lesson-link')) {
    btn.addEventListener('click', () => {
      renderLearn(el, { lessonId: btn.dataset['lesson'] })
    })
  }
}

function renderLesson(el: HTMLElement, lesson: Lesson): void {
  const index = LESSONS.indexOf(lesson)
  const next = LESSONS[index + 1]

  el.innerHTML = `
    <section class="learn">
      <button class="lesson-back">← All lessons</button>
      <h1>${lesson.title}</h1>
      ${lesson.paragraphs
        .map(
          (p) => `
            <div class="lesson-paragraph">
              <p>${p.text}</p>
              <p class="lesson-source"><cite>${p.source}</cite></p>
            </div>
          `,
        )
        .join('')}
      <a class="lesson-drill" href="#/${lesson.drillPath}">${lesson.drillLabel} →</a>
      ${next ? `<button class="lesson-next">Next: ${next.title}</button>` : ''}
    </section>
  `
  el.querySelector<HTMLButtonElement>('.lesson-back')!.addEventListener('click', () => {
    renderList(el)
  })
  el.querySelector<HTMLButtonElement>('.lesson-next')?.addEventListener('click', () => {
    renderLearn(el, { lessonId: next!.id })
  })
}

export const learnScreen: Screen = {
  path: 'learn',
  title: 'Learn',
  render(el) {
    renderLearn(el)
  },
}
