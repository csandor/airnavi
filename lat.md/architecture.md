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
