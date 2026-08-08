// HSI (horizontal situation indicator) drawn as a self-contained G1000-style
// PFD panel: a dark rounded plate filling the whole viewBox, carrying a
// heading-up rotating compass card, an airframe-fixed lubber mark, the aircraft
// symbol and the heading readout. Two optional teaching overlays a real G1000
// does not have:
//   - thumb band: the 20° entry-shortcut aid from the 70° line down to the
//     3 o'clock index (9 o'clock side for nonstandard holds) — airframe-fixed
//   - sector wedges: AIM 5-3-8 j3 entry sectors, magnetic (rotate with card)
// Pure rendering: state in, SVG out. No internal state, no listeners.
//
// Two consumers: the entry drill (`src/modules/entry-drill.ts`) and the written
// test's entry figure (`src/modules/written-test.ts`), which passes heading and
// course only. Both share the `.hsi` rule in styles.css, so the panel's aspect
// ratio is a shared concern.
//
// Draws from the `pfd` group of the instrument palette (src/ui/palette.ts) —
// the dark half, matching the panel this instrument replicates. The plan view
// draws from `plate`; the two groups' entry colours are held to the same hue by
// palette.test.ts, so an entry keeps one colour code across both. The panel
// rect is what makes that measurable: it fills the viewBox, so every instrument
// mark sits on `pfd.face` and none of them straddles the light page.

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

/**
 * Panel geometry, in viewBox units.
 *
 * Exported so `hsi.test.ts` can place a mark against the layout instead of
 * against a retyped magic number: every one of these moved when the square
 * white rose became a taller dark panel, and a coordinate hard-coded in a test
 * would have had to be re-derived by hand alongside the very change it is
 * supposed to be checking.
 *
 * The vertical budget, top to bottom: the value boxes, then the lubber mark,
 * then the card (`cy ± roseR`), then room under it for the nav status line
 * Task 5 adds. `cy` therefore sits below the panel's mid-height.
 */
export const LAYOUT = Object.freeze({
  /** viewBox extent. The panel rect fills exactly this. */
  width: 240,
  height: 230,
  /** Rose centre — everything polar is measured from here. */
  cx: 120,
  cy: 122,
  /** Compass card outer edge, where the lubber mark's apex lands. */
  roseR: 84,
  /** Outer end of the heading ticks, just inside the card edge. */
  tickR: 80,
  /** Baseline radius of the 30° card labels. */
  labelR: 56,
  /** Top edge and height of the value boxes along the panel's top. */
  boxY: 4,
  boxH: 17,
  /** Width of the centred heading readout box. */
  readoutW: 48,
})

// The lubber is a downward triangle whose apex touches the card edge.
const LUBBER_H = 13
const LUBBER_W = 13

// Tick lengths inward from `tickR`; the 10° marks are the long, bright ones.
const MAJOR_TICK = 10
const MINOR_TICK = 6

// Course pointer, as radii from the rose centre. Transitional geometry — the
// deviation bar splits this line in Task 4.
const POINTER_TIP = LAYOUT.tickR - 6
const POINTER_HEAD = LAYOUT.tickR - 20
const POINTER_TAIL = LAYOUT.tickR - 12
const POINTER_HALF_W = 7

// Avionics readouts are monospaced: a proportional stack shuffles the digits
// sideways as the value changes, which reads as jitter on a live heading. A
// system stack, so this costs no webfont (and no new dependency).
const DIGIT_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const LABEL_FONT = 'system-ui, sans-serif'

// Card labels every 30°, G1000 style: cardinal letters, numbers without the
// trailing zero elsewhere.
const LABELS = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33']

function r2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Point at `deg` (0 = up, clockwise) and radius from the rose center. */
function polar(deg: number, radius: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return {
    x: r2(LAYOUT.cx + radius * Math.sin(rad)),
    y: r2(LAYOUT.cy - radius * Math.cos(rad)),
  }
}

/** Pie wedge from `from` to `to` clockwise, out to `radius`. */
function pieWedge(from: number, to: number, radius: number): string {
  const a = polar(from, radius)
  const b = polar(to, radius)
  const largeArc = normalizeDeg(to - from) > 180 ? 1 : 0
  return (
    `M ${LAYOUT.cx} ${LAYOUT.cy} L ${a.x} ${a.y} ` +
    `A ${radius} ${radius} 0 ${largeArc} 1 ${b.x} ${b.y} Z`
  )
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
    const outer = polar(deg, LAYOUT.tickR)
    const inner = polar(deg, LAYOUT.tickR - (major ? MAJOR_TICK : MINOR_TICK))
    const color = major ? PALETTE.pfd.card : PALETTE.pfd.cardDim
    parts.push(
      `<line class="hsi-tick" x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}" ` +
        `stroke="${color}" stroke-width="${major ? 1.7 : 1.1}"/>`,
    )
  }
  return parts.join('')
}

function labels(): string {
  return LABELS.map((label, i) => {
    const deg = i * 30
    const cardinal = label.length === 1
    return (
      `<text class="hsi-label" x="${LAYOUT.cx}" y="${LAYOUT.cy - LAYOUT.labelR}" ` +
      `transform="rotate(${deg} ${LAYOUT.cx} ${LAYOUT.cy})" text-anchor="middle" ` +
      `fill="${PALETTE.pfd.card}" font-size="${cardinal ? 14 : 12}" ` +
      `font-weight="${cardinal ? 700 : 400}" font-family="${LABEL_FONT}">${label}</text>`
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
        `d="${pieWedge(from, to, LAYOUT.tickR)}" fill="${color}" ` +
        `fill-opacity="${OVERLAY_ALPHA.sectorFill}" stroke="${color}" stroke-width="0.9"/>`
      )
    })
    .join('')
}

