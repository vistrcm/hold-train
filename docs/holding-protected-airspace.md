# Holding-pattern protected airspace — verified against FAA Order 8260.3G

Verified 2026-08-03 against FAA Order 8260.3G (TERPS), effective 07/01/2024, chapter 16
("Holding Criteria"). Source PDF: <https://www.faa.gov/documentLibrary/media/Order/Order_8260.3G.pdf>.

This file exists because `docs/research-claude.md` once carried "holding side (~8 NM protected)
vs. non-holding side (~4 NM protected)", sourced to a CFII rather than an FAA publication. That
claim is wrong in structure, not just in numbers: there is no fixed pair — the protected area
scales with pattern number — and **both sides of the holding course are protected**.

## Which order is current

Checked against the FAA directives index (faa.gov orders/notices document records), 2026-08-03:

| Order | Status | Detail |
|---|---|---|
| 7130.3A "Holding Pattern Criteria" | **Cancelled** | issued 1998-03-18, cancelled 2016-03-14 by Order 8260.3C |
| 8260.3B (TERPS, w/ Changes 1–26) | **Cancelled** | issued 1976-07-07, cancelled 2016-03-14 by Order 8260.3C |
| 8260.3G (TERPS) | **Active** | effective 2024-07-01, office AFS-400 |

Holding criteria formerly in 7130.3A live on as 8260.3G chapter 16. Anything citing 7130.3A
Table 3 or 8260.3B is citing a cancelled document.

## What the dimensions describe

- **Primary area only.** "Dimensions for manual construction, and templates discussed in this
  document define only the primary area of the holding pattern" (8260.3G ¶16-2-1.a).
- **A secondary area surrounds it on all sides.** "A secondary area 2 NM wide surrounds the
  perimeter of the primary area in all cases. (Note: Secondary areas are used for obstacle
  clearance purposes only.)" (¶16-2-1.b). ATC depictions use only the primary area (¶16-1-8).
- **Sizes are numbered patterns.** Pattern number is selected by altitude, airspeed group and
  fix-to-NAVAID distance (¶16-3-3, Table 16-3-1). "There were originally 31 holding pattern
  sizes defined … Pattern sizes one to three are no longer in use." (¶16-3-1). Table 16-6-1
  accordingly runs pattern 4 through pattern 31 — 28 rows.

## Table 16-6-1 "Holding Pattern Dimensions (NM)" (8260.3G, page 16-18)

