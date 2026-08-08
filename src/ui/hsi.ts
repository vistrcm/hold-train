// HSI (horizontal situation indicator) approximating a G1000 PFD compass
// rose: heading-up rotating card, magenta course pointer, fixed lubber line
// and aircraft symbol. Two optional teaching overlays:
//   - thumb band: the 20° entry-shortcut aid from the 70° line down to the
//     3 o'clock index (9 o'clock side for nonstandard holds) — airframe-fixed
//   - sector wedges: AIM 5-3-8 j3 entry sectors, magnetic (rotate with card)
// Pure rendering: state in, SVG out. No internal state, no listeners.
//
// Draws from the `pfd` group of the instrument palette (src/ui/palette.ts) —
// the dark half, matching the panel this instrument replicates. The plan view
// draws from `plate`; the two groups' entry colours are held to the same hue by
// palette.test.ts, so an entry keeps one colour code across both.

import type { Entry, SectorArc, TurnDirection } from '../engine/entry'
import { normalizeDeg } from '../engine/geometry'
import { courseText } from '../format'
import { OVERLAY_ALPHA, PALETTE } from './palette'

export interface HSIProps {
  /** Aircraft magnetic heading; the card rotates so it sits under the lubber. */
  heading: number
  /** Selected course (e.g. inbound holding course); omit to hide the pointer. */
  course?: number
  /** Show the thumb band for a right-turn (standard) or left-turn hold. */
  thumbOverlay?: TurnDirection
  /** Entry sectors from `determineEntry` — rendered verbatim, engine is the oracle. */
  sectorOverlay?: Record<Entry, SectorArc>
}

const C = 100 // rose center
const ROSE_R = 78
const TICK_R = 74
const LABEL_R = 52

// Card labels every 30°, G1000 style: cardinal letters, numbers without the
// trailing zero elsewhere.
const LABELS = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33']

function r2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Point at `deg` (0 = up, clockwise) and radius from the rose center. */
function polar(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return { x: r2(C + radius * Math.sin(rad)), y: r2(C - radius * Math.cos(rad)) }
}

/** Pie wedge from `from` to `to` clockwise, out to `radius`. */
function pieWedge(from: number, to: number, radius: number): string {
  const a = polar(from, radius)
  const b = polar(to, radius)
  const largeArc = normalizeDeg(to - from) > 180 ? 1 : 0
  return `M ${C} ${C} L ${a.x} ${a.y} A ${radius} ${radius} 0 ${largeArc} 1 ${b.x} ${b.y} Z`
}

/** Ring segment from `from` to `to` clockwise between two radii. */
function bandWedge(from: number, to: number, outer: number, inner: number): string {
  const ao = polar(from, outer)
  const bo = polar(to, outer)
  const bi = polar(to, inner)
  const ai = polar(from, inner)
  const largeArc = normalizeDeg(to - from) > 180 ? 1 : 0
  return (
    `M ${ao.x} ${ao.y} A ${outer} ${outer} 0 ${largeArc} 1 ${bo.x} ${bo.y} ` +
    `L ${bi.x} ${bi.y} A ${inner} ${inner} 0 ${largeArc} 0 ${ai.x} ${ai.y} Z`
  )
}

function ticks(): string {
  const parts: string[] = []
  for (let deg = 0; deg < 360; deg += 5) {
    const major = deg % 10 === 0
    const outer = polar(deg, TICK_R)
    const inner = polar(deg, TICK_R - (major ? 9 : 5))
    const color = major ? PALETTE.pfd.card : PALETTE.pfd.cardDim
    parts.push(
      `<line class="hsi-tick" x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}" ` +
        `stroke="${color}" stroke-width="${major ? 1.6 : 1}"/>`,
    )
  }
  return parts.join('')
}

function labels(): string {
  return LABELS.map((label, i) => {
    const deg = i * 30
    const cardinal = label.length === 1
    return (
      `<text class="hsi-label" x="${C}" y="${C - LABEL_R}" transform="rotate(${deg} ${C} ${C})" ` +
      `text-anchor="middle" fill="${PALETTE.pfd.card}" font-size="${cardinal ? 13 : 11}" ` +
      `font-weight="${cardinal ? 700 : 400}" font-family="system-ui, sans-serif">${label}</text>`
    )
  }).join('')
}

