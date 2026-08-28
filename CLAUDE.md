# AirNavi — Developer Notes

## Project Overview
A React PWA (Vite) for aerial survey navigation. The pilot selects a flight line from a KML file, a fixed-width TXT file, or a zip of TXT mission files; the app tracks cross-track, vertical, and heading deviation in real time and auto-records when the aircraft is on-line.

## Versioning
Version is tracked in `package.json`. Use these scripts to bump and tag in one step:
```
npm run version:patch   # 1.0.0 -> 1.0.1
npm run version:minor   # 1.0.0 -> 1.1.0
npm run version:major   # 1.0.0 -> 2.0.0
```
Each script bumps `package.json`, commits with `chore: bump version to X.Y.Z`, and creates a `vX.Y.Z` git tag. Push the tag manually afterwards: `git push origin vX.Y.Z`.

## Running & Building
```
npm run dev       # dev server at http://localhost:5173
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
npm run deploy    # build + publish to GitHub Pages (gh-pages -d dist)
```

## Architecture

### Key files
- `src/config.js` — all tuneable parameters, edit here first before touching logic
- `src/App.jsx` — top-level state, GPS watch, flight state machine, two logic `useEffect` loops
- `src/utils/KMLParser.js` — parses KML into `{seq, start, end}` line objects
- `src/utils/TxtParser.js` — parses single-section fixed-width TXT missions into `{lines, rowOrder}`; see [Row Order](#row-order)
- `src/utils/ZipMissionParser.js` — unzips a multi-file mission archive (via `fflate`), parses each `mis###.txt` with `TxtParser`, merges into one multi-section `{lines, rowOrders}`
- `src/utils/GeoUtils.js` — pure geo math (cross-track, along-track, vertical deviation, bearing)
- `src/utils/FlightLogger.js` — singleton `flightLogger`, accumulates per-line stats, exports CSV
- `src/utils/GPSEmulator.js` — simulation mode GPS feed
- `src/hooks/useWakeLock.js` — requests a Screen Wake Lock on mount, re-acquires on `visibilitychange`; called unconditionally at the top of `App`

### Components
- `HUD.jsx` — primary flight deviation display. The center halo circle is always white (does not reflect tracking quality)
- `VisualNav.jsx` — visual alignment indicator (attitude compass + gate ring). The gate ring (ticks around the target) turns green/yellow/red by `classifyQuality()` while `flightStatus === 'flying'`, white otherwise
- `MiniMap.jsx` — draggable map overview
- `LineSelector.jsx` — line picker + completed lines restore; displays lines in row order when one applies (see [Row Order](#row-order))
- `SummaryDialog.jsx` — post-flight summary; auto-close delay comes from `runtimeSettings.summaryAutoCloseSeconds`, not `config.js` directly
- `Toast.jsx` — transient notifications

## Data Flow
1. KML loaded → `parseKML()` → `applyGeoidUndulation()` → `lines` state (App.jsx). TXT/zip loaded → `parseTXT()`/`parseZipMission()` → `lines` + `rowOrders` state (no undulation — TXT altitudes are already ellipsoidal)
2. GPS (`watchPosition`) or emulator → `gpsData` state (every fix triggers both `useEffect` loops)
3. Auto-start effect: when `flightStatus === 'idle'`, checks all green criteria → sets `'flying'`
4. Logic loop effect: when `flightStatus === 'flying'`, computes deviations, updates coverage, checks completion → calls `finishFlight()`
5. `handleLineSelect()` is the single entry point for every way a line becomes current (manual pick, `advanceToNextLine`, restore) — it's where `direction` is auto-oriented once, by comparing GPS distance to `line.start` vs `line.end`; nothing re-evaluates it afterward

## Flight State Machine
`idle` → (auto-start criteria met, or manual toggle) → `flying` → (endpoint crossed or manual toggle) → `completed` / `idle`

Auto-start criteria (all must be true simultaneously):
- Within `limits.start_radius` meters of line start **or** end point
- Cross-track error ≤ `limits.green`
- Vertical error ≤ `limits.vertical_green`
- Heading error ≤ `limits.heading_green` degrees

## KML Format
The parser (`KMLParser.js`) expects:
- Each `<Placemark>` has at least one `<SimpleData>` — the **first** one is used as the sequence number (name doesn't matter)
- Each line has exactly **2 vertices** (`<coordinates>` with 2 space-separated `lon,lat,alt` triplets)
- `<altitudeMode>absolute</altitudeMode>` inside `<LineString>` (if `altitudeMode` tag is present, it must be `absolute`)
- KML altitudes are treated as **MSL**; `geoidUndulation` is added to convert to ellipsoidal for comparison with GPS

## TXT Format (`TxtParser.js`)
- Data rows: `lon lat alt row_Nr section_Nr` (≥5 whitespace-separated columns); `#`-prefixed lines are comments/metadata
- Two rows sharing `(section_Nr, row_Nr)` form one line — first occurrence is `start`, second is `end`
- Per-section: if the minimum `row_Nr` is `0`, every `row_Nr` in that section is shifted +1 (so numbering starts at 1); sections already starting elsewhere are untouched
- TXT altitudes are already ellipsoidal — **no** `geoidUndulation` applied (unlike KML)
- Returns `{lines, rowOrder}` — `rowOrder` is `number[] | null`

## Row Order
Single-section TXT files may declare a header comment `# <space-delimited row numbers> //row order` (case-insensitive on `//row order`). This becomes `rowOrder` and drives both the Line Selector's display order and `advanceToNextLine()`'s traversal order for that section, in place of plain ascending seq order.
- **Never shifted**: unlike data-row `row_Nr`, the numbers in this comment are used exactly as written, even if the section's rows got the 0-based shift above — real files have been observed to reference rows inconsistently with the data, and "fixing" that by shifting would hide the inconsistency instead of surfacing it. Every number in the list must match an actual row in the file or parsing throws.
- Multi-section files ignore this comment entirely (ambiguous which section it's for).
- Any row not mentioned in the list is appended afterward in ascending order — nothing becomes unreachable.
- `App.jsx` generalizes this to `rowOrders: {[section]: number[]}` (populated per-section for zip imports — see below) rather than a single flat array, since a multi-section mission can have a different order per section.
- Manual line selection does **not** reset or override the order — `advanceToNextLine()` always looks up wherever `currentLine` currently sits in `rowOrders[section]` and returns whatever's next in that list (wrapping once, skipping completed lines), so a hand-picked line just repositions where auto-advance continues from.
- Once a section's row order is exhausted (everything completed), `advanceToNextLine()` falls through to the first line (by that section's own row order, or plain seq order) of the next section in `sections` (ascending).

## Zip Mission Import (`ZipMissionParser.js`)
Unzips (via `fflate`'s `unzipSync`) an archive containing several single-section `mis###.txt` exports (e.g. a Vernova-style bundle with `mis###.kml`/`mis###.txt`/`mis###_photo_coords.txt` triplets per section).
- Only `mis###.txt` (exactly 3 digits, any path prefix) is parsed — regex `/(?:^|\/)mis(\d{3})\.txt$/i` naturally excludes both `mis###.kml` and `mis###_photo_coords.txt` since neither ends in bare `.txt` right after the digits.
- Each matched file's 3-digit number becomes its `section` in the merged mission, overwriting the (always `1`) section that `parseTXT()` assigns internally.
- Each file's own row-order comment, if present, becomes `rowOrders[thatSection]`.
- Returns `{lines, rowOrders}` — same shape `App.jsx` expects from `parseFlightFile()`.
- Persisted to `localStorage` as base64 under `customMissionZip` (binary, unlike the plain-text `customKml` key) and restored with priority over `customKml` on reload.
- Test fixture: `test-kml/kuldetes_M3_3cm_2026.zip` (43 sections) — see [Test Files](#test-files).

## Altitude Datum
- Browser `coords.altitude` = WGS-84 ellipsoidal
- KML altitudes = MSL (as entered by user/GIS tool)
- `config.geoidUndulation` (meters) is added to KML alts after parsing to put them on the same ellipsoidal datum as GPS
- Formula: `ellipsoidal = MSL + undulation`
- Hungary is approximately 43–46 m undulation

## config.js Reference
See `src/config.js` directly for current values — treat this file as the source of truth rather than duplicating numbers here, since defaults have drifted from earlier copies of this doc before. Notable non-obvious ones:
- `summaryAutoCloseSeconds` — overridable at runtime via `runtimeSettings.summaryAutoCloseSeconds` (⚙ Settings), not fixed at build time like most of this file
- `geoidUndulation` — only applied to KML lines (`applyGeoidUndulation()`); TXT/zip lines are already ellipsoidal and skip it entirely
- `limits.*`, `crosshair.*`, `dubins.*` — all overridable at runtime (⚙ Settings → `runtimeSettings`, persisted to `localStorage` key `runtimeSettings`)

## Custom Mission Storage
- Imported KML/TXT files are stored as raw text in `localStorage` key `customKml`, with `customFileName` alongside it. Restored on next launch via `parseFlightFile()`.
- Imported **zip** missions are stored as base64 in `localStorage` key `customMissionZip` (binary — can't reuse the plain-text `customKml` key) with the same `customFileName`. Takes priority over `customKml` on restore if both happen to be present (they shouldn't be simultaneously in normal use — each import path clears the other key).
- Cleared via the hamburger menu. The default `lines.kml` is fetched from `public/` as a fallback when neither key is set.
- `missionFileName` state (App.jsx) drives the displayed mission name (next to the version number) and the exported file names — see CSV/KMZ Export below.

## CSV / KMZ Export
`flightLogger.downloadCSV(missionFileName)` and `downloadKMZ(history, missionFileName)` (`KMZExporter.js`) both name their output `flight_logs_<mission name>_<date>_<time>.csv`/`.kmz` (`ExportFileName.js`'s `buildExportFileName()`, shared by both). Row/field order: **Section**, **Line** (renamed from `LineID`/`Line ID`), Date, Start Time, End Time, Duration (s), Direction, Completion (%), Max X-Track (m), Max Alt Diff (m), Max Speed (km/h), Max Hdg Diff (deg). The KMZ's placemark `ExtendedData` carries the same fields.

## Development Workflow
Do not perform browser-based testing of this app (no launching a browser, driving the UI, or taking screenshots). Verify changes via build (`npm run build`), unit-level checks (e.g. running parser/util functions directly with Node), and code review instead.

## Test Files
Located in `test-kml/` (excluded from build). Notable files:
- `Sóskút_teszt_repvonalak.kml` — uses `ID1` as seq field (first SimpleData), 250 m MSL altitude
- `Erdokurt.kml` — Google Earth export, seq 1–4 added manually, 160 m MSL altitude
- `lines-err-*.kml` — intentionally broken files for testing parser error handling
- `m3/` — a real multi-section survey export unpacked: one `mis###.kml`/`mis###.txt`/`mis###_photo_coords.txt` triplet per section, each `mis###.txt` carrying its own row-order comment (data rows are 0-based; the row-order comment already uses the post-shift 1-based numbers, so it happens to still validate — see [Row Order](#row-order) for what happens when the two genuinely disagree)
- `kuldetes_M3_3cm_2026.zip` — the same `m3/` mission still zipped, for testing `ZipMissionParser.js` end-to-end (43 sections, 216 lines)
