# Architecture

AirNavi is a single-page React PWA (Vite) that guides a survey pilot along straight flight lines and records each pass. Everything runs offline in the browser.

## App Shell

[[src/App.jsx#App]] owns all top-level state: loaded lines, row orders, the current line and direction, GPS fix, flight status, and completed lines.

Two `useEffect` loops run on every GPS fix: the auto-start check (see [[flight#Auto-Start]]) and the flying-state logic loop (see [[flight#Logic Loop]]). Handlers such as `handleLineSelect`, `advanceToNextLine` and `finishFlight` are closures inside `App`, not exported symbols.

[[src/hooks/useWakeLock.js#useWakeLock]] is called unconditionally at the top of `App` so the screen stays on during flight; it re-acquires the lock on `visibilitychange`.

## Configuration

[[src/config.js#config]] holds every tuneable parameter and is the source of truth for defaults.

The `limits` and `dubins` groups, `summaryAutoCloseSeconds`, `gpsAltitudeDatum` and `useMissionTolerances` can be overridden at runtime from the Settings dialog ([[src/components/SettingsDialog.jsx#SettingsDialog]]). Overrides are persisted to `localStorage` under `runtimeSettings`; everything else is fixed at build time.

## Displays

Three instruments render the current deviation. Each is a pure view over state that `App` computes.

- [[src/components/HUD.jsx#HUD]] — the numeric deviation panel (distance, cross-track, vertical, heading, speed) under the instruments.
- [[src/components/VisualNav.jsx#VisualNav]] — canvas drawing two classic panel instruments, styled after Wikimedia's `ILS_gauge.svg` (grey bezel with corner knobs, black face): a heading compass with 5°/10° ticks and the red course line, and an ILS gauge. On the ILS gauge, a vertical needle shows cross-track and a horizontal one vertical deviation, both pointing toward the line, as in the legacy GreyBox panel. It has a centre circle and four dots per side; [[src/utils/IlsScale.js#deviationToDots]] scales each axis by its own effective limits (1 dot = green, 2 dots = yellow, then an exponential approach to 4.5 dots). Needle colours follow each axis' quality at all times, not only while flying; they are the only on-screen quality cue besides the coloured numbers. This replaced an earlier moving "gate" ring and HUD halo/arrows.
- [[src/components/LineGauge.jsx#LineGauge]] — vertical progress bar along the current line, filled bottom-up and coloured per quality chunk while recording.
- [[src/components/MiniMap.jsx#MiniMap]] and the lazy-loaded [[src/components/FullMap.jsx#FullMap]] — map overviews; see [[architecture#Offline Basemap]].

### Instrument Panel

The flight view is one fixed row of bezelled instruments: line gauge, compass, ILS gauge, minimap, left to right. Nothing is draggable or closable; the gauge and minimap are turned on or off in Settings.

[[src/components/VisualNav.jsx#VisualNav]] lays out the row, sizing everything from the bezel half-height so it fills the width or the height above the numeric panel. The compass, ILS gauge and minimap are equal squares; the gauge bezel is narrow. It draws all bezels, including rectangular ones for the gauge and map. Through `onLayout` it reports the gauge and map face rectangles, including their corner radius, and `App` places the DOM components exactly over those faces, clipped to the rounded corner (`clip-path` as well as `border-radius`, since WebKit won't clip the basemap's WebGL canvas by radius alone). The sky/ground horizon is drawn on the row's centre line. Hiding the gauge or minimap in Settings drops its slot and the row re-centres.

## GPS Sources

Position comes from the browser's `watchPosition` or, in simulation mode, from [[src/utils/GPSEmulator.js#GPSEmulator]]. Both feed the same `gpsData` state.

Browser `coords.altitude` is WGS-84 ellipsoidal on Android but sea-level (EGM2008 geoid) on iOS/iPadOS; [[missions#Altitude Datum]] normalises both.

## Offline Basemap

The full map uses MapLibre GL with a PMTiles basemap of Hungary, stored in the browser's Origin Private File System (OPFS) rather than precached by the service worker.

[[src/utils/OsmAssets.js#ensureOsmAssets]] downloads `public/osm/osm.zip` (built by `npm run build:osm-package` from `osm-assets/`) on first use and unpacks it into OPFS. The archive is ~250 MB, so the PWA config deliberately excludes it from Workbox precaching. MapLibre itself is lazy-loaded with `FullMap` to keep the initial bundle small.

[[src/utils/OsmStyle.js#loadOsmStyle]] holds the shared MapLibre plumbing (PMTiles and OPFS asset protocols, style loading) for both maps; only lazy components import it. MapLibre v6 is ESM-only with a separate worker bundle that it looks for next to its own module, which bundling breaks. `OsmStyle.js` therefore imports the worker with `?url` and passes it to `setWorkerUrl`, and [[vite.config.js]] emits it with a `.js` extension, since module workers need a JavaScript MIME type and some servers don't map `.mjs`. That keeps it inside the precached `**/*.js` glob, so the map works offline. Opening the full map triggers the download. The minimap's basemap ([[src/components/MiniMapBasemap.jsx#MiniMapBasemap]], also lazy) calls it with `download: false` and shows nothing until the package is installed.

The minimap projects with Web Mercator ([[src/utils/MiniMapProjection.js#fitMercatorView]]): it fits the line and aircraft with 20% padding (at least 500 m across) and hands the basemap the matching centre and zoom (`zoom = log2(px per Mercator unit / 512)`). That way its canvas overlay of line, endpoints, track and aircraft lines up exactly with the non-interactive map. With the basemap showing, the canvas only dims it slightly, draws the line cyan, and prints the OpenStreetMap credit itself.

## Build and PWA

[[vite.config.js]] builds the app with `base: './'` so it runs from any sub-path, and generates the service worker via `vite-plugin-pwa`.

### App Updates

The service worker is in `prompt` mode, so a new version downloads in the background but never takes over by itself. [[src/components/UpdatePrompt.jsx#UpdatePrompt]] registers it, checks for updates every 30 minutes and whenever the app returns to the foreground, and then shows a "Reload" banner.

The banner is hidden while flying. When completed lines or flight-log entries exist it warns that reloading clears them, because both live only in memory. Reloading is always the pilot's tap.

Workbox's `glob` dependency is pinned to v14 through an npm `overrides` entry to clear audit advisories. The remaining low-severity `deepmerge` advisory has no patched release, and it only runs at build time.

The only deploy target is the viamap web host (https://new.viamap.hu/airnavi/). `npm run deploy` builds, then rsyncs `dist/` over SSH (host alias `viamap`) to `~/new.viamap.hu/airnavi/`. `index.html` is copied in a second pass so a half-finished upload never references missing assets. Nothing remote is deleted, and rsync's change detection keeps the ~250 MB `osm/osm.zip` from being re-sent. GitHub Pages is no longer used.

A small Vite plugin writes `public/kml/manifest.json` listing the bundled sample missions so the app's picker needs no hardcoded list. `public/kml/` is gitignored; the plugin creates it when missing so a fresh checkout still builds, with an empty sample list.

## Tests

Unit tests use Vitest (`npm test`), which resolves the extensionless source imports through Vite. They sit next to the code as `src/utils/*.test.js` and cover the mission parsers, geo maths and ILS scale.

Fixtures are built inline. Checks against the real sample files (`public/kml/`, `test-kml/`) are skipped when those gitignored folders are missing. [[src/utils/KMLParser.js#parseKML]] needs `DOMParser`, so its test file runs under happy-dom. UI components are not unit-tested; they are verified by build, lint and on-device review.
