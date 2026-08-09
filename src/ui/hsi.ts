// HSI (horizontal situation indicator) drawn as a self-contained G1000-style
// PFD panel: a dark rounded plate filling the whole viewBox, carrying a
// heading-up rotating compass card, an airframe-fixed lubber mark, the aircraft
// symbol, the heading readout, the selected-value boxes either side of it and,
// when there is nav data, the status line along the panel's foot. Two optional
// teaching overlays a real G1000 does not have:
//   - thumb band: the 20° entry-shortcut aid from the 70° line down to the
//     3 o'clock index (9 o'clock side for nonstandard holds) — airframe-fixed
//   - sector wedges: AIM 5-3-8 j3 entry sectors, magnetic (rotate with card)
// Pure rendering: state in, SVG out. No internal state, no listeners.
//
// The nav picture — deviation bar, dots, TO/FROM — comes from `courseDeviation`
// in src/engine/nav.ts. This file adds only the display decisions the engine
// deliberately leaves out: full-scale deflection, dot spacing, pixels, and the
// clamp that pegs the bar on the outer dot instead of sliding it off the card.
//
// Two consumers: the entry drill (`src/modules/entry-drill.ts`) and the written
// test's entry figure (`src/modules/written-test.ts`), which passes heading and
// course only — see the no-nav contract on `HSIProps.nav`. Both share the `.hsi`
// rule in styles.css, so the panel's aspect ratio is a shared concern.
//
// Draws from the `pfd` group of the instrument palette (src/ui/palette.ts) —
// the dark half, matching the panel this instrument replicates. The plan view
// draws from `plate`; the two groups' entry colours are held to the same hue by
// palette.test.ts, so an entry keeps one colour code across both. The panel
// rect is what makes that measurable: it fills the viewBox, so every instrument
// mark sits on `pfd.face` and none of them straddles the light page.

import type { Entry, SectorArc, TurnDirection } from '../engine/entry'
import { normalizeDeg } from '../engine/geometry'
import { courseDeviation, type CourseDeviation } from '../engine/nav'
import { courseText, distanceText } from '../format'
import { OVERLAY_ALPHA, PALETTE } from './palette'

/** Where the aircraft is, which is what the deviation indication needs. */
export interface NavState {
  /** Ident of the fix being navigated to, as the status line shows it. */
  fix: string
  /** Distance to the fix, NM. Positive — `courseDeviation` rejects the rest. */
  distanceNm: number
}

export interface HSIProps {
  /** Aircraft magnetic heading; the card rotates so it sits under the lubber. */
  heading: number
  /** Selected course (e.g. inbound holding course); omit to hide the pointer. */
  course?: number
  /**
   * Selected-heading bug, degrees. Omit to hide both the bug and the HDG box:
   * a value box with nothing selected in it would be a readout of nothing.
   *
   * The entry drill parks the bug on the current heading, so on that screen the
   * HDG box, the bug and the heading readout all show the same number. That is
   * realistic — a pilot rolls the bug onto the nose when nothing else is
   * selected — and intentional. It is also why `hsi.test.ts` pins the bug's
   * drawn angle with `headingBug ≠ heading`: at the drill's own values the
   * composed screen angle is a constant 0, which an inverted rotation satisfies
   * just as well as the right one.
   */
  headingBug?: number
  /**
   * Aircraft position relative to the fix. Omit for the **no-nav contract**:
   * the course pointer is still drawn, and the deviation bar, its dots and the
   * TO/FROM flag are all suppressed — which is what a real HSI does when it has
   * no valid nav data. It does not centre the bar, because a centred bar reads
   * as "established on course". The written test's entry figure
   * (`src/modules/written-test.ts`) has no position at all and relies on this.
   *
   * Requires `course`: a deviation with nothing to deviate from is a caller
   * mistake and throws rather than rendering nothing.
   */
  nav?: NavState
  /** Show the thumb band for a right-turn (standard) or left-turn hold. */
  thumbOverlay?: TurnDirection
  /** Entry sectors from `determineEntry` — rendered verbatim, engine is the oracle. */
  sectorOverlay?: Record<Entry, SectorArc>
}

