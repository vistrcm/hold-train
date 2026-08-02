# Parallel entry rejoin turn — figure evidence

**Verdict: the parallel entry's rejoin turn rotates OPPOSITE the pattern's turn direction and
crosses back over the holding course onto the HOLDING side.**

Standard (right-turn) pattern → the rejoin is a **left** (counter-clockwise) turn.
Nonstandard (left-turn) pattern → the rejoin is a **right** turn.

This file exists because AIM 5-3-8 j3(a)'s sentence is genuinely ambiguous and this repo has already
reasoned itself into the wrong answer once from it (`docs/content-audit.md`, entry "the parallel
entry's reintercept turn was inverted app-wide", 2026-07-22). **Read this file instead of
re-deriving the answer from the AIM sentence.** If you are about to flip a turn direction, the
figures below — not the prose — are the authority.

Verified 2026-08-02 by fetching and rendering FAA primary sources and inspecting them visually.

---

## Why the sentence cannot settle it

AIM 5-3-8 j3(a), verbatim:

> "When approaching the holding fix from anywhere in sector (a), the parallel entry procedure would
> be to turn to a heading to parallel the holding course outbound on the nonholding side for one
> minute, **turn in the direction of the holding pattern through more than 180 degrees**, and return
> to the holding fix or intercept the holding course inbound."

"In the direction of the holding pattern" is **spatial** (toward the racetrack), not rotational. The
identical phrase in j3(b) (teardrop) does read as rotational — but in the teardrop geometry "toward
the racetrack" and "the pattern's rotational sense" are the *same turn*, so j3(b) discriminates
nothing.

**The ">180°" clause must never be used to re-derive this.** The argument that only a
pattern-direction turn exceeds 180° is arithmetically wrong: it measures the bearing to the fix at
the *start* of the turn and never updates it for the aircraft's motion *during* the turn. Computed
correctly across the parallel sector, right turn 212.6°–222.1° and left turn 189.3°–215.3° — **both
exceed 180°**, and they are exactly equal (215.3°) at zero offset by symmetry.

## Corroborating text (not the primary evidence, but unambiguous)

ICAO Doc 8168 Vol I, Part II, Section 6, Chapter 2 (Sixth Edition, 2018) says in words what the FAA
says only in a picture, and deliberately uses different wording for the two maneuvers:

- 2.2.4 Sector 1 (parallel): "the aircraft is **turned toward the holding side** to intercept the
  inbound track or to return directly to the fix"
- 2.2.5 Sector 2 (offset/teardrop): "the aircraft is **turned right** to intercept the inbound
  holding track"

Spatially explicit for parallel; rotationally explicit for teardrop.

---

## Source 1 — AIM FIG 5-3-4, "Holding Pattern Entry Procedures"

| Field | Value |
|---|---|
| URL | `https://faraim.org/faa/aim/chapter-5/section-5-3-8.pdf` |
| Fetched | 2026-08-02, HTTP 200 with a desktop-Chrome `User-Agent` |
| Size | 762,928 bytes, PDF 1.6, 12 pages |
| SHA-256 | `fca9e86f68c2f15bf6205e17d3d18585f80222abd9721b498568803ae747bde6` |
| Page | 5 (printed page 5-3-28), figure dated **1/22/26** |
| Renderer | Ghostscript 10.06.0; ImageMagick 7.1.2-18 for cropping |

`faa.gov` returns HTTP 403 to plain fetches. Use:

```sh
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" \
  -o aim-5-3-8.pdf https://faraim.org/faa/aim/chapter-5/section-5-3-8.pdf

# 400 dpi whole page (ImageMagick is fine at this density)
magick -density 400 'aim-5-3-8.pdf[4]' aim-fig534-p5-400.png       # 3400x4400

# 900 dpi needs Ghostscript — `magick -density 900` aborts (SIGABRT, out of memory) at 7650x9900
gs -q -dNOPAUSE -dBATCH -sDEVICE=png16m -r900 -dFirstPage=5 -dLastPage=5 \
   -sOutputFile=gs-p5-900.png aim-5-3-8.pdf                        # 7650x9900

# the decisive crops (coordinates in the 900 dpi render)
magick gs-p5-900.png -crop 500x320+4150+3790  +repage -resize 300% crossing.png
magick gs-p5-900.png -crop 340x300+3880+3580  +repage -resize 400% arrow-inner.png
magick gs-p5-900.png -crop 340x340+4430+3560  +repage -resize 400% arrow-outer.png
```

⚠️ Do **not** use the AIM HTML's inline figure
(`.../aim_html/images/aim0503_At_Anchor2.png`, alt "Holding Pattern Entry Procedures") as evidence.
It is **312×221 px** — at that size the dashed rejoin arc and the solid course line occupy the same
pixels, so which side of the line the arc lies on is not resolvable. Sanity check only.

### Orientation established before tracing

- Fix = the open triangle on the horizontal solid line (900 dpi ≈ `(3298, 3900)`; course line
  y ≈ 3897).
- The solid racetrack lies **above** the course line ⇒ **holding side = north (up)**.
- Turn sense: the fix-end turn bulges **west** of the fix and exits **eastbound** (arrowhead on the
  outbound leg points right) ⇒ inbound course is **westbound**, turns are **right** — consistent
  with the figure's "STANDARD PATTERN" caption.
- Outbound leg direction = **east**, along the top of the racetrack.

### What was seen

1. **Parallel outbound leg** — a straight dashed line leaving the fix **eastbound and below** the
   course line, i.e. on the **nonholding** side. Correct and unremarkable; recorded so a future
   change cannot break it while "fixing" the rejoin.
2. **The crossing** (`crossing.png`, 900 dpi crop `+4150+3790` at 300%) — the dashed leg curves up
   at its eastern end and **crosses the solid course line**, with dashes clearly on **both** sides of
   the line. Nothing else is drawn below the course line except this leg and the sector-(b) arrival
   line.
3. **Rejoin arc geometry** — after crossing, the arc's rightmost extent sits at 900 dpi x ≈ 4428;
   fitting the traced points gives a centre **above** the course line (holding side), radius
   ≈ 0.4 of the leg length. Heading progression around it: **east → north → west**, i.e.
   **counter-clockwise**.
4. **Rollout arrowhead** (`arrow-inner.png`, 900 dpi ≈ `(4044, 3719)` — **above** the course line)
   — a filled arrowhead whose sharp tip points **down-left**, tangent ≈ (−1, +0.61), i.e. heading
   west and descending toward the course line at ≈ 31° below horizontal. The aircraft is converging
   on the inbound course **from the holding side**, aimed back at the fix.
5. **The discriminator, in this same figure** (`arrow-outer.png`, 900 dpi ≈ `(4430, 3560)`) — the
   **teardrop's** rejoin arrowhead points **due south** at the outermost (easternmost) point of its
   turn. A clockwise turn's heading at that point is south; a counter-clockwise turn's would be
   north. So the **teardrop rejoin is clockwise (WITH the standard right pattern)** while the
   **parallel rejoin is counter-clockwise (AGAINST it)** — one figure, two rejoins, opposite senses,
   described by the same words in j3(a) and j3(b).

**Verdict (source 1): confirms the dossier. Rejoin crosses onto the holding side; rotational sense
opposes the pattern.**

## Source 2 — FAA AIP `FIG ENR 1.5-3`

| Field | Value |
|---|---|
| URL | `https://www.faa.gov/air_traffic/publications/atpubs/aip_html/images/AIP_ENR_1.5_fig107.png` |
| Fetched | 2026-08-02, HTTP 200 (browser `User-Agent` required) |
| Size | 90,214 bytes, PNG 3162×2238, 8-bit colormap |
| SHA-256 | `63ba6a72893c420f36b15e28c8b0b96a8f5d0fb83211a9e3791ca2c9137c8595` |

```sh
magick aip_enr_1.5_fig107.png -resize 1200x850 aip-overview.png
magick aip_enr_1.5_fig107.png -crop 420x330+1830+1080 +repage -resize 350% aip-crossing.png
```

### What was seen

Independently drawn rendition of the same standard pattern, same orientation (racetrack above the
course line, right turns, westbound inbound course). At 350% on the crop above:

- the dashed parallel leg runs **below** the course line, curves up, and **crosses** it — dashes
  unambiguously on both sides;
- the rejoin arc continues **above** the line and curls **left** (counter-clockwise), with its
  rollout arrowhead pointing down-left back toward the fix;
- the teardrop's arrowhead again points **down (south)** at the outer edge of its turn — clockwise;
- nothing is drawn below the course line except the straight parallel leg and the sector-(b)
  arrival line.

**Verdict (source 2): confirms source 1, from an independently drawn figure.**

## Sources deliberately not cited

- **IPH FAA-H-8083-16B** — contains **no** entry-path figure. It cannot discriminate; do not cite it
  either way.
- **IFH FAA-H-8083-15B Fig 10-6** — recorded in the plan's dossier as showing the same thing
  (teardrop clockwise, parallel counter-clockwise in one figure). **Not re-fetched in this pass**;
  the two sources above were sufficient and are what the render commands here reproduce. Treat the
  IFH line as second-hand until someone renders it.

---

## The rule to implement

Let `C` = inbound holding course, `O` = `C + 180°`.

| Pattern | Fix-crossing turn | Rejoin turn | Rejoin rollout heading | Turn at the fix |
|---|---|---|---|---|
| **Standard** (right turns) | **left** onto `O` | **left**, >180° (~225°) | `C − 45°` | right |
| **Nonstandard** (left turns) | **right** onto `O` | **right**, >180° (~225°) | `C + 45°` | left |

**Invariant:** the first two turns of a parallel entry oppose the pattern's turn direction; only the
final turn at the fix follows it. The rejoin arc's centre lies on the **holding** side.

The `~225°` sweep and the 45° intercept are **convention, not AIM text** — the AIM requires only
"more than 180 degrees". 45° is chosen because it matches how the FAA figures draw the rollout, and
is recorded once as `PARALLEL_INTERCEPT_DEG` in `src/engine/entry.ts` so the map and the sim cannot
drift from it.

## Correct but unrelated — do not sweep these into a change here

- The parallel **outbound** leg is on the **nonholding** side. That is the defining feature of the
  entry and is explicit in AIM 5-3-8 j3(a). Only the **rejoin** inverts.
- Sector classification (`determineEntry`, `sectorArcs`, the 70° line, the ±5° boundary alternates)
  is correct and unaffected.
- Direct and teardrop rejoins turn **with** the pattern. Only `parallel` opposes it.
- `towardHoldingSide` in `src/engine/entry.ts` (`±30`) is the **teardrop's** 30° offset per
  AIM 5-3-8 j3(b) — a different quantity from the parallel rejoin's 45° intercept angle. It stays 30.
