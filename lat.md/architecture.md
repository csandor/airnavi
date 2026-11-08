# Architecture

AirNavi is a single-page React PWA (Vite) that guides a survey pilot along straight flight lines and records each pass. Everything runs offline in the browser.

## App Shell

[[src/App.jsx#App]] owns all top-level state: loaded lines, row orders, the current line and direction, GPS fix, flight status, and completed lines.

Two `useEffect` loops run on every GPS fix: the auto-start check (see [[flight#Auto-Start]]) and the flying-state logic loop (see [[flight#Logic Loop]]). Handlers such as `handleLineSelect`, `advanceToNextLine` and `finishFlight` are closures inside `App`, not exported symbols.

[[src/hooks/useWakeLock.js#useWakeLock]] is called unconditionally at the top of `App` so the screen stays on during flight; it re-acquires the lock on `visibilitychange`.

## Configuration

[[src/config.js#config]] holds every tuneable parameter and is the source of truth for defaults.

The `limits`, `crosshair` and `dubins` groups and `summaryAutoCloseSeconds` can be overridden at runtime from the Settings dialog ([[src/components/SettingsDialog.jsx#SettingsDialog]]). Overrides are persisted to `localStorage` under `runtimeSettings`; everything else is fixed at build time.

## Displays

Three instruments render the current deviation. Each is a pure view over state that `App` computes.

- [[src/components/HUD.jsx#HUD]] — numeric deviation display; its center halo is always white and does not reflect tracking quality.
- [[src/components/VisualNav.jsx#VisualNav]] — canvas attitude compass with a gate ring that is coloured by [[src/utils/QualityUtils.js#classifyQuality]] while flying and white otherwise.
- [[src/components/MiniMap.jsx#MiniMap]] and the lazy-loaded [[src/components/FullMap.jsx#FullMap]] — map overviews; see [[architecture#Offline Basemap]].

## GPS Sources

Position comes from the browser's `watchPosition` or, in simulation mode, from [[src/utils/GPSEmulator.js#GPSEmulator]]. Both feed the same `gpsData` state.

Browser `coords.altitude` is WGS-84 ellipsoidal, which drives the datum handling in [[missions#Altitude Datum]].

## Offline Basemap

The full map uses MapLibre GL with a PMTiles basemap of Hungary, stored in the browser's Origin Private File System (OPFS) rather than precached by the service worker.

[[src/utils/OsmAssets.js#ensureOsmAssets]] downloads `public/osm/osm.zip` (built by `npm run build:osm-package` from `osm-assets/`) on first use and unpacks it into OPFS. The archive is ~250 MB, so the PWA config deliberately excludes it from Workbox precaching. MapLibre itself is lazy-loaded with `FullMap` to keep the initial bundle small.

## Build and PWA

[[vite.config.js]] builds the app with `base: './'` for GitHub Pages and generates the service worker via `vite-plugin-pwa`.

A small Vite plugin writes `public/kml/manifest.json` listing the bundled sample missions so the app's picker needs no hardcoded list. `public/kml/` is gitignored; the plugin creates it when missing so a fresh checkout still builds, with an empty sample list.
