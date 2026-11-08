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

## Zip Missions

[[src/utils/ZipMissionParser.js#parseZipMission]] unzips an archive of single-section `mis###.txt` exports with `fflate` and merges them into one multi-section mission.

Only files matching `mis` + exactly three digits + `.txt` are parsed, which excludes the sibling `mis###.kml` and `mis###_photo_coords.txt` files. The three digits become that file's section number, replacing the `1` that `parseTXT` assigns, and each file's own row-order comment becomes `rowOrders[section]`. The sample `public/kml/kuldetes_M3_3cm_2026.zip` parses to 216 lines in 43 sections.

## Altitude Datum

GPS altitude is WGS-84 ellipsoidal while KML altitudes are MSL. Lines are normalised to ellipsoidal height before any vertical deviation is computed.

`applyGeoidUndulation` adds [[src/config.js#config|config.geoidUndulation]] to KML altitudes only (`ellipsoidal = MSL + undulation`; Hungary is roughly 43–46 m). TXT and zip lines skip it because their altitudes are already ellipsoidal.

## Mission Storage

The last imported mission is restored on launch from `localStorage`, falling back to the bundled `public/lines.kml` when nothing is stored.

KML and TXT imports are stored as raw text under `customKml`. Zip imports are binary, so they are stored base64-encoded under `customMissionZip` and take priority if both keys exist; each import path clears the other key. `customFileName` stores the display name, which also names exported files (see [[flight#Flight Log Export]]). The hamburger menu clears all of these.
