// Display formatting shared by every layer that shows a bearing to the pilot.
// The engine keeps courses in [0, 360) (360 rejected); turning that into the
// three-digit readout a pilot reads on a plate or an HSI is the display side's
// job — and there is exactly one right answer, so there is one function.

/** Aviation course/heading readout: three digits, 0 shown as 360. */
export function courseText(deg: number): string {
  const d = Math.round(deg) === 0 ? 360 : Math.round(deg)
  return `${String(d).padStart(3, '0')}°`
}

/**
 * Distance-to-fix readout: one decimal and the unit, e.g. `12.4 NM`.
 *
 * One function for the same reason `courseText` is one function — the HSI's nav
 * status line and the drill screen both show the aircraft's distance from the
 * fix, and two roundings that disagree would put "12.4 NM" on the panel beside
 * "12 NM" in the prose, on one screen, describing one aircraft.
 *
 * Always one decimal, including on a whole number: a field that switches
 * between "12 NM" and "12.4 NM" shifts sideways as the value changes, which is
 * the same jitter the monospace digit stack in `hsi.ts` exists to avoid.
 *
 * Rejects negatives and non-finites rather than rendering them. A distance is a
 * magnitude, so a negative one is a caller bug, and `(-0.04).toFixed(1)` is the
 * string `"-0.0"` — a readout that says minus zero nautical miles is worse than
 * a throw, because it looks like a value.
 */
export function distanceText(nm: number): string {
  if (!Number.isFinite(nm) || nm < 0) {
    throw new RangeError(`distance must be a non-negative number of NM, got ${nm}`)
  }
  return `${nm.toFixed(1)} NM`
}
