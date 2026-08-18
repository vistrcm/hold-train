# Bay Area / Central Valley hold dossier

**This file is a research artifact, not current chart data, and nothing in the app may
present it as such.** It records where each real fix name and each hold geometry came
from, on the date it was looked up, so a later reader can tell a researched number from a
plausible one without redoing the work. It is the `docs/parallel-entry-evidence.md`
tradition: read this instead of re-deriving.

Researched **2026-08-17** against CIFP cycle **2608** (effective 6 Aug 2026, superseded
3 Sep 2026). It goes stale on 3 Sep 2026 and **that is accepted** — see "Why staleness is
not a defect here".

## What this is for

`PUBLISHED_HOLDS`, `VOR_NAMES` and `NDB_NAMES` in `src/engine/clearance.ts` feed the entry
drill and clearance-copy screens. When this was researched every 5-letter fixture was
invented. This dossier supplied the **real Bay Area names** that shipped on 2026-08-17, so
entry practice rehearses the airspace the student actually flies, per
`docs/plans/completed/20260817-real-bay-area-hold-fixtures.md`.

> **Implemented 2026-08-17.** 14 of the 18 researched holds shipped into `RESEARCHED_HOLDS`;
> `WHYEE`, `IPDEW` and `ORANG` are held back as `CIFP-only` and `ALTAM` for duplicating
> ZELAT's shape. 11 VOR names were added, `NDB_NAMES` kept invented, Manteca retained
> knowingly. The ⚠️ sections below are preserved as the reasoning of the day, not as open
> questions — each records its outcome inline.

> **This file's format is load-bearing.** `src/engine/clearance.test.ts` imports it with
> `?raw` and parses two of its tables: hold rows (exactly 10 pipe-cells, keyed off the
> confidence column, course `\d{1,3}°`, leg `\d+ NM|min`) and the navaid table (exactly 8
> cells, first cell a 3-letter ident, status matched on the literal phrases `in CIFP 2608`
> and `DECOMMISSIONED`). Adding a column, reflowing a table or rewording a status cell will
> red `npm test`, and a hold-shaped row that will not parse **throws** rather than being
> skipped. Edit the prose freely; change the table shapes deliberately.

**The name is the deliverable; the geometry is best-effort.** The app renders no plates and
names no procedures — it teaches entry geometry, and a stale hold still trains the correct
entry. The one hard requirement is the `CHART_HOLDS` collision rule below.

## Why staleness is not a defect here

A hold's *entry sector* is a function of the aircraft heading and the hold's own course and
turn direction. It does not depend on the hold being current. A student who flies a
teardrop into a hold that was amended last cycle still flew the correct teardrop for the
geometry in front of them. What *would* be negative training is the app contradicting
itself — teaching one geometry for `OYOSO` on the written-test screen and a different one
on the entry drill — which is exactly what the collision rule prevents.

## Method, and how it was validated

1. **FAA CIFP** (Coded Instrument Flight Procedures), ARINC 424-18, cycle 2608, downloaded
   from `https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_260806.zip` (file `FAACIFP18`).
   Airport-procedure leg records (`SUSAP…`) whose path-and-termination is `HF`, `HM` or
   `HA` are holds; the record carries fix, turn direction, magnetic course and leg
   distance/time as **data**, not as a picture that has to be read off a chart.
2. **FAA d-TPP plates** for the same cycle (`https://aeronav.faa.gov/d-tpp/2608/<file>.PDF`)
   as an independent cross-check on the CIFP decode.

Field offsets used on the `SUSAP` leg record (0-based Python slices), which is the part
worth keeping:

| field | slice | notes |
|---|---|---|
| airport | `[6:10]` | e.g. `KTCY` |
| procedure | `[13:19]` | e.g. `R12   ` = RNAV (GPS) RWY 12 |
| transition | `[20:25]` | blank on a missed-approach leg |
| fix | `[29:34]` | |
| turn direction | `[43]` | `L` / `R` |
| path & termination | `[47:49]` | `HF` = HILPT, `HM` = missed-approach hold |
| magnetic course | `[70:74]` | tenths — `1164` = 116.4° |
| leg | `[74:78]` | `0040` = 4.0 NM; a leading `T` means time, `T010` = 1.0 min |

