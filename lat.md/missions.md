# Missions

A mission is a set of straight flight lines, each `{seq, section, start, end}` with 3D endpoints. It is loaded from KML, fixed-width TXT, or a zip of TXT files.

`parseFlightFile` in [[src/App.jsx]] dispatches on file type and returns `{lines, rowOrders}` for every format, so the rest of the app is format-agnostic.

## KML Format

[[src/utils/KMLParser.js#parseKML]] reads one line per `<Placemark>`, taking the first `<SimpleData>` value as the sequence number regardless of its name.

Each `<LineString>` must have exactly two `lon,lat,alt` vertices, and if `altitudeMode` is present it must be `absolute`. KML altitudes are MSL, so `applyGeoidUndulation` converts them (see [[missions#Altitude Datum]]). Intentionally broken samples in `test-kml/lines-err-*.kml` exercise the error paths.

## TXT Format

[[src/utils/TxtParser.js#parseTXT]] reads whitespace-separated data rows `lon lat alt row_Nr section_Nr`; `#` lines are comments or metadata.

Two rows sharing `(section_Nr, row_Nr)` form one line, the first being `start` and the second `end`. If a section's minimum `row_Nr` is 0, every row in that section is shifted by +1 so numbering starts at 1. TXT altitudes are already ellipsoidal and are not adjusted.

## Row Order

A single-section TXT file may declare `# <row numbers> //row order` (case-insensitive). That list drives both the line picker's display order and auto-advance, instead of ascending seq.

- The listed numbers are used exactly as written and are never shifted, even when the data rows were shifted. Real files have referenced rows inconsistently; shifting would hide that, so an unknown number makes parsing throw instead.
- Rows not mentioned are appended afterwards in ascending order, so no line becomes unreachable.
- Multi-section TXT files ignore the comment because it is ambiguous which section it applies to.
- `App` stores orders per section as `rowOrders: {[section]: number[]}`, since zip missions carry one order per section.

Traversal over this order is described in [[flight#Line Advance]].

## Mission Tolerances

Planner exports declare quality limits in header comments such as `#9.9 19.8 29.8 //tolerance: horizontal [m]`; when present they replace the Settings green/yellow limits for that section.

[[src/utils/TxtParser.js#parseTolerances]] maps the `horizontal`, `vertical` and `yaw` lines to `green`/`yellow`, `vertical_green`/`vertical_yellow` and `heading_green`/`heading_yellow`. Each line's first two values become the green and yellow limits. That matches the GreyBox manual's tolerance chapter: green is 15% of row spacing sideways and 5% of height above ground vertically, yellow is 30% and 10%. The third value (hard limit), the yaw line's trailing system delay and the `tilt` line have no counterpart and are ignored. A malformed line is skipped rather than failing the mission.

`parseTXT` returns them as `tolerances`. `App` keeps `missionTolerances: {[section]: limits}`, filled per section for zip missions, and layers the current section's entry over the Settings `limits` unless the `useMissionTolerances` setting is off. `start_radius` and the speed limits always come from Settings. KML files carry no tolerances.

## Zip Missions

[[src/utils/ZipMissionParser.js#parseZipMission]] unzips an archive of single-section `mis###.txt` exports with `fflate` and merges them into one multi-section mission.

Only files matching `mis` + exactly three digits + `.txt` are parsed, which excludes the sibling `mis###.kml` and `mis###_photo_coords.txt` files. The three digits become that file's section number, replacing the `1` that `parseTXT` assigns, and each file's own row-order comment becomes `rowOrders[section]`. The sample `public/kml/kuldetes_M3_3cm_2026.zip` parses to 216 lines in 43 sections.

## Altitude Datum

All comparisons happen on WGS-84 ellipsoidal height. Both line altitudes and the device's GPS altitude are normalised to it before any vertical deviation is computed.

`applyGeoidUndulation` adds [[src/config.js#config|config.geoidUndulation]] to KML altitudes only (`ellipsoidal = MSL + undulation`; Hungary is roughly 43–46 m). TXT and zip lines skip it because their altitudes are already ellipsoidal.

Device altitude is not always ellipsoidal: Android browsers report it as the Geolocation spec says, but iOS/iPadOS WebKit passes through CoreLocation's height above mean sea level. Reading it as ellipsoidal put an iPad about 43 m too low, so `vertical_green` never passed and recording never auto-started. [[src/utils/AltitudeDatum.js#resolveGpsAltitudeDatum]] turns the `gpsAltitudeDatum` setting (`auto`, `ellipsoidal`, `msl`) into the device's datum, with `auto` meaning MSL on iPhone/iPad. iPadOS sends a Mac user agent, so a touch-capable Mac counts as an iPad. [[src/utils/AltitudeDatum.js#toEllipsoidalAltitude]] then adds the undulation to MSL readings in the GPS watch. The simulator skips this because it already flies the lines' ellipsoidal altitudes.

## Mission Storage

The last imported mission is restored on launch from `localStorage`, falling back to the bundled `public/lines.kml` when nothing is stored.

KML and TXT imports are stored as raw text under `customKml`. Zip imports are binary, so they are stored base64-encoded under `customMissionZip` and take priority if both keys exist; each import path clears the other key. `customFileName` stores the display name, which also names exported files (see [[flight#Flight Log Export]]). The hamburger menu clears all of these.
