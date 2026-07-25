// Map view: north-up plan view of a holding pattern — racetrack on the
// holding side, fix marker, ownship, flown ground track vs ghost track, and
// entry-path illustrations (teardrop 30° offset toward the holding side;
// parallel on the non-holding side with a >180° pattern-direction reintercept).
// Entry directions come from entryGuidance — the engine is the oracle.
// Shares the HSI's instrument palette (src/ui/palette.ts), so an entry keeps
// one colour across the compass rose and the plan view.
// Pure rendering: state in, SVG out. No internal state, no listeners.
//
// Geometry is computed in NM east/north of the fix (fix at the origin), then
// projected once onto the 200×200 viewBox: fix at center, y flipped, scale
// chosen per hold so the racetrack plus entry turns fit at any leg length.

import type { LegSpec } from '../engine/clearance'
import { type Entry, type EntryGuidance, type TurnDirection, entryGuidance } from '../engine/entry'
import { assertCourse, normalizeDeg } from '../engine/geometry'
import { courseText } from '../format'
import { PALETTE } from './palette'

/** Position in NM east/north of the holding fix. */
export interface MapPoint {
  e: number
  n: number
}

export interface Ownship {
  position: MapPoint
  heading: number
}

/** The slice of a hold the map needs; a full HoldSpec satisfies it. */
export interface MapHold {
  fix?: string
  /** Inbound holding course TO the fix, degrees magnetic in [0, 360). */
  inboundCourse: number
  turnDirection: TurnDirection
  leg: LegSpec
}

export interface MapProps {
  holdSpec: MapHold
  ownship?: Ownship
  /** Flown ground track, oldest point first. */
  track?: MapPoint[]
  /** Ideal track for comparison, drawn dashed. */
  ghostTrack?: MapPoint[]
  /** Illustrate this entry's path from the fix. */
  entryPath?: Entry
}

const C = 100 // fix position: viewBox center
const NM_PER_MIN = 1.5 // ~90 kt ground speed in the hold (C172)
const TURN_RADIUS_NM = 0.48 // standard-rate 180° at ~90 kt: 1.5 NM of arc / π
const PARALLEL_OFFSET_NM = 0.15 // draw the parallel leg visibly off the course line
const ROOM = 84 // svg units for leg length + entry turns along the course axis

function r2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Unit vector (NM east/north) pointing along a compass course. */
function unit(courseDeg: number): MapPoint {
  const rad = (courseDeg * Math.PI) / 180
  return { e: Math.sin(rad), n: Math.cos(rad) }
}

function add(a: MapPoint, b: MapPoint, k = 1): MapPoint {
  return { e: a.e + k * b.e, n: a.n + k * b.n }
}

function project(p: MapPoint, scale: number): { x: number; y: number } {
  return { x: r2(C + p.e * scale), y: r2(C - p.n * scale) }
}

function pt(p: MapPoint, scale: number): string {
  const { x, y } = project(p, scale)
  return `${x} ${y}`
}

function assertPoint(p: MapPoint, name: string): void {
  if (!Number.isFinite(p.e) || !Number.isFinite(p.n)) {
    throw new RangeError(`${name} must be finite NM offsets, got (${p.e}, ${p.n})`)
  }
}

function legLengthNm(leg: LegSpec): number {
  if (!Number.isFinite(leg.value) || leg.value <= 0) {
    throw new RangeError(`leg value must be positive, got ${leg.value}`)
  }
  return leg.unit === 'min' ? leg.value * NM_PER_MIN : leg.value
}

// --- layers ------------------------------------------------------------------