**The decode was validated before any new number was trusted.** This repo already carries
four chart-verified holds in `CHART_HOLDS` (`src/content/questions.ts`), keyed from the
2607 charts by an earlier session. Parsing 2608 reproduces **all four exactly**:

| fix | repo `CHART_HOLDS` | CIFP 2608 decode |
|---|---|---|
| `OYOSO` | 116°, left, 4 NM | 116.4°, `L`, 4.0 NM ✓ |
| `HAIRE` | 231°, right, 4 NM | 231.2°, `R`, 4.0 NM ✓ |
| `UHHUT` | 255°, right, 4 NM | 254.8°, `R`, 4.0 NM ✓ |
| `ALTAM` | 240°, left, 1 min | 240.0°, `L`, 1.0 min ✓ |

A decode that agreed with three of four would be a decode to distrust. It also independently
re-confirms `CHART_HOLDS` itself against a newer cycle.

**Rounding.** CIFP carries tenths; charts depict whole degrees. Round to nearest — which is
what reproduces all four rows above. **One exception was found and it matters:** `HAXEK`
is `113.5` in CIFP, and round-half-up would give 114°, but the KSCK plates depict **113°**.
Where the two disagree, **the chart wins**, because the chart is what a student reads. This
is the only such case in the table below, and it is the reason each headline entry carries a
plate cross-check rather than a bare CIFP citation.

## Confidence legend

- **researched** — CIFP 2608 record **and** corroborated on the cycle-2608 plate (the
  depicted course, leg length, or the missed-approach sentence naming the turn).
- **CIFP-only** — CIFP 2608 record, plate cross-check not obtained. Trustworthy data; one
  fewer independent witness.
- **approximate** — a real name with geometry rounded, inferred or otherwise not pinned.
- **invented** — name and geometry both made up. (Nothing in this file is invented; the
  four surviving `PUBLISHED_HOLDS` fixtures are, and they stay.)

## Holds

Inbound course is the holding course **to** the fix, degrees magnetic, as depicted. "Alt" is
the charted holding altitude, recorded for provenance only — the app does not use it.

### KTCY — Tracy Municipal (AL-5815)

| fix | role | inbound | turns | leg | alt | confidence | provenance |
|---|---|---:|:-:|---|---|---|---|
| `OYOSO` | HILPT, RNAV (GPS) RWY 12 | 116° | left | 4 NM | 3100 | researched | CIFP 2608 `116.4/L/0040`; plate `05815R12` depicts `116°`, `4 NM`, Amdt 2C 11JUN26 |
| `HAIRE` | missed, RNAV 12 and RNAV 30 | 231° | right | 4 NM | 3200 | researched | CIFP 2608 `231.2/R/0040`; plate `05815R12` missed-approach text "direct HAIRE and hold, continue climb-in-hold to 3200" |
| `OMWAP` | HILPT + missed, RNAV (GPS) RWY 26 | 255° | right | 4 NM | 3000 | researched | CIFP 2608 `254.8/R/0040`; plate `05815R26` depicts `075°/255°` and says **"right turn** to 3000 direct OMWAP and hold" |
| `NAPYI` | HILPT, RNAV (GPS) RWY 30 | 297° | right | 4 NM | 3400 | researched | CIFP 2608 `296.7/R/0040`; plate `05815R30` depicts `297°/117°`, "Holding Pattern" |
| `LIN` | alternate missed, VOR RWY 26 | 285° | left | 1 min | 3000 | CIFP-only | CIFP 2608 `284.5/L/T010` — a hold **at Linden VOR**, so it belongs to the navaid discussion, not to `PUBLISHED_HOLDS` |

`OMWAP` is the most valuable single find here: the plate states the hold's turn direction
**in words**, so it needs no reading of a drawn racetrack.

