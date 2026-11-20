// Auto-start decision for line recording (see lat.md flight#Auto-Start).
//
// The aircraft only has to be inside the line's along-track window — from
// `start_radius` metres before the start point up to the far end — with all three
// axes green. A plain radius around the start point is too tight: at ~70 kn and
// 1 Hz fixes, consecutive fixes are ~36 m apart and rarely land inside a 15 m circle.
//
// Both directions are checked: the direction picked at line selection (nearest endpoint
// to wherever the aircraft was then) may be the opposite of how the line is flown.
import {
    calculateCrossTrackDistance, calculateVerticalDeviation, calculateBearing,
    calculateDistance, calculateAlongTrackDistance,
} from './GeoUtils';

/** True while along-track position is between start_radius before the start and the far end. */
export const isInStartWindow = (alongTrack, totalLen, startRadius) =>
    alongTrack >= -startRadius && alongTrack < totalLen;

/** True when cross-track, vertical and heading errors are all within their green limits. */
export const isAllGreen = ({ crossTrack, altDiff, headingDiff }, limits) =>
    Math.abs(crossTrack) <= limits.green &&
    Math.abs(altDiff) <= limits.vertical_green &&
    Math.abs(headingDiff) <= limits.heading_green;

/**
 * Whether recording should auto-start on this fix. `armed` is false after the pilot
 * stopped recording by hand until the aircraft leaves the window (or the line or
 * direction changes), so a manual stop mid-line doesn't immediately restart it.
 */
export const shouldAutoStart = ({ alongTrack, totalLen, crossTrack, altDiff, headingDiff, armed }, limits) =>
    armed &&
    isInStartWindow(alongTrack, totalLen, limits.start_radius) &&
    isAllGreen({ crossTrack, altDiff, headingDiff }, limits);

/** Along-track, cross-track, vertical and heading deviation of a fix against a line flown in `direction`. */
export const lineMetrics = (gps, line, direction) => {
    const start = direction === 'normal' ? line.start : line.end;
    const end = direction === 'normal' ? line.end : line.start;
    let headingDiff = gps.heading - calculateBearing(start.lat, start.lon, end.lat, end.lon);
    while (headingDiff < -180) headingDiff += 360;
    while (headingDiff > 180) headingDiff -= 360;
    return {
        alongTrack: calculateAlongTrackDistance(gps, start, end),
        totalLen: calculateDistance(start.lat, start.lon, end.lat, end.lon) * 1000,
        crossTrack: calculateCrossTrackDistance(gps, start, end),
        altDiff: calculateVerticalDeviation(gps, start, end),
        headingDiff,
    };
};

/**
 * The direction recording should auto-start in on this fix: the current `direction`
 * if it qualifies, else the opposite one if the aircraft is flying the line that way,
 * else null.
 */
export const pickAutoStartDirection = (gps, line, direction, limits, armed) => {
    const other = direction === 'normal' ? 'reverse' : 'normal';
    for (const d of [direction, other]) {
        if (shouldAutoStart({ ...lineMetrics(gps, line, d), armed }, limits)) return d;
    }
    return null;
};