/**
 * Full-scale course deviation, in NM. This is what a dot means, and a student
 * will read the needle quantitatively, so it is a user-visible aviation fact
 * under the CLAUDE.md citation convention.
 *
 * 1.0 NM is GPS **terminal**-mode CDI sensitivity, verified against
 * faa.gov/air_traffic/publications/atpubs/aim_html/chap1_section_1.html. AIM
 * 1-1-17 b.4, verbatim: "The GPS receiver must be set to terminal (±1 NM) CDI
 * sensitivity and the navigation routes contained in the database in order to
 * fly published IFR charted departures and DPs." AIM 1-1-17 b.5(e)(3) gives the
 * other two modes in one sentence — the receiver changes "from en route CDI and
 * RAIM sensitivity of ±5 NM either side of centerline to ±1 NM terminal
 * sensitivity" when the approach is armed, 30 NM from the airport reference
 * point. The ±0.3 NM approach ramp is a *separate* sub-item, b.5(e)(5), and is
 * conditioned on 2 NM from the FAWP rather than on that 30 NM — this docblock
 * used to append it to the sentence above, which folds two distances into one
 * cite, the same shape as the withdrawal below.
 *
 * ⚠️ The *value* is cited; the *mode* is this drill's assumption and is not.
 * No FAA source says a hold is flown on terminal scaling, and b.5(e)(3) does not
 * supply one. This docblock used to claim it did — that the drill's 6–10 NM
 * window "sits well inside the 30 NM at which terminal scaling arms", so widening
 * it past 30 NM would make this constant 5. That inference compares two different
 * distances and is withdrawn: that 30 NM is measured from the airport/heliport
 * reference point with an approach loaded and armed, while the window is a
 * distance to a *holding fix*, which implies neither. A hold 8 NM from its fix can
 * sit hundreds of miles from any airport on en route ±5 NM. So the window in
 * src/modules/entry-drill.ts neither justifies this constant nor bounds it, and
 * re-tuning it is not a reason to revisit this value. See docs/content-audit.md,
 * 2026-08-07; the withdrawal is rendered to the student by `CDI_ARMING_AIM`.
 */
export const FULL_SCALE_NM = 1

/**
 * Where `FULL_SCALE_NM` comes from; the mode assumption above is not cited.
 *
 * A citation only satisfies the CLAUDE.md convention once it is *rendered*, and
 * this instrument draws no prose of its own — so the drill screen carries it,
 * beside the needle it explains: `CDI_SCALE_AIM`/`CDI_SCALE_NOTE` in
 * src/modules/entry-drill.ts, quotation and derivation split the way
 * `OUTBOUND_TIMING_AIM`/`_NOTE` are.
 */
export const FULL_SCALE_SOURCE = 'AIM 1-1-17 b.4'

/** Deviation dots per side: one at half scale, one at full scale. */
export const DEVIATION_DOTS = 2

// Lateral gap between adjacent dots, in viewBox units. The primitive the scale
// is built from — PX_PER_NM below is derived from it, so the bar offset and the
// dot positions cannot drift apart.
const DOT_SPACING = 15

/** viewBox units per NM of cross-track. One source for the bar and the dots. */
export const PX_PER_NM = (DEVIATION_DOTS * DOT_SPACING) / FULL_SCALE_NM

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
 * then the card (`cy ± roseR`), then room under it for the nav status line.
 * `cy` therefore sits below the panel's mid-height.
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

// Course pointer, as radii from the rose centre. The middle of the course line
// is *not* drawn by the pointer: that gap is where the deviation bar slides, and
// it stays empty when there is no nav data — a real HSI shows the arrow and the
// tail with the bar missing, rather than a centred bar that would read as
// "established on course".
//
//   74 ┬ arrowhead tip
//   60 ┴ arrowhead base, top of the stem
//   50 ┴ stem inner end
//   45 ┬ TO/FROM apex
//   36 ┴ TO/FROM base
//   30 ┴ deviation bar half-length
//    0   rose centre (mirrored below, tail crossbar at 62)
const POINTER_TIP = LAYOUT.tickR - 6
const POINTER_HEAD = LAYOUT.tickR - 20
const POINTER_TAIL = LAYOUT.tickR - 18
const POINTER_STEM = LAYOUT.tickR - 30
const POINTER_HALF_W = 7

// Deviation bar and TO/FROM flag, also as radii from the rose centre.
const BAR_HALF_LEN = 30
const FLAG_BASE = 36
const FLAG_APEX = 45
const FLAG_HALF_W = 6
const DOT_R = 2.4

