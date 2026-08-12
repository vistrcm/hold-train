# hold-train

Browser-based holding-pattern trainer for the FAA instrument rating (C172 around KTCY). Static single-page app: vanilla TypeScript + SVG, no backend, no runtime dependencies. Progress lives in your browser's localStorage.

## What it trains

- **Lessons** — 5 short read-once pages in study order (why holds exist → pattern anatomy → entries and the thumb method → timing and wind → holding reports), each paragraph carrying its own FAA citation and each lesson ending in a link to the drill that practices it.
- **Entry determination** — direct / teardrop / parallel from a realistic clearance and your current heading on an HSI, per AIM 5-3-8 j3, including the ±5° boundary tolerance (near-boundary headings accept either adjacent entry). Feedback draws the entry as a north-up plan view — the teardrop's 30° offset leg and the parallel's reintercept are shapes on the ground that an HSI cannot show. The parallel reintercept turns *against* the pattern — back across the holding course onto the holding side, through more than 180° — which is the entry learners most often fly mirrored; the figure evidence for that *direction* is in `docs/parallel-entry-evidence.md`. Only the direction is evidence-backed: AIM 5-3-8 j3(a) specifies only ">180°", and the app rolls out 45° off the inbound course (a 225° sweep) as a drawing convention chosen for legibility, not as a measurement of the FAA figures. Feedback also quotes AIM 5-3-8 j4(b) verbatim on when outbound timing starts (over or abeam the fix, whichever is later) and flags the familiar per-entry split — time from the fix on a parallel or teardrop, from abeam on a direct — as a derivation from that sentence rather than AIM text. The HSI is a G1000-style PFD panel and the scenario puts you several miles out, tracking direct to the fix, because a holding clearance arrives before the clearance limit (FAA JO 7110.65BB 4-6-1 c.4) rather than overhead it — so the distance and the deviation needle depict the moment the decision is actually made. The screen states what the needle is worth — full scale ±1 NM, so each of the two dots a side is 0.5 NM — quoting AIM 1-1-17 b.4 for the value and labelling terminal CDI sensitivity as the drill's own assumption, since no FAA source says a hold is flown on it. Expect the needle pegged: off the inbound course at that range, it is, and that is the picture.
- **Clearance copying** — radio-style clearances generated in FAA JO 7110.65 4-6-4 phraseology, field-by-field grading, including the standard-turns trap (turn direction omitted ⇒ right turns) and radial-FROM vs bearing-TO. The same screen carries a second mode, a TO/FROM micro-drill (given a radial or bearing, name the side the hold sits on), scored separately on the Progress screen.
- **Wind correction and timing** — triple-drift outbound correction, outbound-timing adjustment, DME/ATD leg endpoints. A decision sim flies the numbers you commit to and grades the *decisions* — outbound heading and inbound crab against the ACS ±10° heading tolerance — while the resulting ground track and measured inbound leg drive the next-circuit adjustment (AIM 5-3-8 j4). Note the lab asks for the ground-speed-ratio outbound time that *yields* a 60 s inbound, not the 1-minute first leg you actually fly; the screen says so and cites j4, because the written-test answer to the neighbouring question is the other one.
- **Written-test questions** — 43 original FAA-IRA-style questions (max speeds, timing, reports, lost comm 91.185, chart scenarios from the real KTCY/KLVK procedures), practice and exam-sim modes; entry questions show the heading-up HSI picture — the course pointer on the inbound course, with no heading bug, deviation bar or nav status line, because a written question carries no aircraft position and a centred needle would read as "established on course" — and option order is shuffled per run.
- **Oral-exam prep** — Q&A covering every FAA-S-ACS-8C Task III.B element, including G1000 hold behavior (SUSP, OBS holds).
- **Anki export** — a fixed core deck plus a personalized deck built from your entry-drill, written-test, and oral-prep misses, as TSV downloads (clearance-copy and wind-lab misses are tracked in Progress but not yet exported).

## Module → exam-phase map

| Route | Module | Written | Oral | Flight |
|---|---|:-:|:-:|:-:|
| `#/learn` | Learn | ✓ | | |
| `#/entry-drill` | Entry Drill | ✓ | | ✓ |
| `#/written-test` | Written Test | ✓ | | |
| `#/oral-prep` | Oral Prep | | ✓ | |
| `#/wind-lab` | Wind & Timing Lab | | | ✓ |
| `#/clearance-copy` | Clearance Copy | | ✓ | ✓ |
| `#/anki` | Anki Export | | ✓ | |
| `#/dashboard` | Progress | — readiness vs benchmarks across all three — | | |

Suggested order: Learn → Entry Drill (learn mode, then timed cockpit mode) → Written Test → Clearance Copy → Wind & Timing Lab → Oral Prep, with the dashboard showing readiness against benchmarks (entry: 18/20 correct under 10 s, 95% under 15 s).

Every screen except home shows a **← Home** link back to this module list, so returning to the menu never requires editing the URL.

## How to run