### KLVK — Livermore Municipal (AL-6075)

| fix | role | inbound | turns | leg | alt | confidence | provenance |
|---|---|---:|:-:|---|---|---|---|
| `UHHUT` | HILPT, RNAV (GPS) RWY 25R | 255° | right | 4 NM | 3700 | researched | CIFP 2608 `254.8/R/0040`; already chart-verified in `CHART_HOLDS` |
| `ALTAM` | missed, ILS/LOC RWY 25R | 240° | left | 1 min | 5000 | researched | CIFP 2608 `240.0/L/T010`; already chart-verified in `CHART_HOLDS`. Also charted as an IAF on KSCK RNAV 11L |
| `WHYEE` | missed, RNAV (GPS) RWY 25R | 202° | right | 4 NM | 4000 | CIFP-only | CIFP 2608 `202.0/R/0040`. Plate `06075R25R` shows the `317°` track to WHYEE but the hold's own course was not legible in the extracted text — **do not headline this one** |

### KSQL — San Carlos (AL-9219)

| fix | role | inbound | turns | leg | alt | confidence | provenance |
|---|---|---:|:-:|---|---|---|---|
| `AMEBY` | missed, RNAV (GPS) Y and Z RWY 30 | 297° | left | 5 NM | 5400 | researched | CIFP 2608 `297.4/L/0050`; plate `09219RY30` depicts `297°` and says "MISSED APPROACH: **Climbing left**" |

KSQL has only these two IAPs, so `AMEBY` is the whole field's hold inventory.

### KOAK — Oakland International (AL-294)

| fix | role | inbound | turns | leg | alt | confidence | provenance |
|---|---|---:|:-:|---|---|---|---|
| `REBAS` | missed, RNAV Y/Z RWY 28R | 344° | right | 4 NM | 3000 | researched | CIFP 2608 `343.6/R/0040`; plate `00294RY28R` depicts `344°/164°`, `4 NM`, "track 335° to REBAS and hold" |
| `DECOT` | missed, RNAV Y/Z RWY 12 | 296° | left | 5 NM | 5400 | researched | CIFP 2608 `295.7/L/0050`; plate `00294RY12` "DECOT and hold, continue climb-in-hold to 5400" |
| `HAYZE` | missed, RNAV RWY 10L and 10R | 275° | right | 5 NM | 5200 | researched | CIFP 2608 `275.0/R/0050`; plate `00294R10L` depicts `5 NM` and "Climbing left turn to 5200 direct HAYZE" (that left turn is the turn **to** the fix, not the hold) |
| `SAU` | missed, RNAV Y RWY 28L and RWY 30 | 217° | right | 4 NM | 4000 | researched | CIFP 2608 `217.2/R/0040`; plate `00294RY30` depicts `SAU SAUSALITO 217°/037° 4 NM` and "on track 282° to SAU VOR/DME and hold". A hold **at a VOR** |

The ILS variants hold at the same three fixes on 1-minute legs instead of DME legs
(`DECOT` 294°/L/1 min, `REBAS` 345°/R/1 min, `SAU` 215°/R/1 min). Recorded for completeness;
the RNAV values above are the ones to use, since carrying two geometries for one fix name is
the very confusion this dossier exists to prevent.

### KHWD — Hayward Executive (AL-5015)

| fix | role | inbound | turns | leg | alt | confidence | provenance |
|---|---|---:|:-:|---|---|---|---|
| `JOBUS` | HILPT, RNAV (GPS) RWY 28L | 285° | right | 5 NM | 5700 | researched | CIFP 2608 `285.1/R/0050`; plate `05015R28L` depicts `105°/285°`, `5 NM` |
| `OAK` | missed, RNAV (GPS) RWY 28L | 122° | right | 4 NM | 2100 | CIFP-only | CIFP 2608 `122.0/R/0040` — a hold **at Oakland VOR** |
| `OAK` | missed, LOC RWY 28L | 120° | right | 1 min | 2100 | CIFP-only | CIFP 2608 `120.0/R/T010` — same fix, different geometry per procedure |