// Selected-heading bug: a notch riding the outer edge of the card, wide enough
// that it still shows either side of the lubber mark when it is parked on the
// nose — which is where the entry drill leaves it.
const BUG_W = 16
const BUG_H = 7

// The two selected-value boxes flanking the heading readout, and the inset the
// nav status line's outer ends share with them.
const SIDE_BOX_W = 62
const PANEL_MARGIN = 5

// Nav status line along the panel's foot: baseline below the card, clear of it.
const STATUS_Y = 221
const STATUS_SIZE = 11

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

/**
 * The sliding bar, its dots and the TO/FROM flag, drawn in the course pointer's
 * local frame: local +x is the aircraft's right when it is on the course.
 *
 * The needle shows **where the course is**, not where the aircraft is, so it
 * deflects *opposite* the displacement — an aircraft right of course sees the
 * bar left of centre, and flies toward the needle to close. That is the one
 * sign in this file that inverts silently and plausibly; `hsi.test.ts` pins it
 * against hand-drawn goldens rather than against `courseDeviation`, which would
 * flip along with it.
 */
function deviation(dev: CourseDeviation): string {
  const m = PALETTE.pfd.course
  const { cx, cy } = LAYOUT
  const { crossTrackNm, sense } = dev
  const pegged = Math.max(-FULL_SCALE_NM, Math.min(FULL_SCALE_NM, crossTrackNm))
  const barX = r2(cx - pegged * PX_PER_NM)

  const dots: string[] = []
  for (let i = 1; i <= DEVIATION_DOTS; i += 1) {
    const dx = r2((i / DEVIATION_DOTS) * FULL_SCALE_NM * PX_PER_NM)
    for (const x of [cx - dx, cx + dx]) {
      dots.push(
        `<circle class="hsi-cdi-dot" cx="${x}" cy="${cy}" r="${DOT_R}" ` +
          `fill="${PALETTE.pfd.cardDim}"/>`,
      )
    }
  }

  // TO points at the arrowhead, FROM at the tail: the flag says which way the
  // selected course would take you relative to the fix, not which way to turn.
  const side = sense === 'to' ? -1 : 1
  const base = cy + side * FLAG_BASE
  const apex = cy + side * FLAG_APEX

  return (
    dots.join('') +
    `<line class="hsi-cdi-bar" x1="${barX}" y1="${cy - BAR_HALF_LEN}" x2="${barX}" ` +
    `y2="${cy + BAR_HALF_LEN}" stroke="${m}" stroke-width="3"/>` +
    `<polygon class="hsi-tofrom" data-sense="${sense}" points="${cx},${apex} ` +
    `${cx - FLAG_HALF_W},${base} ${cx + FLAG_HALF_W},${base}" fill="${m}"/>`
  )
}

function coursePointer(course: number, dev: CourseDeviation | undefined): string {
  // Drawn pointing up, rotated into place; magenta per G1000 GPS guidance. The
  // deviation rides inside this group, so it turns with the selected course and
  // — through `.hsi-rose` above it — with the compass card as well.
  const m = PALETTE.pfd.course
  const { cx, cy } = LAYOUT
  const tip = cy - POINTER_TIP
  const head = cy - POINTER_HEAD
  const stemTop = cy - POINTER_STEM
  const stemBottom = cy + POINTER_STEM
  const tail = cy + POINTER_TAIL
  return (
    `<g class="hsi-course" transform="rotate(${course} ${cx} ${cy})">` +
    `<polygon class="hsi-course-head" points="${cx},${tip} ${cx - POINTER_HALF_W},${head} ` +
    `${cx + POINTER_HALF_W},${head}" fill="${m}"/>` +
    `<line x1="${cx}" y1="${head}" x2="${cx}" y2="${stemTop}" stroke="${m}" stroke-width="2.6"/>` +
    `<line x1="${cx}" y1="${stemBottom}" x2="${cx}" y2="${tail}" stroke="${m}" ` +
    `stroke-width="2.6"/>` +
    `<line x1="${cx - POINTER_HALF_W}" y1="${tail}" x2="${cx + POINTER_HALF_W}" y2="${tail}" ` +
    `stroke="${m}" stroke-width="2.6"/>` +
    (dev === undefined ? '' : deviation(dev)) +
    `</g>`
  )
}