function racetrack(hold: MapHold, legNm: number, scale: number): string {
  const c = hold.inboundCourse
  const s = hold.turnDirection === 'right' ? 1 : -1
  const along = unit(c)
  const holdingSide = unit(normalizeDeg(c + 90 * s))
  const sweep = s === 1 ? 1 : 0 // right turns are clockwise on a north-up map
  const rr = r2(TURN_RADIUS_NM * scale)

  const fix: MapPoint = { e: 0, n: 0 }
  const start = add(fix, along, -legNm) // start of the inbound leg
  const outboundAbeamFix = add(fix, holdingSide, 2 * TURN_RADIUS_NM)
  const outboundEnd = add(start, holdingSide, 2 * TURN_RADIUS_NM)

  const d =
    `M ${pt(start, scale)} L ${pt(fix, scale)} ` +
    `A ${rr} ${rr} 0 0 ${sweep} ${pt(outboundAbeamFix, scale)} ` +
    `L ${pt(outboundEnd, scale)} ` +
    `A ${rr} ${rr} 0 0 ${sweep} ${pt(start, scale)} Z`

  const mid = project(add(fix, along, -legNm / 2), scale)
  return (
    `<path class="map-racetrack" data-turn="${hold.turnDirection}" d="${d}" ` +
    `fill="none" stroke="${PALETTE.ink}" stroke-width="1.8"/>` +
    // direction-of-flight arrow on the inbound leg
    `<polygon class="map-course-arrow" points="0,-4.5 3.5,3.5 -3.5,3.5" fill="${PALETTE.ink}" ` +
    `transform="translate(${mid.x} ${mid.y}) rotate(${r2(c)})"/>`
  )
}

/**
 * Turning-flight arc helpers: for a turn in direction `s` (+1 right, -1 left),
 * the turn center sits 90° to that side of the current heading, and the
 * aircraft sits on the circle at (heading − 90°·s) from the center.
 */
function turnCenter(p: MapPoint, heading: number, s: 1 | -1): MapPoint {
  return add(p, unit(normalizeDeg(heading + 90 * s)), TURN_RADIUS_NM)
}

function pointAtHeading(center: MapPoint, heading: number, s: 1 | -1): MapPoint {
  return add(center, unit(normalizeDeg(heading - 90 * s)), TURN_RADIUS_NM)
}

function entryPathD(entry: Entry, g: EntryGuidance, hold: MapHold, legNm: number, scale: number): string {
  const c = hold.inboundCourse
  const s: 1 | -1 = hold.turnDirection === 'right' ? 1 : -1
  const rr = r2(TURN_RADIUS_NM * scale)
  const fix: MapPoint = { e: 0, n: 0 }

  if (entry === 'direct') {
    // cross the fix and fly the racetrack turn to outbound
    const holdingSide = unit(normalizeDeg(c + 90 * s))
    const abeam = add(fix, holdingSide, 2 * TURN_RADIUS_NM)
    const outboundEnd = add(abeam, unit(g.outboundHeading), legNm)
    const sweep = s === 1 ? 1 : 0
    return (
      `M ${pt(fix, scale)} A ${rr} ${rr} 0 0 ${sweep} ${pt(abeam, scale)} ` +
      `L ${pt(outboundEnd, scale)}`
    )
  }

  if (entry === 'teardrop') {
    // outbound 30° toward the holding side, then a >180° pattern-direction turn
    const legEnd = add(fix, unit(g.outboundHeading), legNm)
    const center = turnCenter(legEnd, g.outboundHeading, s)
    const rollout = pointAtHeading(center, c, s)
    const sweep = s === 1 ? 1 : 0
    return (
      `M ${pt(fix, scale)} L ${pt(legEnd, scale)} ` +
      `A ${rr} ${rr} 0 1 ${sweep} ${pt(rollout, scale)} L ${pt(fix, scale)}`
    )
  }

  // parallel: outbound on the non-holding side, then a >180° turn in the
  // pattern's direction back to an intercept (AIM 5-3-8 j3(a))
  const nonHoldingSide = unit(normalizeDeg(c - 90 * s))
  const legEnd = add(add(fix, unit(g.outboundHeading), legNm), nonHoldingSide, PARALLEL_OFFSET_NM)
  const center = turnCenter(legEnd, g.outboundHeading, s)
  // roll out angled 30° into the inbound course, converging from the
  // non-holding side
  const rollout = pointAtHeading(center, normalizeDeg(c + 30 * s), s)
  const sweep = s === 1 ? 1 : 0
  return (
    `M ${pt(fix, scale)} L ${pt(legEnd, scale)} ` +
    `A ${rr} ${rr} 0 1 ${sweep} ${pt(rollout, scale)} L ${pt(fix, scale)}`
  )
}

