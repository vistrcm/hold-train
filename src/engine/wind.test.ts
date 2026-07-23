// Wind-correction and timing math, locked to the AIM worked examples
// (all verified verbatim against AIM 5-3-8 fetched from faa.gov):
//   j8 — "Compensate for wind effect primarily by drift correction on the
//        inbound and outbound legs. When outbound, triple the inbound drift
//        correction ...; for example, if correcting left by 8 degrees when
//        inbound, correct right by 24 degrees when outbound."
//   j4 — inbound leg 1 minute at or below 14,000 ft MSL; timing for
//        subsequent outbound legs adjusted to achieve proper inbound time.
//   j5 — DME/GPS ATD holding: end of outbound leg by DME/ATD readout.
//        Figure examples: inbound toward the NAVAID, fix 10 DME, 5 NM legs
//        → outbound ends at 15 DME; inbound away, fix 28 DME, 8 NM legs
//        → outbound ends at 20 DME.
//
// Engine convention (geometry.ts): courses/directions are in [0, 360);
// north is 0, and the HSI maps 0 → "360" for display.

import { describe, expect, it } from 'vitest'
import {
  DME_SOURCE,
  TIMING_SOURCE,
  WIND_SOURCE,
  dmeOutboundEnd,
  groundSpeeds,
  inboundCrab,
  outboundHeading,
  outboundTimeSeconds,
} from './wind'

const TAS = 90 // C172 holding speed, KTAS

// Wind speed that produces exactly an 8° crab at 90 KTAS when abeam.
const KT_FOR_8_DEG = TAS * Math.sin((8 * Math.PI) / 180)

describe('inboundCrab', () => {
  it('zero wind → zero crab', () => {
    expect(inboundCrab(0, { directionFrom: 90, speedKt: 0 }, TAS)).toBe(0)
  })

  it('direct crosswind from the right → positive (right) crab', () => {
    const crab = inboundCrab(0, { directionFrom: 90, speedKt: KT_FOR_8_DEG }, TAS)
    expect(crab).toBeCloseTo(8, 5)
  })

  it('direct crosswind from the left → negative (left) crab', () => {
    const crab = inboundCrab(0, { directionFrom: 270, speedKt: KT_FOR_8_DEG }, TAS)
    expect(crab).toBeCloseTo(-8, 5)
  })

  it('wind aligned with the course (head- or tailwind) → zero crab', () => {
    expect(inboundCrab(45, { directionFrom: 45, speedKt: 20 }, TAS)).toBeCloseTo(0, 10)
    expect(inboundCrab(45, { directionFrom: 225, speedKt: 20 }, TAS)).toBeCloseTo(0, 10)
  })

  it('mirrored wind gives mirrored crab on any course', () => {
    for (const course of [0, 45, 137, 264, 359]) {
      const right = inboundCrab(course, { directionFrom: (course + 60) % 360, speedKt: 15 }, TAS)
      const left = inboundCrab(course, { directionFrom: (course + 300) % 360, speedKt: 15 }, TAS)
      expect(right).toBeGreaterThan(0)
      expect(left).toBeCloseTo(-right, 10)
    }
  })
})

describe('outboundHeading — triple drift (AIM 5-3-8 j8)', () => {
  it('AIM example: correcting left 8° inbound → correct right 24° outbound', () => {
    // Inbound course north, wind from the left (270) → 8° left crab inbound.
    const wind = { directionFrom: 270, speedKt: KT_FOR_8_DEG }
    expect(inboundCrab(0, wind, TAS)).toBeCloseTo(-8, 5)
    // Outbound course is 180; right 24° correction → heading 204.
    expect(outboundHeading(0, wind, TAS)).toBeCloseTo(204, 5)
  })

  it('mirror: correcting right 8° inbound → correct left 24° outbound', () => {
    const wind = { directionFrom: 90, speedKt: KT_FOR_8_DEG }
    expect(outboundHeading(0, wind, TAS)).toBeCloseTo(156, 5)
  })

  it('zero wind → outbound heading is the reciprocal of the inbound course', () => {
    for (const course of [0, 90, 231, 340]) {
      expect(outboundHeading(course, { directionFrom: 10, speedKt: 0 }, TAS)).toBeCloseTo(
        (course + 180) % 360,
        10,
      )
    }
  })

  it('result is normalized to [0, 360)', () => {
    // Inbound 200 → outbound 020; strong left-crab inbound pushes the
    // corrected heading below 0 before normalization.
    const h = outboundHeading(200, { directionFrom: 110, speedKt: 30 }, TAS)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(360)
  })
})

describe('outboundTimeSeconds — adjust toward target inbound (AIM 5-3-8 j4)', () => {
  it('zero wind → 60 s outbound for a 60 s inbound target', () => {
    expect(outboundTimeSeconds(0, { directionFrom: 45, speedKt: 0 }, TAS)).toBeCloseTo(60, 10)
  })

  it('direct crosswind → still 60 s (no along-course component)', () => {
    expect(outboundTimeSeconds(0, { directionFrom: 90, speedKt: 20 }, TAS)).toBeCloseTo(60, 10)
  })

  it('inbound headwind → shorten outbound, roughly 1 s/kt at 90 KTAS', () => {
    // 10 kt on the nose inbound: GS 80 in / 100 out → 60·80/100 = 48 s.
    const t = outboundTimeSeconds(0, { directionFrom: 0, speedKt: 10 }, TAS)
    expect(t).toBeCloseTo(48, 5)
    // The field "~1 s/kt" rule of thumb emerges from the math (1.2 s/kt here).
    expect((60 - t) / 10).toBeGreaterThan(1)
    expect((60 - t) / 10).toBeLessThan(1.5)
  })

  it('inbound tailwind → lengthen outbound', () => {
    // 10 kt tailwind inbound: GS 100 in / 80 out → 60·100/80 = 75 s.
    expect(outboundTimeSeconds(0, { directionFrom: 180, speedKt: 10 }, TAS)).toBeCloseTo(75, 5)
  })

  it('honors a 90 s inbound target (above 14,000 ft MSL legs)', () => {
    expect(outboundTimeSeconds(0, { directionFrom: 0, speedKt: 10 }, TAS, 90)).toBeCloseTo(72, 5)
  })
})