### KSCK — Stockton Metropolitan (AL-407)

| fix | role | inbound | turns | leg | alt | confidence | provenance |
|---|---|---:|:-:|---|---|---|---|
| `OXJEF` | HILPT RNAV 29R + missed RNAV 11L | 294° | right | 4 NM | 2000 | researched | CIFP 2608 `293.7/R/0040`; plates `00407R29R`/`00407R11L` depict `294°/114°`, "direct OXJEF and hold" |
| `HAXEK` | missed RNAV 29R + HILPT RNAV 11L | **113°** | right | 4 NM | 2700 | researched | CIFP 2608 `113.5/R/0040`; plates depict **`113°/293°`**, `4 NM`, "direct HAXEK and hold". ⚠️ **CIFP-vs-chart rounding conflict** — use 113°, the depicted value |
| `IPDEW` | HILPT, ILS/LOC RWY 29R (LIN transition) | 294° | right | 1 min | 1800 | CIFP-only | CIFP 2608 `293.6/R/T010` |
| `ORANG` | missed, ILS/LOC RWY 29R | 129° | left | 1 min | 2000 | CIFP-only | CIFP 2608 `128.8/L/T010` |

### KMOD — Modesto City-County / Harry Sham Field (AL-643)

| fix | role | inbound | turns | leg | alt | confidence | provenance |
|---|---|---:|:-:|---|---|---|---|
| `ZELAT` | HILPT, ILS/LOC RWY 28R | 288° | left | 1 min | 1800 | researched | CIFP 2608 `288.1/L/T010`; plate `00643IL28R` depicts `288°/108°` and `1min`, Amdt 16 19MAR26 |
| `SHELI` | missed, RNAV (GPS) RWY 28R | 148° | right | 4 NM | 3000 | researched | CIFP 2608 `148.2/R/0040`; plate `00643R28R` depicts `148°/328°`, `4 NM`, "direct SHELI and hold" |
| `MOD` | missed, ILS/LOC RWY 28R | 285° | left | 1 min | 2000 | CIFP-only | CIFP 2608 `284.6/L/T010` — a hold **at Modesto VOR** |

## Navaids

Status is **presence in CIFP 2608**: the FAA does not publish procedures against a
decommissioned station, so absence is strong evidence, and for the one absent station that
matters it is corroborated below. Type decoded from the CIFP class field (`V`+`D`=VOR/DME,
`V`+`T`=VORTAC; third char H/L/T is the service volume) and cross-checked against the type
column on the AirNav airport pages for OSI, SAU, SGD, SAC, MOD and LIN — six agreements, so
the decode is not a guess.

| ident | name | type | freq | class | status |
|---|---|---|---|---|---|
| `OSI` | Woodside | VOR/DME | 113.90 | L | in CIFP 2608 |
| `SAU` | Sausalito | VOR/DME | 116.20 | L | in CIFP 2608 |
| `PYE` | Point Reyes | VOR/DME | 113.70 | H | in CIFP 2608 |
| `SNS` | Salinas | VORTAC | 117.30 | H | in CIFP 2608 |
| `OAK` | Oakland | VOR/DME | 116.80 | H | in CIFP 2608 |
| `AVE` | Avenal | VOR/DME | 117.10 | H | in CIFP 2608 |
| `SGD` | Scaggs Island | VORTAC | 112.10 | L | in CIFP 2608 |
| `SFO` | San Francisco | VOR/DME | 115.80 | L | in CIFP 2608 |
| `SJC` | San Jose | VOR/DME | 114.10 | L | in CIFP 2608 |
| `CCR` | Concord | VOR/DME | 117.00 | T | in CIFP 2608 |
| `HYP` | El Nido | VOR/DME | 113.85 | L | in CIFP 2608 |
| `LIN` | Linden | VOR/DME | 114.80 | H | in CIFP 2608 — **already shipped** |
| `SAC` | Sacramento | VORTAC | 115.20 | H | in CIFP 2608 — **already shipped** |
| `MOD` | Modesto | VOR/DME | 114.60 | H | in CIFP 2608 — **already shipped** |
| `PXN` | Panoche | VORTAC | 112.60 | L | in CIFP 2608 — **already shipped** |
| `ECA` | Manteca | VORTAC | — | — | ⚠️ **DECOMMISSIONED** — **already shipped** |
| `SCK` | "Stockton" | — | — | — | ⚠️ **no such VOR** |