function sectorOverlay(sectors: Record<Entry, SectorArc>): string {
  const entries: Entry[] = ['direct', 'teardrop', 'parallel']
  return entries
    .map((entry) => {
      const { from, to } = sectors[entry]
      const color = PALETTE.pfd.entry[entry]
      // The boundary carries the sector at full strength (a stroke-opacity here
      // composited to ~1.9:1 against the old white face, below the 3:1 SC
      // 1.4.11 asks of a graphical object); the fill only tints the wedge.
      return (
        `<path class="hsi-sector hsi-sector-${entry}" data-from="${from}" data-to="${to}" ` +
        `d="${pieWedge(from, to, TICK_R)}" fill="${color}" fill-opacity="${OVERLAY_ALPHA.sectorFill}" ` +
        `stroke="${color}" stroke-width="0.8"/>`
      )
    })
    .join('')
}

function coursePointer(course: number): string {
  // Drawn pointing up, rotated into place; magenta per G1000 GPS guidance.
  const m = PALETTE.pfd.course
  return (
    `<g class="hsi-course" transform="rotate(${course} ${C} ${C})">` +
    `<polygon points="100,32 94,46 106,46" fill="${m}"/>` +
    `<line x1="100" y1="46" x2="100" y2="162" stroke="${m}" stroke-width="2.4"/>` +
    `<line x1="94" y1="162" x2="106" y2="162" stroke="${m}" stroke-width="2.4"/>` +
    `</g>`
  )
}

function thumbBand(turnDirection: TurnDirection): string {
  // Screen-fixed 20° band whose nose-side edge is the 70° line: on a
  // heading-up card the direct/parallel boundary (d = −70 in entry.ts) sits
  // at course − heading = +70°, i.e. 70° right of the nose. The band spans
  // from there down to the 3 o'clock index; mirrored to the 9 o'clock side
  // for a nonstandard (left-turn) hold.
  const [from, to] = turnDirection === 'right' ? [70, 90] : [270, 290]
  return (
    `<path class="hsi-thumb" data-from="${from}" data-to="${to}" ` +
    `d="${bandWedge(from, to, ROSE_R, ROSE_R - 8)}" fill="${PALETTE.pfd.entry.teardrop}" ` +
    `fill-opacity="${OVERLAY_ALPHA.thumbBand}"/>`
  )
}

export function renderHSI(el: Element, props: HSIProps): void {
  const heading = normalizeDeg(props.heading)
  const course = props.course === undefined ? undefined : normalizeDeg(props.course)

  const aria =
    `Heading ${courseText(heading)}` + (course === undefined ? '' : `, course ${courseText(course)}`)

  el.innerHTML =
    `<svg class="hsi" viewBox="0 0 200 200" role="img" aria-label="${aria}">` +
    // rotating card: bezel, sector wedges, ticks, labels, course pointer
    `<g class="hsi-rose" transform="rotate(${r2(-heading)} ${C} ${C})">` +
    `<circle cx="${C}" cy="${C}" r="${ROSE_R}" fill="${PALETTE.pfd.face}" ` +
    `stroke="${PALETTE.pfd.chrome}" stroke-width="2"/>` +
    (props.sectorOverlay ? sectorOverlay(props.sectorOverlay) : '') +
    ticks() +
    labels() +
    (course === undefined ? '' : coursePointer(course)) +
    `</g>` +
    // airframe-fixed: thumb band, lubber line, aircraft symbol, readout
    (props.thumbOverlay ? thumbBand(props.thumbOverlay) : '') +
    `<polygon class="hsi-lubber" points="100,26 95,15 105,15" fill="${PALETTE.pfd.card}"/>` +
    `<path class="hsi-aircraft" d="M100 90 L100 112 M90 99 L110 99 M95 109 L105 109" ` +
    `stroke="${PALETTE.pfd.card}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<rect x="79" y="0" width="42" height="15" rx="2" fill="${PALETTE.pfd.face}" ` +
    `stroke="${PALETTE.pfd.chrome}"/>` +
    `<text class="hsi-heading-readout" x="${C}" y="11.5" text-anchor="middle" ` +
    `fill="${PALETTE.pfd.card}" ` +
    `font-size="11" font-weight="700" font-family="system-ui, sans-serif">${courseText(heading)}</text>` +
    `</svg>`
}