Column letters are construction points from Figure 16-6-1 ("Construction Sequence for Basic
Area", ¶16-6-2): the holding course line is drawn A–L–M–G with **L the holding fix**; at 90° to
the course line, B is offset above A, F above G, E above M, H below M, I below L (¶16-6-2.c).
So for the right-hand pattern as drawn: **M-E** is the perpendicular half-width on the side
where E lies, and **L-I = M-H** the half-width on the opposite side. Total Width = L-I + M-E;
Total Length = A-L + L-M + M-G. (Points J and K appear only in the table's "(J-L)"/"(J-K)"
column heading and are not defined in the chapter's body text — figure-only labels, not needed
here; that column is reproduced but otherwise unverified.)

| Pattern | A-L | L-M | M-G | L-I / M-H | M-E | A-B / G-F / (J-K) | (J-L) | Total Length | Total Width |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 4.5 | 4.3 | 5.6 | 3.5 | 5.3 | 1.5 | 3.3 | 14.4 | 8.8 |
| 5 | 4.9 | 4.5 | 6.1 | 3.8 | 5.7 | 1.7 | 3.6 | 15.5 | 9.5 |
| 6 | 5.6 | 4.8 | 6.5 | 4.2 | 6.4 | 2.0 | 4.1 | 16.9 | 10.6 |
| 7 | 6.0 | 6.6 | 8.2 | 4.6 | 7.2 | 2.2 | 4.4 | 20.8 | 11.8 |
| 8 | 6.5 | 6.8 | 9.3 | 4.9 | 7.7 | 2.3 | 4.7 | 22.6 | 12.6 |
| 9 | 7.0 | 7.0 | 9.7 | 5.3 | 8.3 | 2.5 | 5.1 | 23.7 | 13.6 |
| 10 | 7.6 | 7.3 | 10.4 | 5.7 | 8.9 | 2.7 | 5.5 | 25.3 | 14.6 |
| 11 | 8.0 | 7.5 | 11.1 | 6.2 | 9.6 | 2.9 | 5.9 | 26.6 | 15.8 |
| 12 | 8.7 | 7.8 | 11.7 | 6.5 | 10.2 | 3.1 | 6.3 | 28.2 | 16.7 |
| 13 | 9.2 | 8.6 | 12.1 | 7.0 | 10.9 | 3.3 | 6.7 | 29.9 | 17.9 |
| 14 | 9.9 | 8.9 | 12.8 | 7.5 | 11.6 | 3.6 | 7.1 | 31.6 | 19.1 |
| 15 | 10.4 | 9.6 | 13.1 | 7.7 | 12.1 | 3.8 | 7.5 | 33.1 | 19.8 |
| 16 | 11.1 | 9.9 | 13.7 | 8.2 | 12.8 | 4.0 | 7.8 | 34.7 | 21.1 |
| 17 | 11.9 | 10.1 | 14.8 | 8.6 | 13.6 | 4.3 | 8.3 | 36.8 | 22.2 |
| 18 | 12.7 | 10.5 | 15.7 | 9.2 | 14.6 | 4.5 | 8.9 | 38.9 | 23.8 |
| 19 | 13.8 | 11.1 | 16.8 | 9.9 | 15.7 | 4.8 | 9.5 | 41.7 | 25.6 |
| 20 | 14.5 | 11.5 | 18.0 | 10.5 | 16.5 | 5.2 | 10.1 | 44.0 | 27.0 |
| 21 | 15.5 | 11.8 | 18.8 | 11.2 | 17.6 | 5.5 | 10.7 | 46.1 | 28.8 |
| 22 | 16.5 | 12.1 | 21.2 | 11.9 | 18.8 | 5.9 | 11.4 | 49.8 | 30.7 |
| 23 | 17.6 | 12.4 | 21.6 | 12.7 | 20.1 | 6.3 | 12.2 | 51.6 | 32.8 |
| 24 | 19.2 | 12.9 | 23.4 | 13.7 | 21.7 | 6.9 | 13.1 | 55.5 | 35.4 |
| 25 | 21.2 | 13.3 | 25.5 | 14.7 | 23.4 | 7.4 | 14.2 | 60.0 | 38.1 |
| 26 | 22.9 | 13.8 | 27.6 | 16.1 | 25.7 | 8.1 | 15.4 | 64.3 | 41.8 |
| 27 | 24.6 | 14.4 | 29.5 | 17.3 | 27.3 | 8.8 | 16.5 | 68.5 | 44.6 |
| 28 | 26.9 | 15.2 | 32.6 | 18.9 | 30.2 | 9.6 | 18.2 | 74.7 | 49.1 |
| 29 | 28.0 | 15.8 | 34.6 | 20.1 | 32.0 | 10.0 | 19.3 | 78.4 | 52.1 |
| 30 | 29.2 | 16.4 | 35.3 | 21.3 | 33.2 | 10.4 | 20.2 | 80.9 | 54.5 |
| 31 | 30.9 | 17.0 | 37.0 | 22.5 | 34.5 | 11.0 | 21.9 | 84.9 | 57.0 |

### How this was verified

- The order's PDF has a text layer; the table was extracted with Ghostscript (`txtwrite`).
- The table page (printed page 16-18) and the Figure 16-6-1 page (16-16) were additionally
  **rendered to images and read visually**. Four rows were compared digit-by-digit against the
  rendered page: patterns **4, 8, 16 and 31** — all ten columns match the extraction exactly.
- Structural identities, checked over all 28 rows:
  - A-L + L-M + M-G = Total Length: exact in 28/28 rows.
  - L-I + M-E = Total Width: exact in 27/28 rows. **Pattern 16 is off by 0.1** (8.2 + 12.8 =
    21.0 vs printed 21.1) — the printed page genuinely reads 21.1 (visually confirmed), so this
    is an independent-rounding artifact in the published table (each column rounded to 0.1 NM
    separately), not an extraction error. Recorded as-published.

## Which side is which — DERIVED, not stated by the order

The order never labels the columns "holding side" / "non-holding side"; the mapping below is an
inference. Reasoning, from ¶16-6-2 (written for the right-hand pattern; "for left-hand pattern
reverse the instructions"):

1. L is the holding fix (¶16-6-2.a); the course line A-L-M-G is the holding course, and the
   area extends from the fix mostly toward M and G (L-M + M-G ≈ twice A-L in every row) — the
   racetrack lies on the M–G side of the fix, and A-L is the buffer behind it.
2. The inbound leg is flown along the holding course **toward** the fix, so the inbound heading
   points from M toward L.
3. A right-hand pattern turns clockwise (viewed from above). From a heading pointing M→L, a
   clockwise turn rotates toward the side of the course line where E lies (in Figure 16-6-1's
   orientation: inbound heading points left; clockwise from that heading initially points up,
   the E side).
4. Therefore the racetrack loop lies on the E side: **M-E is the holding-side half-width
   (the larger), and M-H = L-I is the non-holding-side half-width (the smaller)** — consistent
   with the maneuvering happening on the holding side needing more room.

Corroboration: 8260.3G itself uses "holding side" in prose to mean the side associated with the
pattern's turn direction — "The missed approach turn direction must be to the holding side of
the holding pattern" (¶2-8-9) — though never as a label on these columns.

## What this means for the app's content

- **Both sides of the holding course are protected.** The primary area spans both sides of the
  course (Figure 16-3-1, ¶16-3-2), and a 2 NM secondary area surrounds the whole perimeter
  (¶16-2-1.b). The non-holding side is the **narrower** protected side, not an unprotected one.
- **There is no fixed "8 NM vs 4 NM".** Across the current patterns the non-holding half-width
  runs 3.5–22.5 NM and the holding half-width 5.3–34.5 NM, scaling with pattern number
  (altitude / airspeed / fix distance, Table 16-3-1). No row matches a fixed 8/4 pair.
- The non-holding half-width is consistently **38.5–40.0% of total width** (rounded to 0.1%)
  across all 28 current patterns (computed from the table above; derived, not stated in the
  order). Exact span: 38.49% (pattern 28, 18.9 / 49.1) to 40.00% (pattern 5, 3.8 / 9.5) —
  pattern 28 is the one row strictly below 38.5% before rounding, so re-deriving the fractions
  from the table lands just outside the rounded range; that is this rounding, not a
  transcription error.

## Reconciliation with the earlier unverified numbers

An earlier investigation (recorded in the plan for this work) reported: template 1 =
2.6 / 4.1 (total 6.7); template 8 = 4.9 / 7.7 (12.6); template 31 = 22.5 / 34.5 (57.0);
non-holding side 38.5–40% of total width "across all 31 templates".

- Patterns 8 and 31: **confirmed** against Table 16-6-1.
- "Template 1": **not in the current order.** Table 16-6-1 has no rows for patterns 1–3
  (¶16-3-1: "Pattern sizes one to three are no longer in use"). The 2.6/4.1/6.7 figures
  presumably come from cancelled 7130.3A Table 3 and are **unverified** — treat them as
  historical, never cite them as current.
- The 38.5–40% span: confirmed as a 0.1%-rounded span (exact minimum 38.49%, pattern 28), and
  over the 28 current patterns, not 31 templates.

## Method notes (for the next verification)

- faa.gov returns HTTP 403 to plain fetches; use `curl` with a browser User-Agent.
- `Order_8260.3G.pdf` (≈20 MB, 564 pages) has a text layer — `gs -sDEVICE=txtwrite` suffices;
  no OCR needed. Chapter 16's table and figures are near PDF pages 396–410
  (`gs -sDEVICE=png16m -r150 -dFirstPage=… -dLastPage=…` to render for visual checks).
- Cancellation records: faa.gov directives index, document-information pages (7130.3A is
  documentID 10408; 8260.3B is documentID 11698; 8260.3G is documentID 1042947).
