// Display formatting shared by every layer that shows a bearing to the pilot.
// The engine keeps courses in [0, 360) (360 rejected); turning that into the
// three-digit readout a pilot reads on a plate or an HSI is the display side's
// job — and there is exactly one right answer, so there is one function.

/** Aviation course/heading readout: three digits, 0 shown as 360. */
export function courseText(deg: number): string {
  const d = Math.round(deg) === 0 ? 360 : Math.round(deg)
  return `${String(d).padStart(3, '0')}°`
}