describe('dmeOutboundEnd — DME/ATD leg endpoints (AIM 5-3-8 j5)', () => {
  it('AIM example: inbound toward the NAVAID, fix 10 DME + 5 NM legs → 15 DME', () => {
    expect(dmeOutboundEnd(10, 5, 'toward')).toBe(15)
  })

  it('AIM example: inbound away from the NAVAID, fix 28 DME + 8 NM legs → 20 DME', () => {
    expect(dmeOutboundEnd(28, 8, 'away')).toBe(20)
  })

  it('rejects an away-side leg that would reach or cross the station', () => {
    expect(() => dmeOutboundEnd(5, 5, 'away')).toThrow(RangeError)
    expect(() => dmeOutboundEnd(5, 8, 'away')).toThrow(RangeError)
  })

  it('rejects non-positive or non-finite distances', () => {
    expect(() => dmeOutboundEnd(0, 5, 'toward')).toThrow(RangeError)
    expect(() => dmeOutboundEnd(10, 0, 'toward')).toThrow(RangeError)
    expect(() => dmeOutboundEnd(NaN, 5, 'toward')).toThrow(RangeError)
    expect(() => dmeOutboundEnd(10, Infinity, 'toward')).toThrow(RangeError)
  })
})

describe('input validation (shared by the wind-triangle functions)', () => {
  const wind = { directionFrom: 90, speedKt: 10 }

  it('wind at or above TAS rejected — the pattern cannot be flown', () => {
    expect(() => inboundCrab(0, { directionFrom: 90, speedKt: 90 }, TAS)).toThrow(RangeError)
    expect(() => outboundHeading(0, { directionFrom: 90, speedKt: 100 }, TAS)).toThrow(RangeError)
    expect(() => outboundTimeSeconds(0, { directionFrom: 90, speedKt: 95 }, TAS)).toThrow(
      RangeError,
    )
  })

  it('negative wind speed rejected', () => {
    expect(() => inboundCrab(0, { directionFrom: 90, speedKt: -5 }, TAS)).toThrow(RangeError)
  })

  it('courses outside [0, 360) rejected', () => {
    expect(() => inboundCrab(NaN, wind, TAS)).toThrow(RangeError)
    expect(() => inboundCrab(-10, wind, TAS)).toThrow(RangeError)
    expect(() => inboundCrab(360, wind, TAS)).toThrow(RangeError)
    expect(() => outboundHeading(400, wind, TAS)).toThrow(RangeError)
  })

  it('wind direction outside [0, 360) rejected', () => {
    expect(() => inboundCrab(0, { directionFrom: 360, speedKt: 10 }, TAS)).toThrow(RangeError)
    expect(() => inboundCrab(0, { directionFrom: NaN, speedKt: 10 }, TAS)).toThrow(RangeError)
  })

  it('non-positive TAS rejected', () => {
    expect(() => inboundCrab(0, wind, 0)).toThrow(RangeError)
    expect(() => outboundTimeSeconds(0, wind, -90)).toThrow(RangeError)
  })

  it('non-positive inbound target rejected', () => {
    expect(() => outboundTimeSeconds(0, wind, TAS, 0)).toThrow(RangeError)
  })
})

describe('FAA source citations', () => {
  it('every exported source cites AIM 5-3-8', () => {
    for (const source of [WIND_SOURCE, TIMING_SOURCE, DME_SOURCE]) {
      expect(source).toMatch(/AIM 5-3-8/)
    }
  })
})

describe('groundSpeeds', () => {
  it('zero wind → TAS on both legs', () => {
    const gs = groundSpeeds(0, { directionFrom: 0, speedKt: 0 }, TAS)
    expect(gs.inboundKt).toBeCloseTo(TAS, 6)
    expect(gs.outboundKt).toBeCloseTo(TAS, 6)
  })

  it('20 kt inbound headwind → 70 inbound, 110 outbound', () => {
    const gs = groundSpeeds(0, { directionFrom: 0, speedKt: 20 }, TAS)
    expect(gs.inboundKt).toBeCloseTo(70, 6)
    expect(gs.outboundKt).toBeCloseTo(110, 6)
  })

  it('direct crosswind → both legs at the crab-reduced along-course speed', () => {
    const gs = groundSpeeds(0, { directionFrom: 90, speedKt: 15 }, TAS)
    const along = Math.sqrt(TAS * TAS - 15 * 15)
    expect(gs.inboundKt).toBeCloseTo(along, 6)
    expect(gs.outboundKt).toBeCloseTo(along, 6)
  })

  it('is consistent with outboundTimeSeconds (t_out = 60·GSin/GSout)', () => {
    const wind = { directionFrom: 30, speedKt: 18 }
    const gs = groundSpeeds(0, wind, TAS)
    expect(outboundTimeSeconds(0, wind, TAS)).toBeCloseTo((60 * gs.inboundKt) / gs.outboundKt, 10)
  })

  it('rejects wind at or above TAS', () => {
    expect(() => groundSpeeds(0, { directionFrom: 0, speedKt: TAS }, TAS)).toThrow(RangeError)
  })
})
