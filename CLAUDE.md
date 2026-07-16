# AirNavi — Developer Notes

## Project Overview
A React PWA (Vite) for aerial survey navigation. The pilot selects a flight line from a KML file; the app tracks cross-track, vertical, and heading deviation in real time and auto-records when the aircraft is on-line.

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
- `src/utils/GeoUtils.js` — pure geo math (cross-track, along-track, vertical deviation, bearing)
- `src/utils/FlightLogger.js` — singleton `flightLogger`, accumulates per-line stats, exports CSV
- `src/utils/GPSEmulator.js` — simulation mode GPS feed

### Components
- `HUD.jsx` — primary flight deviation display
- `VisualNav.jsx` — visual alignment indicator
- `MiniMap.jsx` — draggable map overview
- `LineSelector.jsx` — line picker + completed lines restore
- `SummaryDialog.jsx` — post-flight summary
- `Toast.jsx` — transient notifications

## Data Flow
1. KML loaded → `parseKML()` → `applyGeoidUndulation()` → `lines` state
2. GPS (`watchPosition`) or emulator → `gpsData` state (every fix triggers both `useEffect` loops)
3. Auto-start effect: when `flightStatus === 'idle'`, checks all green criteria → sets `'flying'`
4. Logic loop effect: when `flightStatus === 'flying'`, computes deviations, updates coverage, checks completion → calls `finishFlight()`

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

## Altitude Datum
- Browser `coords.altitude` = WGS-84 ellipsoidal
- KML altitudes = MSL (as entered by user/GIS tool)
- `config.geoidUndulation` (meters) is added to KML alts after parsing to put them on the same ellipsoidal datum as GPS
- Formula: `ellipsoidal = MSL + undulation`
- Hungary is approximately 43–46 m undulation

## config.js Reference
```js
completionThreshold: 98        // % of line length needed to count as success
kmlFilePath: './lines.kml'     // default KML (relative to public/)
geoidUndulation: 43.1          // geoid height above ellipsoid for the survey area (meters)

limits: {
    green: 2,                  // cross-track green threshold (m)
    yellow: 4,                 // cross-track yellow threshold (m)
    vertical_green: 2,         // vertical green threshold (m)
    vertical_yellow: 4,        // vertical yellow threshold (m)
    heading_green: 5,          // heading green threshold (degrees) — also used for auto-start
    start_radius: 5,           // max distance from endpoint to allow auto-start (m)
}

simulation.speedKnots          // emulator speed
simulation.jitter.*            // random noise added in simulation
```

## Custom KML Storage
Imported KML files are stored as raw text in `localStorage` key `customKml`. Cleared via the hamburger menu. The default `lines.kml` is fetched from `public/` as a fallback.

## CSV Export
`flightLogger.downloadCSV()` exports one row per completed line:
Line ID, Date, Start Time, End Time, Duration (s), Direction, Completion (%), Max X-Track (m), Max Alt Diff (m), Max Speed (km/h), Max Hdg Diff (deg)

## Development Workflow
Do not perform browser-based testing of this app (no launching a browser, driving the UI, or taking screenshots). Verify changes via build (`npm run build`), unit-level checks (e.g. running parser/util functions directly with Node), and code review instead.

## Test KML Files
Located in `test-kml/` (excluded from build). Notable files:
- `Sóskút_teszt_repvonalak.kml` — uses `ID1` as seq field (first SimpleData), 250 m MSL altitude
- `Erdokurt.kml` — Google Earth export, seq 1–4 added manually, 160 m MSL altitude
- `lines-err-*.kml` — intentionally broken files for testing parser error handling