```sh
npm install
npm run dev        # local dev server
npm test           # vitest run
npm run typecheck  # tsc --noEmit only
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

Requires Node.js 20.19+ or 22.12+ to build and serve (Vite 8's engines requirement). **`npm test` needs a newer Node than that**: `vite.config.ts` passes `--no-experimental-webstorage` to the Vitest workers so jsdom's `localStorage` survives, and a Node that predates the flag rejects it with `Worker exited unexpectedly` rather than a message naming it. Node 20 is confirmed to fail this way; the flag has existed since Web Storage landed behind it in 22.4, and `mise.toml` pins the version actually used here (26.5.1), so anything in between is untested rather than known-good. Phone/tablet friendly down to 320 px.

One light **page** theme, no dark mode and no toggle — this gets read off a kneeboard tablet in a sunlit cockpit. The single dark element is the HSI, and it is dark for the same reason: it is drawn as the G1000 PFD panel the student flies behind, which is dark in the aircraft, so a light one would be the less faithful picture. Everything around it — the plan-view chart included — stays light. Every UI and instrument colour is checked against WCAG AA by `npm test` (4.5:1 for text, 3:1 for lines and shapes): the page palette against the page, the instrument palette against the face it is drawn on, and the panel itself against the page at 3:1, since a dark plate on a light page is its own component boundary. A palette change that makes the HSI unreadable fails the suite rather than the flight.

## How to deploy

Deployed to Cloudflare Pages as a direct upload of `dist/`. Live at **https://holdpractice.vitko.info** — the custom domain is bound in the Cloudflare dashboard, not in `wrangler.jsonc`.

```sh
mise trust               # once, after any change to mise.toml
mise install             # once, installs the pinned node and wrangler
wrangler login           # once, browser OAuth against your Cloudflare account
mise run deploy          # npm test → npm run build → wrangler pages deploy
```

No SPA-fallback rewrite is configured because the router is hash-based: the browser only ever requests `/` and resolves `#/entry-drill` client-side, so there is no deep-link path for the server to rewrite. `src/deploy.test.ts` asserts the uploaded directory still matches Vite's build output — that coupling is invisible to both tools, and breaking it deploys a stale app with a green suite.

## Anki import

1. Open the **Anki Export** module (`#/anki`) and download `hold-train-core.tsv` (fixed deck) and/or `hold-train-misses.tsv` (built from your recorded entry-drill, written-test, and oral-prep misses).
2. In Anki: File → Import, pick the TSV. Fields are tab-separated: front, back, tags. Enable "Allow HTML in fields" (newlines are exported as `<br>`).
3. Core-deck and oral-miss cards are tagged with their ACS element codes, so you can filter (e.g., `IR.III.B.K1`). Entry-drill and written-test miss cards are tagged `miss` plus the drill (and, for written misses, the topic).
4. **Re-download and re-import after a content correction.** Cards you already imported are not updated by fixes made here, so a corrected fact stays wrong in your deck until you import again. Corrections are logged in `docs/content-audit.md` — the 2026-08-02 parallel-entry rejoin fix changed a core card, so re-import if you exported before then. Corrections to answers, explanations and sources keep the front, so matching notes should update rather than duplicate. But `serializeDeck` emits a bare TSV with no `#notetype:`/`#deck:` header, so first-field matching is scoped to whichever notetype you pick in the import dialog and update-vs-duplicate is an import-screen setting, not a property of the file. Import into the same notetype you used before, leave the existing-notes setting on *Update*, and check the preview before confirming. (Unverified against a specific Anki version.)

   **A correction that rewords the *question* does not update.** Anki matches notes on the first field, so a reworded front imports as a new note and leaves the old one in your deck. The 2026-08-02 rejoin fix did exactly that to a core card: if you exported before then, delete the superseded note after importing — search your deck for `which side of the course do you reintercept from`, whose back still teaches the rejoin turning the wrong way. The misses deck rebuilds each card from the live bank item, so a reworded bank question behaves the same way. `anki-export.test.ts` pins the superseded front against the live `CORE_DECK`, so restoring that front fails the suite rather than silently invalidating this paragraph.

The in-app export screen (`#/anki`) renders its own import list — steps 2 and 4 above, plus the tab-separated field order; the download is a button there rather than a step, and the ACS tagging is not repeated. `anki-export.test.ts` asserts step 4 in particular is present **and identically hedged** in both, because the screen — not this file — is what a user reads at export time. (Asserting only that the step exists is what let the two sides disagree about update-vs-duplicate; see the ledger.)

## Source policy

- Every user-visible aviation fact carries a `source` field citing the **FAA primary source** (AIM 5-3-8/5-3-3, AIM 1-1-17, 14 CFR 91.185/91.167, FAA-S-ACS-8C Task III.B, FAA JO 7110.65), rendered in the UI. The audit ledger is in `docs/content-audit.md`.
- Entry answers are never hand-keyed: `src/engine/entry.ts` is the oracle, validated by golden cases hand-derived by drawing plus property tests.
- **Only the written-test chart questions use real procedures.** Entry-drill, clearance-copy and wind-lab scenarios are seeded *practice fixtures*: the fix names are invented, and so are their courses, turn directions and leg lengths. Where the app prints a plate line it labels it "Practice plate (fictitious fix)". Never carry a practice-fixture hold into the cockpit as if it were charted — a fixture name that collided with a real waypoint is the defect logged in `docs/content-audit.md`.
- Chart scenarios (KTCY RNAV (GPS) RWY 12, KLVK) were derived from FAA dTPP cycle 2607 and cross-checked against same-cycle CIFP records. **Procedures amend every 28 days — verify against current charts before relying on them.** The user flies Jeppesen plates; figures here are FAA-styled, and styling differences are noted where they matter.
- This is a study aid, not flight guidance. Nothing here supersedes current FAA publications, your charts, or your CFII.
