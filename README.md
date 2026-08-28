# AirNavi

Offline-capable PWA for aerial survey navigation. The pilot selects a flight line from a KML file, a fixed-width TXT file, or a zip of TXT mission files; the app tracks cross-track error, vertical deviation, and heading deviation in real time, keeps the screen awake, and auto-records when the aircraft is on-line.

---

## Table of Contents
1. [Build & Deploy](#build--deploy)
2. [Versioning](#versioning)
3. [Installation on Android](#installation-on-android)
4. [Installation on iOS](#installation-on-ios)
5. [Usage](#usage)
6. [KML File Format](#kml-file-format)
7. [TXT File Format](#txt-file-format)
8. [Zip Mission Import](#zip-mission-import)
9. [Configuration](#configuration)
10. [Runtime Settings](#runtime-settings)
11. [CSV Export](#csv-export)

---

## Build & Deploy

### Prerequisites
- Node.js 18+
- npm

### Install dependencies
```
npm install
```

### Development server
```
npm run dev
```
Opens at `http://localhost:5173` with hot reload. GPS is replaced by the built-in flight simulator in dev.

### Production build
```
npm run build
```
Output goes to `dist/`. The build includes the PWA service worker so the app works fully offline after the first load.

### Preview production build locally
```
npm run preview
```

### Deploy to GitHub Pages
```
npm run deploy
```
Runs the build and publishes `dist/` to the `gh-pages` branch. The app is then available at your repository's GitHub Pages URL.

---

## Versioning

Version is stored in `package.json`. Three npm scripts handle bumping, committing, and tagging in one step:

```
npm run version:patch   # 2.0.0 -> 2.0.1  (bug fix)
npm run version:minor   # 2.0.0 -> 2.1.0  (new feature)
npm run version:major   # 2.0.0 -> 3.0.0  (breaking change)
```

Each script:
1. Bumps the version in `package.json` and `package-lock.json`
2. Creates a git commit: `chore: bump version to X.Y.Z`
3. Creates a git tag: `vX.Y.Z`

Push the tag to remote manually when ready:
```
git push origin vX.Y.Z
```

---

## Installation on Android

AirNavi is a PWA — no app store required.

1. Open Chrome and navigate to the deployed app URL.
2. Tap the **three-dot menu** (top right) → **Add to Home screen**.
3. Confirm the name and tap **Add**.
4. The app icon appears on your home screen and launches in full-screen standalone mode.
5. After the first load, the app works **fully offline** (service worker caches all assets and KML files).

> **GPS permission:** On first launch Android will ask for location access. Grant "Allow all the time" or "Allow while using the app" for the GPS to work in flight.

---

## Installation on iOS

1. Open **Safari** and navigate to the deployed app URL. (Chrome and Firefox on iOS cannot install PWAs.)
2. Tap the **Share** button (rectangle with arrow, bottom of screen).
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name and tap **Add**.
5. The app icon appears on your home screen and launches in full-screen standalone mode.

> **GPS permission:** Safari will prompt for location access on first use. Tap **Allow**.
>
> **Offline note:** iOS PWA caching is more limited than Android. The app will work offline after the first full load as long as the service worker was registered while online.

---

## Usage

### Loading a flight file
- On startup the app loads the bundled `lines.kml` from `public/kml/`.
- To use your own file: open the **hamburger menu** (top right) → **Load Flight File** → pick a `.kml`, `.txt`, or `.zip` file from your device (see [Zip Mission Import](#zip-mission-import) for the zip case). The file's content is stored in the browser's `localStorage` and reloaded automatically on the next launch.
- **Missions** — bundled files in `public/kml/` are listed in the menu under **Missions**.
- Menu → **Reset Mission** clears flight progress on the currently loaded mission — completed lines, flight logs, and any in-progress recording/simulation — without unloading it, as if it had just been loaded. It does not switch back to the default flight file; use **Load Flight File** or **Missions** for that.
- The mission's file name (without extension) is shown next to the AirNavi version at the top of the screen.

### Sections
Fixed-width TXT files (see [TXT File Format](#txt-file-format)) and zip mission imports (see [Zip Mission Import](#zip-mission-import)) can group flight lines into **sections**. When a loaded file contains more than one section, a **Select Section** dropdown appears to the left of the Line Selector. Picking a section filters the Line Selector, the completed-lines list, and the full-screen map to that section only; KML files always contain a single implicit section, so the selector stays hidden.

Once every line in a section has been completed, [auto-advance](#auto-advance) jumps to the first line (in row order) of the next section automatically.

### Selecting a flight line
Use the **Line Selector** dropdown to pick the line you want to fly. Lines are numbered by their sequence field (from the KML `SimpleData` field, or the row number column in a TXT file), and listed in **row order** if the section declares one (see [TXT File Format](#txt-file-format)), or sorted ascending by sequence number otherwise.

When you select a line (by hand, via auto-advance, or via restore), the **Direction** (Start → End / End → Start) is set automatically to whichever endpoint is currently closer to the aircraft — this is only checked once, at the moment of selection; it won't change while you're flying that line even as your position changes.

### HUD indicators
| Indicator | Meaning |
|-----------|---------|
| Cross-track (left/right) | Lateral distance from the line centre. Green ≤ 2 m, Yellow ≤ 4 m, Red > 4 m. |
| Vertical (up/down) | Altitude difference from the planned line altitude. Same thresholds. |
| Heading arrow | Difference between current heading and line bearing. |
| Distance | Distance to the next endpoint (or to the start if not yet on the line). |

The distance readout bar at the bottom also color-codes **X-Track**, **Hdg Diff**, **Alt Diff**, and **Speed**, each escalating white → yellow → red past its configured green/yellow limit (see [Configuration](#configuration)).

The HUD's center halo circle is always white — it does not change color. The gate ring drawn on the compass instrument (the circle with tick marks) turns green/yellow/red by tracking quality while recording, and stays white otherwise.

### Screen stays awake
The app requests a [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) as soon as it loads, so the device won't sleep while AirNavi is open in the foreground — no extra setting needed. On browsers without wake-lock support this is a silent no-op (the OS's normal screen-off timeout applies).

### Auto-recording
Recording starts automatically when **all** of the following are true simultaneously:
- The aircraft hasn't already passed the line's far endpoint
- Within `start_radius` meters of the line's start or end point (default 10 m)
- Cross-track error ≤ green limit (default 2 m)
- Vertical error ≤ vertical green limit (default 2 m)
- Heading error ≤ heading green limit (default 5°)

Recording stops automatically when the aircraft crosses the far endpoint of the line (completion threshold, default 90%). The **Flight Summary** dialog appears; choose **Keep** to log the result or **Reject** to discard it. The dialog auto-dismisses after `summaryAutoCloseSeconds` (default 10 s, editable live in **⚙ Settings** — see [Runtime Settings](#runtime-settings)) defaulting to the appropriate action based on completion.

You can also start/stop recording manually using the record button in the UI.

### Auto-advance
After a line is completed the app automatically selects the next line — in **row order** if the section declares one, otherwise by sequence number. Manually selecting a line doesn't disable the row order: it just moves auto-advance's position to wherever you picked, and the next auto-advance continues from there. Once every line in the current section is completed, auto-advance wraps within the row order looking for anything still available; if nothing is left, it jumps to the first line (in row order) of the next section.

### Simulation mode
Menu → **Simulate Flight** runs a virtual GPS along the currently selected line. Useful for testing without being airborne. Stop it from the same menu entry.

### Settings
Menu → **⚙ Settings** opens a dialog to:
- Toggle **Units** between metric (m, km/h) and imperial (ft, knots).
- Toggle the **Mini-map** overlay on/off.
- Toggle the **Line Gauge** overlay on/off.
- Edit the crosshair, halo-limit, and Dubins path-planning values live (see [Runtime Settings](#runtime-settings)) without rebuilding the app.
- Edit the **Flight Summary** auto-close delay (seconds before the summary dialog auto-accepts/rejects), listed at the bottom of the dialog.

Changes take effect immediately and persist across reloads; a **Reset to Defaults** button restores the halo/crosshair/Dubins/auto-close values from `src/config.js` (Units, Mini-map, and Line Gauge visibility are separate simple toggles, not covered by this reset).

### Mini-map
A draggable map overlay shows the flight lines and current position. Toggle it from **⚙ Settings**.

### Line Gauge
A draggable, closable vertical bar shown on the HUD screen (not the full-screen map) that symbolizes the selected flight line. Its height matches the HUD compass/halo instrument diameter and scales with it. Once recording starts it fills from the bottom as the aircraft progresses along the line, colored per-segment by the same tracking quality (green/yellow/red) used for the flown-track coloring on the maps. Toggle it from **⚙ Settings**.

### Full-screen map
Tap the map icon next to the record button (it becomes a compass icon while the map is shown) to switch the instrument area to a full-screen OpenStreetMap view rendered with MapLibre GL. The top menu bar and the distance readouts stay visible.

- Every flight line from **every section** in the loaded file is drawn and labeled `section-seq` (e.g. `1-2`, `3-1`), not just the currently selected section.
- The selected line is highlighted (magenta with a dark halo) with green/red start/end markers; other active lines are shown in cyan.
- **Completed lines are shown in grey** and can't be tapped/selected on the map — they become selectable again (and turn back to cyan) once restored from the Line Selector's **Restore Completed** dropdown.
- Tap any active line (or its label) on the map to select it — same effect as picking it from the Line Selector dropdown. Selecting a line from a different section also switches the active **Select Section** dropdown to match.
- The current aircraft position and flown track are shown.
- An **Auto Zoom** checkbox (top-left of the map) controls whether the view auto-fits: to the selected line, start/end + aircraft position (padded 20%) when a line is picked, or to all lines across all sections when none is picked. Uncheck it to pan/zoom freely without the view snapping back — the last manual extents are remembered and restored when you switch back from the HUD view.
- Tap the compass icon to switch back to the HUD view.

### Dubins path planning
When a line is selected and the full-screen map is shown (and you're not currently recording), a **plan-route** button appears next to the record button. Activating it draws a dashed guidance path from the aircraft's current position to a point before the line's start, aligned with the line's heading, using a Dubins path (`dubins.minRadius` turn radius, recomputed every `dubins.updateIntervalSeconds`). Planning mode exits automatically once you're on-line with the correct heading, or when you switch back to the HUD view or start recording.

### Exporting results
- **Export CSV** — downloads a `.csv` file with one row per completed line (see [CSV Export](#csv-export)).
- **Export KMZ** — downloads a KMZ file with the flight tracks; each placemark's extended data also includes the section number.
- Both files are named `flight_logs_<mission name>_<date>_<time>.csv` / `.kmz`, where `<mission name>` is the loaded file's name without its extension.

---

## KML File Format

The parser is strict. Each `<Placemark>` must:

- Have at least one `<SimpleData>` field — the **first** one (regardless of its name) is used as the integer sequence number for ordering and identifying the line.
- Contain a `<LineString>` with exactly **2 vertices** in `<coordinates>`, formatted as space-separated `lon,lat,alt` triplets.
- Have `<altitudeMode>absolute</altitudeMode>` inside `<LineString>` if an altitude mode tag is present at all (any other value is an error).
- Altitudes are interpreted as **MSL** (metres above sea level).

Minimal valid example:
```xml
<?xml version="1.0" encoding="utf-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <Schema name="lines" id="lines">
    <SimpleField name="seq" type="int"></SimpleField>
  </Schema>
  <Placemark>
    <ExtendedData><SchemaData schemaUrl="#lines">
      <SimpleData name="seq">1</SimpleData>
    </SchemaData></ExtendedData>
    <LineString>
      <altitudeMode>absolute</altitudeMode>
      <coordinates>18.80,47.39,160 18.81,47.40,160</coordinates>
    </LineString>
  </Placemark>
</Document>
</kml>
```

---

## TXT File Format

An alternative, fixed-width flight-line format (e.g. survey mission exports). Rules:

- Lines starting with `#` are treated as header/comment metadata and ignored.
- Every other non-empty line is a data row with **at least 5** whitespace-separated columns:

  ```
  lon  lat  alt  row_Nr  section_Nr
  ```

- `row_Nr` (4th column) doubles as the line's **sequence number**. Two data rows sharing the same `(section_Nr, row_Nr)` pair form one flight line — the first occurrence becomes the **start** point, the second becomes the **end** point. Any pair that doesn't appear exactly twice is an error.
- `section_Nr` (5th column) groups lines into **sections** — see [Sections](#sections). A file with only one distinct `section_Nr` value behaves like KML (no section selector shown).
- Altitudes are interpreted as **ellipsoidal (WGS-84)**, not MSL — unlike KML, no geoid undulation correction is applied, since this already matches the GPS altitude datum.
- If a section's `row_Nr` values start at `0`, they're shifted up by 1 so line numbering starts at `1`; sections that already start at any other number are left untouched.

### Row order
A **single-section** TXT file may declare a custom display/auto-advance order via a header comment line of the form:
```
#<space-delimited row numbers> //row order
```
For example `#1 6 2 7 3 8 4 9 5 //row order`. This overrides the default ascending-by-sequence order for the Line Selector dropdown and for [auto-advance](#auto-advance) within that section. Any row number in the file not mentioned in the list is appended afterward in ascending order, so nothing becomes unreachable.

The row-order numbers are taken **exactly as written** and never shifted — even when the data rows themselves get the 0-based shift described above. Real mission files have been observed to reference row numbers inconsistently with their data rows; shifting the row-order list would silently paper over that rather than surface it. Every number in the row-order list must match an actual row number in the file, or the file is rejected as invalid.

The row-order comment only applies to single-section files — with more than one section it's ambiguous which section it describes, so it's ignored. (Zip mission imports get one row order per section this way, from the corresponding `mis###.txt`'s own comment — see [Zip Mission Import](#zip-mission-import).)

Minimal valid example (one section, one line):
```
#GE_1 //section name
 19.252014001  47.648499826  548.00 0 1
 19.261554279  47.643069232  548.00 0 1
```

---

## Zip Mission Import

A zip archive bundling several single-section survey mission exports (e.g. a Vernova-style export with one `mis###.txt`/`.kml`/`_photo_coords.txt` triplet per flight section) can be imported directly as one multi-section mission via **Load Flight File**.

- Only files matching `mis###.txt` (3 digits, e.g. `mis001.txt`) are extracted and parsed — `mis###.kml` and `mis###_photo_coords.txt` siblings, and anything else in the archive, are ignored.
- The 3-digit number in each `mis###.txt` filename becomes that file's **section number** in the combined mission (overriding whatever `section_Nr` the file's own rows use, since each `mis###.txt` is itself a single-section file).
- Each `mis###.txt` is otherwise parsed exactly like a standalone TXT import — including its own [row order](#row-order) comment, if present, scoped to its section.
- The result is one multi-section mission with correct per-section row ordering, as if each `mis###.txt` had been imported individually into its own section.
- The imported zip is stored (as base64) in the browser's `localStorage` and reloaded automatically on the next launch, the same way a plain `.kml`/`.txt` import is.

---

## Configuration

All tuneable parameters are in `src/config.js`. Edit this file before touching any logic. The `crosshair`, `limits`, and `dubins` sections, plus `summaryAutoCloseSeconds`, can additionally be overridden at runtime — see [Runtime Settings](#runtime-settings).

| Key | Default | Description |
|-----|---------|-------------|
| `completionThreshold` | `90` | % of line length required to count as a successful pass |
| `kmlFilePath` | `./lines.kml` | Default KML loaded from `public/` |
| `bundledKmlDir` | `./kml/` | Folder of bundled sample KML/TXT files listed under **Missions**; must contain a `manifest.json` (auto-generated by the Vite kml-manifest plugin) |
| `geoidUndulation` | `43.1` | Geoid height above ellipsoid for the survey area (metres). KML MSL altitudes are converted to ellipsoidal by adding this value before comparing with GPS altitude. Hungary ≈ 43–46 m. Not applied to TXT files (already ellipsoidal). |
| `summaryAutoCloseSeconds` | `10` | Seconds before the Flight Summary dialog auto-dismisses. Overridable at runtime — see [Runtime Settings](#runtime-settings) |
| `notificationDurationSeconds` | `3` | Seconds a toast notification stays visible |
| `simulation.speedKnots` | `70` | Emulator airspeed |
| `simulation.preStartDistanceFactor` | `0.1` | Fraction of the line length the simulator starts before the start point, and continues past the end point |
| `simulation.jitter.*` | — | Random noise added to simulated GPS position, altitude, and heading |
| `qualitySegmentLength` | `10` | Length (m) of each colored chunk when rendering the flown track's quality on the map |
| `crosshair.maxCrossTrack` | `500` | Cross-track distance (m) at which the HUD crosshair reaches maximum screen offset |
| `crosshair.maxAltDiff` | `200` | Vertical distance (m) at which the HUD crosshair reaches maximum screen offset |
| `limits.green` | `5` | Cross-track green threshold (m) |
| `limits.yellow` | `10` | Cross-track yellow threshold (m). Above → red |
| `limits.vertical_green` | `5` | Vertical green threshold (m) |
| `limits.vertical_yellow` | `10` | Vertical yellow threshold (m). Above → red |
| `limits.heading_green` | `10` | Heading threshold (degrees) for auto-start |
| `limits.heading_yellow` | `15` | Heading yellow threshold (degrees). Above → red |
| `limits.start_radius` | `15` | Max distance from line endpoint (m) to allow auto-start |
| `limits.speed_green` | `75` | Below this speed (knots) the Speed readout is green |
| `limits.speed_yellow` | `80` | Below this speed (knots) the Speed readout is yellow; above it, red |
| `dubins.minRadius` | `300` | Minimum turn radius (m) for the planned Dubins path |
| `dubins.approachDistance` | `500` | Distance (m) before the line start where heading must already be aligned |
| `dubins.updateIntervalSeconds` | `5` | Minimum seconds between Dubins path recomputes |

---

## Runtime Settings

The **Crosshair**, **Halo Limits**, **Dubins Path Planning**, and **Flight Summary** (`summaryAutoCloseSeconds`) groups from the table above can be edited without a rebuild via menu → **⚙ Settings**. This opens a dialog with one numeric field per key, grouped the same way.

- **Save** applies the values immediately and stores them in the browser's `localStorage` (key `runtimeSettings`), so they persist across reloads.
- **Reset to Defaults** clears the stored overrides and reverts to the values in `src/config.js`.
- **Cancel** discards unsaved edits.

All other `config.js` keys (KML source, geoid undulation, simulation, timing, etc.) remain build-time only.

---

## CSV Export

One row per completed line, named `flight_logs_<mission name>_<date>_<time>.csv` (see [Exporting results](#exporting-results)):

| Column | Unit |
|--------|------|
| Section | — |
| Line | — |
| Date | local |
| Start Time | local |
| End Time | local |
| Duration | seconds |
| Direction | Forward / Backward |
| Completion | % |
| Max X-Track | metres |
| Max Alt Diff | metres |
| Max Speed | km/h |
| Max Hdg Diff | degrees |

The KMZ export's placemarks carry the same `Section`/`Line`/... fields as extended data (`Line` instead of the old `LineID` field name).
