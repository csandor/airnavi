# AirNavi

Offline-capable PWA for aerial survey navigation. The pilot selects a flight line from a KML file; the app tracks cross-track error, vertical deviation, and heading deviation in real time and auto-records when the aircraft is on-line.

---

## Table of Contents
1. [Build & Deploy](#build--deploy)
2. [Versioning](#versioning)
3. [Installation on Android](#installation-on-android)
4. [Installation on iOS](#installation-on-ios)
5. [Usage](#usage)
6. [KML File Format](#kml-file-format)
7. [Configuration](#configuration)
8. [CSV Export](#csv-export)

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

### Loading a KML file
- On startup the app loads the bundled `lines.kml` from `public/kml/`.
- To use your own file: open the **hamburger menu** (top right) → **Load KML** → pick a `.kml` file from your device. The file is stored in the browser's `localStorage` and reloaded automatically on the next launch.
- **Sample KMLs** — bundled files in `public/kml/` are listed in the menu under **Sample KMLs**.
- To go back to the default: menu → **Reset KML**.

### Selecting a flight line
Use the **Line Selector** dropdown to pick the line you want to fly. Lines are numbered by their sequence field in the KML and sorted ascending.

### HUD indicators
| Indicator | Meaning |
|-----------|---------|
| Cross-track (left/right) | Lateral distance from the line centre. Green ≤ 2 m, Yellow ≤ 4 m, Red > 4 m. |
| Vertical (up/down) | Altitude difference from the planned line altitude. Same thresholds. |
| Heading arrow | Difference between current heading and line bearing. |
| Distance | Distance to the next endpoint (or to the start if not yet on the line). |

### Auto-recording
Recording starts automatically when **all** of the following are true simultaneously:
- Within `start_radius` meters of the line's start or end point (default 50 m)
- Cross-track error ≤ green limit (default 2 m)
- Vertical error ≤ vertical green limit (default 2 m)
- Heading error ≤ heading green limit (default 5°)

Recording stops automatically when the aircraft crosses the far endpoint of the line (98% completion threshold). The **Flight Summary** dialog appears; choose **Keep** to log the result or **Reject** to discard it. The dialog auto-dismisses after 10 seconds defaulting to the appropriate action based on completion.

You can also start/stop recording manually using the record button in the UI.

### Auto-advance
After a line is completed the app automatically selects the next line by sequence number.

### Simulation mode
Menu → **Simulate Flight** runs a virtual GPS along the currently selected line. Useful for testing without being airborne. Stop it from the same menu entry.

### Units
Menu → **Units** toggles between metric (m, km/h) and imperial (ft, knots).

### Mini-map
A draggable map overlay shows the flight lines and current position. Toggle it from the menu.

### Full-screen map
Tap the map icon next to the record button (it becomes a compass icon while the map is shown) to switch the instrument area to a full-screen OpenStreetMap view rendered with MapLibre GL. The top menu bar and the distance readouts stay visible.

- Every flight line from the loaded KML is drawn and labeled with its sequence number.
- The selected line is highlighted (magenta with a dark halo) with green/red start/end markers; other lines are shown in cyan.
- Tap any line (or its label) on the map to select it — same effect as picking it from the Line Selector dropdown.
- The current aircraft position and flown track are shown, and the view auto-fits to the selected line (or to all lines, if none is selected) using the same bounds + padding logic as the mini-map.
- Tap the compass icon to switch back to the HUD view.

### Exporting results
- **Export CSV** — downloads a `.csv` file with one row per completed line (see [CSV Export](#csv-export)).
- **Export KMZ** — downloads a KMZ file with the flight tracks.

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

## Configuration

All tuneable parameters are in `src/config.js`. Edit this file before touching any logic.

| Key | Default | Description |
|-----|---------|-------------|
| `completionThreshold` | `98` | % of line length required to count as a successful pass |
| `kmlFilePath` | `./lines.kml` | Default KML loaded from `public/` |
| `geoidUndulation` | `43.1` | Geoid height above ellipsoid for the survey area (metres). KML MSL altitudes are converted to ellipsoidal by adding this value before comparing with GPS altitude. Hungary ≈ 43–46 m. |
| `limits.green` | `2` | Cross-track green threshold (m) |
| `limits.yellow` | `4` | Cross-track yellow threshold (m) |
| `limits.vertical_green` | `2` | Vertical green threshold (m) |
| `limits.vertical_yellow` | `4` | Vertical yellow threshold (m) |
| `limits.heading_green` | `5` | Heading threshold (degrees) for auto-start |
| `limits.start_radius` | `50` | Max distance from line endpoint (m) to allow auto-start |
| `simulation.speedKnots` | `10` | Emulator airspeed |
| `simulation.jitter.*` | — | Random noise added to simulated GPS position, altitude, and heading |

---

## CSV Export

One row per completed line:

| Column | Unit |
|--------|------|
| Line ID | — |
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
