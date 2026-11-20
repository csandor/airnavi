import { describe, it, expect } from 'vitest';
import { isInStartWindow, shouldAutoStart, pickAutoStartDirection } from './AutoStart';
import { destinationPoint, calculateBearing } from './GeoUtils';

const limits = { green: 5, vertical_green: 5, heading_green: 10, start_radius: 15 };
const green = { crossTrack: 2, altDiff: -3, headingDiff: 4, totalLen: 2000, armed: true };

describe('isInStartWindow', () => {
    it('covers start_radius before the start up to (not including) the far end', () => {
        expect(isInStartWindow(-16, 2000, 15)).toBe(false);
        expect(isInStartWindow(-15, 2000, 15)).toBe(true);
        expect(isInStartWindow(1000, 2000, 15)).toBe(true);
        expect(isInStartWindow(2000, 2000, 15)).toBe(false);
    });
});

describe('shouldAutoStart', () => {
    it('starts on a 1 Hz fix ~36 m past the start point (old 15 m radius missed this)', () => {
        expect(shouldAutoStart({ ...green, alongTrack: 36 }, limits)).toBe(true);
    });
    it('starts mid-line when all axes are green', () => {
        expect(shouldAutoStart({ ...green, alongTrack: 900 }, limits)).toBe(true);
    });
    it('does not start before the window or past the far end', () => {
        expect(shouldAutoStart({ ...green, alongTrack: -40 }, limits)).toBe(false);
        expect(shouldAutoStart({ ...green, alongTrack: 2010 }, limits)).toBe(false);
    });
    it('needs every axis green', () => {
        expect(shouldAutoStart({ ...green, alongTrack: 100, crossTrack: -6 }, limits)).toBe(false);
        expect(shouldAutoStart({ ...green, alongTrack: 100, altDiff: 5.5 }, limits)).toBe(false);
        expect(shouldAutoStart({ ...green, alongTrack: 100, headingDiff: -11 }, limits)).toBe(false);
    });
    it('does not start while disarmed (after a manual stop)', () => {
        expect(shouldAutoStart({ ...green, alongTrack: 100, armed: false }, limits)).toBe(false);
    });
});

describe('pickAutoStartDirection', () => {
    // ~2 km line heading north-east; fix 300 m in from the start, on the line
    const line = { start: { lat: 47.4, lon: 18.9, alt: 500 }, end: { lat: 47.41, lon: 18.92, alt: 500 } };
    const brg = calculateBearing(line.start.lat, line.start.lon, line.end.lat, line.end.lon);
    const p = { ...destinationPoint(line.start.lat, line.start.lon, brg, 300), alt: 500 };

    it('keeps the selected direction when it qualifies', () => {
        expect(pickAutoStartDirection({ ...p, heading: brg }, line, 'normal', limits, true)).toBe('normal');
    });
    it('switches to the opposite direction when the line is flown the other way', () => {
        expect(pickAutoStartDirection({ ...p, heading: brg }, line, 'reverse', limits, true)).toBe('normal');
        expect(pickAutoStartDirection({ ...p, heading: (brg + 180) % 360 }, line, 'normal', limits, true)).toBe('reverse');
    });
    it('returns null when off heading in both directions or disarmed', () => {
        expect(pickAutoStartDirection({ ...p, heading: (brg + 90) % 360 }, line, 'normal', limits, true)).toBeNull();
        expect(pickAutoStartDirection({ ...p, heading: brg }, line, 'normal', limits, false)).toBeNull();
    });
});