/**
 * The thumb band's edges in degrees **off the nose**: the nose-side edge is the
 * 70° line (on a heading-up card the direct/parallel boundary, d = −70 in
 * entry.ts, sits at course − heading = +70°) and the band runs 20° out from
 * there to the 3 o'clock index.
 *
 * Held here rather than inside `thumbBand` because the band is drawn in one
 * place and *spoken* in another (`overlayText`), and two hand-written copies of
 * "70 to 90" drift — the label would go on announcing a band the card had
 * stopped drawing. Mirroring to the 9 o'clock side for a nonstandard hold stays
 * in the drawing, which is the only place that needs card angles.
 *
 * It is a **boundary marker, not a sector**, which is why it is painted in a
 * marker colour and never an entry colour — see the ⚠️ on `paints the thumb
 * band in a marker colour` in hsi.test.ts.
 */
const THUMB_BAND_DEG = Object.freeze([70, 90] as const)

function thumbBand(turnDirection: TurnDirection): string {
  const [near, far] = THUMB_BAND_DEG
  const [from, to] = turnDirection === 'right' ? [near, far] : [360 - far, 360 - near]
  return (
    `<path class="hsi-thumb" data-from="${from}" data-to="${to}" ` +
    `d="${bandWedge(from, to, LAYOUT.roseR, LAYOUT.roseR - 9)}" ` +
    `fill="${PALETTE.pfd.cardDim}" fill-opacity="${OVERLAY_ALPHA.thumbBand}"/>`
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
 *  deviation bar reads across it. */
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

/**
 * One of the two selected-value boxes flanking the heading readout.
 *
 * The label and the digits are drawn in the colour that value is drawn in
 * everywhere else on the panel — cyan for the bug, magenta for the course — so
 * the box says which mark on the card it belongs to without a leader line. That
 * is why `pfd.bug` and `pfd.course` are classified `text` in palette.test.ts
 * rather than `graphic`: they render letters here, not only lines.
 *
 * Side and colour are resolved from `kind`, not passed in: both are facts about
 * which value the box shows, and a caller free to supply them is a caller free
 * to paint the CRS box cyan — which would break the rule above silently, since
 * the type system cannot see it.
 */
function valueBox(kind: 'hdg' | 'crs', deg: number): string {
  const { width, boxY, boxH } = LAYOUT
  const baseline = boxY + boxH - 4.5
  const isHdg = kind === 'hdg'
  const label = isHdg ? 'HDG' : 'CRS'
  const x = isHdg ? PANEL_MARGIN : width - PANEL_MARGIN - SIDE_BOX_W
  const colour = isHdg ? PALETTE.pfd.bug : PALETTE.pfd.course
  return (
    `<rect class="hsi-${kind}-box" x="${x}" y="${boxY}" width="${SIDE_BOX_W}" height="${boxH}" ` +
    `rx="2" fill="${PALETTE.pfd.face}" stroke="${PALETTE.pfd.chrome}"/>` +
    `<text class="hsi-${kind}-label" x="${x + 5}" y="${baseline}" fill="${colour}" ` +
    `font-size="9" font-family="${LABEL_FONT}">${label}</text>` +
    `<text class="hsi-${kind}-value" x="${x + SIDE_BOX_W - 5}" y="${baseline}" text-anchor="end" ` +
    `fill="${colour}" font-size="12" font-weight="700" ` +
    `font-family="${DIGIT_FONT}">${courseText(deg)}</text>`
  )
}

/**
 * The selected-heading bug — a notch on the card's outer edge, so it reads
 * against the heading tape the way the lubber does.
 *
 * It rides the card, not the airframe: the bug marks a *magnetic* heading, so
 * on screen it sits at `headingBug − heading` and drifts round to the nose as
 * the aircraft turns onto it. Drawn at the top and rotated, like every other
 * card mark here.
 */
function headingBug(bug: number): string {
  const { cx, cy, roseR } = LAYOUT
  const inner = cy - roseR
  const outer = inner - BUG_H
  const points =
    `${cx - BUG_W / 2},${outer} ${cx + BUG_W / 2},${outer} ` +
    `${cx + BUG_W / 4},${inner} ${cx - BUG_W / 4},${inner}`
  return (
    `<polygon class="hsi-bug" transform="rotate(${r2(bug)} ${cx} ${cy})" points="${points}" ` +
    `fill="${PALETTE.pfd.bug}"/>`
  )
}

/**
 * The nav status line along the panel's foot: source, mode, fix, distance, flag.
 *
 * `OBS` is not decoration. On a real G1000 with GPS as the nav source and an
 * active leg, the CRS knob is inoperative and a direct-to auto-slews the
 * desired track, so the CDI stays centred — the picture above, a manually
 * selected course with a live deflection, occurs in OBS/SUSP mode and nowhere
 * else. Annunciating it is what makes the depiction honest rather than merely
 * plausible.
 *
 * The flag word comes from the same `sense` the glyph on the card is drawn
 * from, so the two cannot disagree; `hsi.test.ts` asserts that from outside, in
 * case they are ever computed separately.
 */
function navStatus(nav: NavState, sense: CourseDeviation['sense']): string {
  const { width, cx } = LAYOUT
  const left = PANEL_MARGIN
  const right = width - PANEL_MARGIN
  const common = `y="${STATUS_Y}" font-size="${STATUS_SIZE}"`
  return (
    `<g class="hsi-status">` +
    // GPS is the magenta nav source, matching the pointer and the bar it drives.
    `<text class="hsi-nav-source" x="${left}" ${common} fill="${PALETTE.pfd.course}" ` +
    `font-family="${LABEL_FONT}">GPS</text>` +
    `<text class="hsi-obs" x="${left + 30}" ${common} fill="${PALETTE.pfd.card}" ` +
    `font-family="${LABEL_FONT}">OBS</text>` +
    `<text class="hsi-nav-fix" x="${cx}" ${common} text-anchor="middle" ` +
    `fill="${PALETTE.pfd.card}" font-family="${LABEL_FONT}">${nav.fix}</text>` +
    `<text class="hsi-nav-distance" x="${right - 34}" ${common} text-anchor="end" ` +
    `fill="${PALETTE.pfd.card}" ` +
    `font-family="${DIGIT_FONT}">${distanceText(nav.distanceNm)}</text>` +
    `<text class="hsi-nav-sense" x="${right}" ${common} text-anchor="end" ` +
    `fill="${PALETTE.pfd.course}" ` +
    `font-family="${LABEL_FONT}">${sense.toUpperCase()}</text>` +
    `</g>`
  )
}

/**
 * What the deviation bar reads, for the accessible description.
 *
 * In dots, because that is the unit the card draws and the student counts —
 * `FULL_SCALE_NM / DEVIATION_DOTS` per dot. The bar shows where the *course* is,
 * so it deflects opposite the cross-track: an aircraft right of course sees the
 * needle left, and this says which way the needle went, not which way the
 * aircraft is displaced. Pegged is named rather than numbered, because a bar on
 * the outer dot means "at least this far" — which at the drill's 6–10 NM is the
 * usual picture, and a number there would read as a measurement.
 */
function deviationText(crossTrackNm: number): string {
  const side = crossTrackNm > 0 ? 'left' : 'right'
  // The peg is where the clamp fires, so this test and `pegged` above read the
  // same threshold and the word cannot appear for a bar drawn short of the dot.
  if (Math.abs(crossTrackNm) >= FULL_SCALE_NM) return `deviation full scale ${side}`
  // Every wording below is chosen from the number this will PRINT, never from
  // the raw cross-track, so the three of them partition the pictures the panel
  // can actually draw. Classifying from the raw value splits at both ends:
  // a residual too small to move the bar off centre still fails `!== 0` and
  // gets a side, and 1.976 dots rounds to the peg's own count, "2.0 dots",
  // for a needle measurably short of the peg. Hence the clamp to one tenth
  // below full scale — round-to-nearest is kept (`Math.sin(30°)` is
  // 0.49999999999999994, and flooring would turn that exact one-dot picture
  // into "0.9 dots"), it just may not reach the count the clamp owns.
  const tenths = Math.min(
    Math.round((Math.abs(crossTrackNm) / (FULL_SCALE_NM / DEVIATION_DOTS)) * 10),
    DEVIATION_DOTS * 10 - 1,
  )
  if (tenths === 0) return 'deviation centred'
  return `deviation ${(tenths / 10).toFixed(1)} dots ${side}`
}

/**
 * The two teaching overlays, for the accessible description.
 *
 * They are drawn marks and nothing else on the panel repeats them, so without
 * this they are the half of learn mode a screen reader never receives — the
 * same silent loss `role="img"` inflicts on the deviation bar, but larger,
 * because here the marks *are* the teaching content and the drill prints no
 * other description of them before the answer.
 *
 * Read last, after the instrument: the panel is what the student is graded on
 * and the aid is layered over it, which is also the order the eye takes them in.
 *
 * The sector boundaries ride the card, so they are magnetic and go through
 * `courseText` like any other bearing. The band is airframe-fixed, so its
 * numbers are angles off the nose, not bearings — deliberately not `courseText`,
 * which would pad "70" to "070°" and read as a heading.
 */
function overlayText(props: HSIProps): string {
  let text = ''
  const sectors = props.sectorOverlay
  if (sectors !== undefined) {
    const arc = (entry: Entry): string =>
      `${entry} ${courseText(sectors[entry].from)} to ${courseText(sectors[entry].to)}`
    text += `, entry sectors: ${arc('direct')}, ${arc('teardrop')}, ${arc('parallel')}`
  }
  if (props.thumbOverlay !== undefined) {
    const [near, far] = THUMB_BAND_DEG
    // `turnDirection` is the side the band is drawn on, so it names the side.
    text += `, thumb band ${near}° to ${far}° ${props.thumbOverlay} of the nose`
  }
  return text
}

export function renderHSI(el: Element, props: HSIProps): void {
  const heading = normalizeDeg(props.heading)
  const course = props.course === undefined ? undefined : normalizeDeg(props.course)
  const bug = props.headingBug === undefined ? undefined : normalizeDeg(props.headingBug)
  const { width, height, cx, cy, roseR } = LAYOUT

  // Computed once and shared by the card's glyph, the status line's word and
  // the accessible description, so no two of them can describe different
  // aircraft. `courseDeviation` rejects a non-positive distance; that throw is
  // the caller's to fix and is deliberately not swallowed here.
  const nav = props.nav
  let dev: CourseDeviation | undefined
  if (nav !== undefined) {
    if (course === undefined) {
      throw new TypeError('nav deviation needs a selected course to deviate from')
    }
    dev = courseDeviation(heading, course, nav.distanceNm)
  }

  // role="img" below: a screen reader gets this whole string or none of the
  // picture, so a field that reaches the panel and not this line is invisible.
  // That includes the deviation bar — the one reading here that is a drawn mark
  // rather than a box of digits, and the reason this instrument replaced an
  // overhead-the-fix rose — and the two annunciators, which say which nav source
  // and mode the picture is of, and the two teaching overlays, which are drawn
  // marks no readout repeats. Ordered as the panel is read: the value boxes,
  // then the card, then the status line along the foot, then the overlays
  // layered over all three.
  const aria =
    `Heading ${courseText(heading)}` +
    // The HDG box is a field on the panel, so it belongs here even though the
    // drill parks it on the nose: at `headingBug === heading` this repeats a
    // number the sighted panel also shows twice, which is the faithful reading.
    (bug === undefined ? '' : `, heading bug ${courseText(bug)}`) +
    (course === undefined ? '' : `, course ${courseText(course)}`) +
    (nav === undefined || dev === undefined
      ? ''
      : `, ${deviationText(dev.crossTrackNm)}, GPS OBS, ` +
        `${nav.fix} ${distanceText(nav.distanceNm)}, ${dev.sense.toUpperCase()}`) +
    overlayText(props)

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
    (bug === undefined ? '' : headingBug(bug)) +
    (course === undefined ? '' : coursePointer(course, dev)) +
    `</g>` +
    // airframe-fixed: thumb band, lubber mark, aircraft symbol, the three value
    // boxes along the top and the nav status line along the foot
    (props.thumbOverlay ? thumbBand(props.thumbOverlay) : '') +
    lubber() +
    aircraft() +
    (bug === undefined ? '' : valueBox('hdg', bug)) +
    headingReadout(heading) +
    (course === undefined ? '' : valueBox('crs', course)) +
    (nav === undefined || dev === undefined ? '' : navStatus(nav, dev.sense)) +
    `</svg>`
}