function entryOverlay(entry: Entry, hold: MapHold, legNm: number, scale: number): string {
  const g = entryGuidance(entry, hold)
  return (
    `<g class="map-entry map-entry-${entry}" data-outbound-heading="${g.outboundHeading}" ` +
    `data-side="${g.side}" data-turn-to-inbound="${g.turnToInbound}">` +
    `<path d="${entryPathD(entry, g, hold, legNm, scale)}" fill="none" ` +
    `stroke="${PALETTE.entry[entry]}" stroke-width="2" stroke-dasharray="5 3" ` +
    `stroke-linecap="round"/></g>`
  )
}

function polyline(points: MapPoint[], scale: number, cls: string, name: string): string {
  if (points.length === 0) {
    return ''
  }
  for (const p of points) {
    assertPoint(p, name)
  }
  const pts = points
    .map((p) => {
      const { x, y } = project(p, scale)
      return `${x},${y}`
    })
    .join(' ')
  const style =
    cls === 'map-ghost-track'
      ? `stroke="${PALETTE.inkDim}" stroke-width="1.4" stroke-dasharray="3 3"`
      : `stroke="${PALETTE.readout}" stroke-width="1.6"`
  return `<polyline class="${cls}" points="${pts}" fill="none" ${style}/>`
}

function fixMarker(name: string | undefined): string {
  // open triangle, FAA-chart intersection style
  const label = name
    ? `<text class="map-fix-label" x="${C + 7}" y="${C - 5}" fill="${PALETTE.ink}" font-size="9" ` +
      `font-weight="700" font-family="system-ui, sans-serif">${name}</text>`
    : ''
  return (
    `<polygon class="map-fix" points="${C},${C - 4.5} ${C + 4},${C + 3} ${C - 4},${C + 3}" ` +
    `fill="${PALETTE.face}" stroke="${PALETTE.ink}" stroke-width="1.5"/>` + label
  )
}

function ownshipEl(ownship: Ownship, scale: number): string {
  assertPoint(ownship.position, 'ownship position')
  const heading = normalizeDeg(ownship.heading)
  const { x, y } = project(ownship.position, scale)
  return (
    `<g class="map-ownship" data-heading="${heading}" ` +
    `transform="translate(${x} ${y}) rotate(${r2(heading)})">` +
    `<path d="M0 -6 L0 6 M-5 -1 L5 -1 M-3 4.5 L3 4.5" stroke="${PALETTE.ink}" ` +
    `stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`
  )
}

function northArrow(): string {
  // The arrow itself is a graphic and may sit at the dim 3:1 tier; the "N" is
  // a letter, so it takes the full-contrast ink instead.
  return (
    `<g class="map-north">` +
    `<line x1="14" y1="26" x2="14" y2="13" stroke="${PALETTE.inkDim}" stroke-width="1.5"/>` +
    `<polygon points="14,8 10.5,15 17.5,15" fill="${PALETTE.inkDim}"/>` +
    `<text x="21" y="19" fill="${PALETTE.ink}" font-size="9" font-weight="700" ` +
    `font-family="system-ui, sans-serif">N</text></g>`
  )
}

export function renderMap(el: Element, props: MapProps): void {
  const hold = props.holdSpec
  assertCourse(hold.inboundCourse, 'inboundCourse')
  const legNm = legLengthNm(hold.leg)
  // fit leg + turn diameter + entry-turn excursions along the course axis
  const scale = ROOM / (legNm + 3 * TURN_RADIUS_NM)

  const aria =
    `Holding pattern map: inbound course ${courseText(hold.inboundCourse)}, ` +
    `${hold.turnDirection} turns`

  el.innerHTML =
    `<svg class="mapview" viewBox="0 0 200 200" role="img" aria-label="${aria}" ` +
    `data-scale="${r2(scale)}">` +
    `<rect x="1" y="1" width="198" height="198" rx="8" fill="${PALETTE.face}" ` +
    `stroke="${PALETTE.bezel}" stroke-width="2"/>` +
    racetrack(hold, legNm, scale) +
    (props.entryPath ? entryOverlay(props.entryPath, hold, legNm, scale) : '') +
    (props.ghostTrack ? polyline(props.ghostTrack, scale, 'map-ghost-track', 'ghostTrack point') : '') +
    (props.track ? polyline(props.track, scale, 'map-track', 'track point') : '') +
    fixMarker(hold.fix) +
    (props.ownship ? ownshipEl(props.ownship, scale) : '') +
    northArrow() +
    `</svg>`
}