function coursePointer(course: number): string {
  // Drawn pointing up, rotated into place; magenta per G1000 GPS guidance.
  const m = PALETTE.pfd.course
  const { cx, cy } = LAYOUT
  const tip = cy - POINTER_TIP
  const head = cy - POINTER_HEAD
  const tail = cy + POINTER_TAIL
  return (
    `<g class="hsi-course" transform="rotate(${course} ${cx} ${cy})">` +
    `<polygon points="${cx},${tip} ${cx - POINTER_HALF_W},${head} ` +
    `${cx + POINTER_HALF_W},${head}" fill="${m}"/>` +
    `<line x1="${cx}" y1="${head}" x2="${cx}" y2="${tail}" stroke="${m}" stroke-width="2.6"/>` +
    `<line x1="${cx - POINTER_HALF_W}" y1="${tail}" x2="${cx + POINTER_HALF_W}" y2="${tail}" ` +
    `stroke="${m}" stroke-width="2.6"/>` +
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
    `d="${bandWedge(from, to, LAYOUT.roseR, LAYOUT.roseR - 9)}" ` +
    `fill="${PALETTE.pfd.entry.teardrop}" fill-opacity="${OVERLAY_ALPHA.thumbBand}"/>`
  )
}

/** Downward triangle on the centreline, apex touching the card edge. */
function lubber(): string {
  const { cx, cy, roseR } = LAYOUT
  const apex = cy - roseR
  const base = apex - LUBBER_H
  return (
    `<polygon class="hsi-lubber" points="${cx},${apex} ${cx - LUBBER_W / 2},${base} ` +
    `${cx + LUBBER_W / 2},${base}" fill="${PALETTE.pfd.card}"/>`
  )
}

/** Fuselage, wing and tailplane, symmetric about the rose centre so the
 *  deviation bar (Task 4) reads across it. */
function aircraft(): string {
  const { cx, cy } = LAYOUT
  const d =
    `M ${cx} ${cy - 13} L ${cx} ${cy + 13} ` +
    `M ${cx - 12} ${cy - 1} L ${cx + 12} ${cy - 1} ` +
    `M ${cx - 5} ${cy + 9} L ${cx + 5} ${cy + 9}`
  return (
    `<path class="hsi-aircraft" d="${d}" stroke="${PALETTE.pfd.card}" stroke-width="2.2" ` +
    `fill="none" stroke-linecap="round"/>`
  )
}

/** The current-heading box, centred above the lubber mark. */
function headingReadout(heading: number): string {
  const { cx, boxY, boxH, readoutW } = LAYOUT
  return (
    `<rect class="hsi-heading-box" x="${cx - readoutW / 2}" y="${boxY}" width="${readoutW}" ` +
    `height="${boxH}" rx="2" fill="${PALETTE.pfd.face}" stroke="${PALETTE.pfd.chrome}"/>` +
    `<text class="hsi-heading-readout" x="${cx}" y="${boxY + boxH - 4.5}" text-anchor="middle" ` +
    `fill="${PALETTE.pfd.card}" font-size="12" font-weight="700" ` +
    `font-family="${DIGIT_FONT}">${courseText(heading)}</text>`
  )
}

export function renderHSI(el: Element, props: HSIProps): void {
  const heading = normalizeDeg(props.heading)
  const course = props.course === undefined ? undefined : normalizeDeg(props.course)
  const { width, height, cx, cy, roseR } = LAYOUT

  const aria =
    `Heading ${courseText(heading)}` + (course === undefined ? '' : `, course ${courseText(course)}`)

  el.innerHTML =
    `<svg class="hsi" viewBox="0 0 ${width} ${height}" role="img" aria-label="${aria}">` +
    // The panel is the backdrop, so it is painted first and fills the viewBox:
    // no instrument mark touches the light page, which is what lets
    // palette.test.ts measure the whole `pfd` group against a single face.
    `<rect class="hsi-panel" x="0" y="0" width="${width}" height="${height}" rx="10" ` +
    `fill="${PALETTE.pfd.face}"/>` +
    // rotating card: card ring, sector wedges, ticks, labels, course pointer
    `<g class="hsi-rose" transform="rotate(${r2(-heading)} ${cx} ${cy})">` +
    `<circle class="hsi-card-ring" cx="${cx}" cy="${cy}" r="${roseR}" fill="none" ` +
    `stroke="${PALETTE.pfd.chrome}" stroke-width="1.6"/>` +
    (props.sectorOverlay ? sectorOverlay(props.sectorOverlay) : '') +
    ticks() +
    labels() +
    (course === undefined ? '' : coursePointer(course)) +
    `</g>` +
    // airframe-fixed: thumb band, lubber mark, aircraft symbol, heading readout
    (props.thumbOverlay ? thumbBand(props.thumbOverlay) : '') +
    lubber() +
    aircraft() +
    headingReadout(heading) +
    `</svg>`
}
