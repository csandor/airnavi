# Flight

How AirNavi tracks the aircraft against the current line, starts and stops recording, advances to the next line, and exports the log.

## Flight State Machine

Flight status moves `idle` → `flying` → `completed`/`idle`. Recording starts automatically when the aircraft is on-line, or manually via the toggle.

`flying` ends when the far endpoint is crossed or the pilot toggles it off; `finishFlight` in [[src/App.jsx#App]] then computes completion and shows [[src/components/SummaryDialog.jsx#SummaryDialog]], whose auto-close delay comes from runtime settings.

## Direction

The flying direction is chosen once per line, when it becomes current: whichever endpoint is closer to the GPS position becomes the entry. Without a fix it defaults to `normal`.

`handleLineSelect` is the single entry point for every way a line becomes current (manual pick, auto-advance, restore), so this orientation happens there and nothing re-evaluates it afterwards.

## Auto-Start

While `idle`, every GPS fix checks the green criteria; when all hold at once, status becomes `flying`.

All four must be true simultaneously, using the effective limits: [[src/config.js#config|config.limits]] (runtime-overridable), with the green/yellow values replaced by the current section's [[missions#Mission Tolerances]] when the file declares them:

- within `start_radius` metres of the line's start **or** end point
- cross-track error ≤ `green`
- vertical error ≤ `vertical_green`
- heading error ≤ `heading_green` degrees

## Logic Loop

While `flying`, every GPS fix recomputes deviations, accumulates green coverage, and checks for completion.

Deviations come from [[src/utils/GeoUtils.js#calculateCrossTrackDistance]], [[src/utils/GeoUtils.js#calculateAlongTrackDistance]] and [[src/utils/GeoUtils.js#calculateVerticalDeviation]]. Completion is green coverage over line length; a pass reaching [[src/config.js#config|config.completionThreshold]] percent counts as a success.

## Quality Classification

[[src/utils/QualityUtils.js#classifyQuality]] rates cross-track and vertical error together as green, yellow or red. [[src/utils/QualityUtils.js#worseQuality]] keeps the worse of two ratings.

Thresholds are the `green`/`yellow` and `vertical_green`/`vertical_yellow` pairs in the runtime limits.

## Approach Guidance

[[src/utils/DubinsUtils.js#planDubinsPath]] plans the shortest Dubins path (turns and straights at a minimum turn radius) from the aircraft's position and heading to a target point and heading.

The target sits `approachDistance` metres before the line start, so the aircraft is already aligned when it reaches the line. Planning happens in a local planar frame ([[src/utils/DubinsUtils.js#latLonToLocalXY]]); `minRadius`, `approachDistance` and `updateIntervalSeconds` are runtime-overridable `dubins` settings.

## Line Advance

`advanceToNextLine` in [[src/App.jsx#App]] picks the next uncompleted line, following the section's row order when one exists (see [[missions#Row Order]]).

- It looks up wherever the current line sits in the order and walks forward from there, wrapping once and skipping completed lines. A manually picked line therefore just repositions where auto-advance continues.
- Without a row order it takes the next higher uncompleted seq in the section.
- When the section is exhausted it jumps to the first line, by that section's order, of the next section in ascending section order.

## Flight Log Export

[[src/utils/FlightLogger.js#flightLogger]] accumulates per-pass statistics and exports them as CSV; [[src/utils/KMZExporter.js#downloadKMZ]] exports the same passes as KMZ.

Both name their file `flight_logs_<mission>_<date>_<time>` via [[src/utils/ExportFileName.js#buildExportFileName]]. Fields, in order: Section, Line, Date, Start Time, End Time, Duration (s), Direction, Completion (%), Max X-Track (m), Max Alt Diff (m), Max Speed (km/h), Max Hdg Diff (deg). The KMZ placemarks carry the same fields as `ExtendedData`.