### ⚠️ Manteca (ECA) is decommissioned and the app ships it today

`VOR_NAMES` in `src/engine/clearance.ts` read
`['Manteca', 'Linden', 'Sacramento', 'Modesto', 'Panoche']` when this was written (it now
carries sixteen). **Manteca is the one name in that list that no longer exists.** ECA has no record of any kind in CIFP 2608, and it was
decommissioned **2018-03-29** under the VOR MON program (secondary source; the primary
finding here is the CIFP absence, and an FAA 8260-2 form dated 2017-06-22 carries the note
"ECA VOR BEING DECOMMISSIONED", consistent with a 2018 shutdown).

This is a **pre-existing** condition, not something this plan introduces, and it is not
urgent: an ATC-assigned hold at a station that closed in 2018 still teaches the right entry.
But it should be a deliberate choice rather than an accident. Recommendation: keep or drop
it on training-value grounds (the plan's "Judgment calls left to the pilot" covers exactly
this), and if kept, say in the comment that it is retained knowingly.

**Resolved 2026-08-17: kept.** The comment is written in `clearance.ts`, and the exemption is
guarded in both directions — `RETAINED_DECOMMISSIONED = ['Manteca']` in `clearance.test.ts`
requires this row to still say `DECOMMISSIONED` *and* requires the pool to still draw the
name, so the list cannot decay into an excuse for stations nobody speaks.

### ⚠️ There is no Stockton VOR

The plan's candidate list names "Stockton (SCK)". No VHF navaid `SCK` exists in CIFP 2608;
the only record carrying the name is `ISCK`, the **ILS localizer** at KSCK. The station that
served Stockton was Manteca (ECA), above. AirNav's KSCK page corroborates: its nearby-navaid
list is LIN, MOD, SAC, CCR — no SCK. **Do not add "Stockton" to `VOR_NAMES`.**

### NDBs: there are none left here

No NDB appears in CIFP 2608 anywhere in the box 36.3°–39.2°N, 119.8°–123.5°W — the Bay Area
and the Central Valley. Widening the box to 34°–42°N, 118°–125°W returns exactly three
(`COR` Salyer Farms, `HGT` Hunter Liggett, `MOG` Montague), which is how the query was
proved non-vacuous — a zero result from a filter that can only ever return zero is not a
finding.

Consequence for Task 5 (**resolved 2026-08-17: kept invented**, and guarded from the other
side — `invents its NDB names rather than reusing a real station`): **there is no real Bay
Area NDB name to adopt.** The realistic
options are to keep the invented `NDB_NAMES` (`Amber`, `Delta`, `Cooper`) or to use
historical ones. Keeping them is recommended — the drill still needs an NDB scenario to
exercise the bearing-vs-radial distinction, and inventing a name for a station class that no
longer exists locally claims nothing about a real place.

## Name collisions — checked, not eyeballed

Computed by parsing the three live source files rather than by reading them, over the
18 candidate fix names in this dossier:

| against | result |
|---|---|
| `CHART_HOLDS` (`src/content/questions.ts`) | **`ALTAM`, `HAIRE`, `OYOSO`, `UHHUT`** |
| wind-lab `FIXES` (`src/modules/wind-lab.ts`) | none |
| existing `PUBLISHED_HOLDS` (`src/engine/clearance.ts`) | none |

