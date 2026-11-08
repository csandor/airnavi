# Architecture

AirNavi is a single-page React PWA (Vite) that guides a survey pilot along straight flight lines and records each pass. Everything runs offline in the browser.

## App Shell

[[src/App.jsx#App]] owns all top-level state: loaded lines, row orders, the current line and direction, GPS fix, flight status, and completed lines.

Two `useEffect` loops run on every GPS fix: the auto-start check (see [[flight#Auto-Start]]) and the flying-state logic loop (see [[flight#Logic Loop]]). Handlers such as `handleLineSelect`, `advanceToNextLine` and `finishFlight` are closures inside `App`, not exported symbols.

[[src/hooks/useWakeLock.js#useWakeLock]] is called unconditionally at the top of `App` so the screen stays on during flight; it re-acquires the lock on `visibilitychange`.

## Configuration

[[src/config.js#config]] holds every tuneable parameter and is the source of truth for defaults.

The `limits`, `crosshair` and `dubins` groups, `summaryAutoCloseSeconds`, `gpsAltitudeDatum`, `useMissionTolerances` and `navInstrument` can be overridden at runtime from the Settings dialog ([[src/components/SettingsDialog.jsx#SettingsDialog]]). Overrides are persisted to `localStorage` under `runtimeSettings`; everything else is fixed at build time.

## Displays

Three instruments render the current deviation. Each is a pure view over state that `App` computes.

- [[src/components/HUD.jsx#HUD]] — numeric deviation display; its center halo is always white and does not reflect tracking quality.
- [[src/components/VisualNav.jsx#VisualNav]] — canvas attitude compass plus a right-hand instrument chosen by the `navInstrument` setting. `gate` draws a ring that moves toward the line, coloured by [[src/utils/QualityUtils.js#classifyQuality]] while flying and white otherwise. `ils` draws a classic ILS gauge (styled after Wikimedia's `ILS_gauge.svg`: grey bezel with corner knobs, black face, centre circle, four dots per side). A vertical needle shows cross-track and a horizontal one vertical deviation, both pointing toward the line, as in the legacy GreyBox panel. Needle colours follow each axis' quality at all times, not only while flying, since this mode has no other quality cue. [[src/utils/IlsScale.js#deviationToDots]] scales each axis by its own effective limits (1 dot = green, 2 dots = yellow, then an exponential approach to 4.5 dots); the `crosshair` settings only affect the gate. In `ils` mode the compass gets the same bezel and face with 5°/10° ticks, both faces shrink to 0.88 of the layout radius so the bezels fit the old footprint, and the HUD hides its halo and arrows.
- [[src/components/MiniMap.jsx#MiniMap]] and the lazy-loaded [[src/components/FullMap.jsx#FullMap]] — map overviews; see [[architecture#Offline Basemap]].

## GPS Sources

Position comes from the browser's `watchPosition` or, in simulation mode, from [[src/utils/GPSEmulator.js#GPSEmulator]]. Both feed the same `gpsData` state.

Browser `coords.altitude` is WGS-84 ellipsoidal on Android but sea-level (EGM2008 geoid) on iOS/iPadOS; [[missions#Altitude Datum]] normalises both.

## Offline Basemap

The full map uses MapLibre GL with a PMTiles basemap of Hungary, stored in the browser's Origin Private File System (OPFS) rather than precached by the service worker.

[[src/utils/OsmAssets.js#ensureOsmAssets]] downloads `public/osm/osm.zip` (built by `npm run build:osm-package` from `osm-assets/`) on first use and unpacks it into OPFS. The archive is ~250 MB, so the PWA config deliberately excludes it from Workbox precaching. MapLibre itself is lazy-loaded with `FullMap` to keep the initial bundle small.

## Build and PWA

[[vite.config.js]] builds the app with `base: './'` for GitHub Pages and generates the service worker via `vite-plugin-pwa`.

A small Vite plugin writes `public/kml/manifest.json` listing the bundled sample missions so the app's picker needs no hardcoded list. `public/kml/` is gitignored; the plugin creates it when missing so a fresh checkout still builds, with an empty sample list.