The four `CHART_HOLDS` collisions are **permitted and constrained**: under the plan's new
invariant, a fixture sharing a name with a charted hold must share its geometry on all four
of `inboundCourse`, `turnDirection`, `leg.unit` and `leg.value`. Every geometry recorded
here for those four **already matches** the repo's values exactly (see the validation table
above), which is not luck — both sides derive from the same FAA source, one cycle apart.

`OYOSO` is the natural fixture to add for making Task 2's guard load-bearing: it is at KTCY,
the student's home field, and it is the exact case that motivated the invariant.

wind-lab's `FIXES` are untouched and stay invented. Its guards must keep passing against
these now-real clearance lists — nothing here shares a name with them.

## Recommendations for Tasks 4 and 5

**Shipped 2026-08-17 as written** (minus the four held back, noted below). Retained as the
record of what was proposed and why; the live geometry is the 8-column table above, which is
the copy `clearance.test.ts` checks the code against.

Not binding on the implementer; this is what the research supports.

**`PUBLISHED_HOLDS` — append these 14, keeping all four invented fixtures.** They are the
`researched`-confidence 5-letter fixes, and they span both turn directions, both leg units
and a good spread of courses, which is what the drill needs for seed variety:

| fix | course | turns | leg | | fix | course | turns | leg |
|---|---:|:-:|---|---|---|---:|:-:|---|
| `OYOSO` | 116° | left | 4 NM | | `REBAS` | 344° | right | 4 NM |
| `HAIRE` | 231° | right | 4 NM | | `DECOT` | 296° | left | 5 NM |
| `OMWAP` | 255° | right | 4 NM | | `HAYZE` | 275° | right | 5 NM |
| `NAPYI` | 297° | right | 4 NM | | `JOBUS` | 285° | right | 5 NM |
| `UHHUT` | 255° | right | 4 NM | | `OXJEF` | 294° | right | 4 NM |
| `AMEBY` | 297° | left | 5 NM | | `ZELAT` | 288° | left | 1 min |
| `SHELI` | 148° | right | 4 NM | | `HAXEK` | 113° | right | 4 NM |

(That is 14 rows; `WHYEE`, `IPDEW` and `ORANG` are held back as CIFP-only, and `ALTAM` is
held back because its 1-minute geometry duplicates `ZELAT`'s shape while colliding with
`CHART_HOLDS` — adding it buys a constraint without buying variety. Trim to taste; the
`PUBLISHED_HOLDS` pool only needs enough members that seeds do not repeat obviously.)

Note the course clustering in the 270°–300° band — Bay Area finals point west into the
prevailing wind, so their missed-approach holds point back east. `SHELI` (148°) and
`HAXEK` (113°) are the useful outliers; keep them.

**`VOR_NAMES` — add** `Woodside`, `Sausalito`, `Point Reyes`, `Salinas`, `Oakland`,
`Avenal`, `Scaggs Island`. All seven are current. `Concord`, `San Jose`, `San Francisco` and
`El Nido` are equally current and available if a bigger pool is wanted. Decide `Manteca`
deliberately (above). Multi-word names (`Point Reyes`, `Scaggs Island`) are worth reading
aloud once in the generated clearance text before committing — the plan's manual-verification
section already calls for this.

**`NDB_NAMES` — keep the invented names** and record why in the comment: no NDB remains in
the region.

## Reproducing this

```
curl -sO https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_260806.zip   # cycle in filename
unzip -p CIFP_260806.zip FAACIFP18 > FAACIFP18
# holds at one airport, using the slices in the Method table
awk 'substr($0,1,5)=="SUSAP" && substr($0,7,4)=="KTCY" && substr($0,48,2) ~ /H[AFM]/' FAACIFP18
```

Plates for the same cycle are at `https://aeronav.faa.gov/d-tpp/2608/<file>.PDF`; the file
names come from the airport page at `https://opennav.com/airport/<ICAO>`. Their text is
extractable (FlateDecode streams, `Tj`/`TJ` operators) but is emitted in drawing order, not
reading order, so search the joined string for a fix name and read the neighbourhood —
that is how every "plate depicts" citation above was obtained.
