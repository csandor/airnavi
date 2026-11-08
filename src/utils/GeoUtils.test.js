import { describe, it, expect } from 'vitest';
import {
    calculateDistance, calculateBearing, calculateCrossTrackDistance,
    calculateAlongTrackDistance, destinationPoint, calculateVerticalDeviation,
} from './GeoUtils';
import { deviationToDots, axisQuality, MAX_DOTS } from './IlsScale';

// A 2 km line heading due north near Budapest, 500 m start / 600 m end
const start = { lat: 47.5, lon: 19.0, alt: 500 };
const end = { ...destinationPoint(start.lat, start.lon, 0, 2000), alt: 600 };

describe('GeoUtils', () => {
    it('destinationPoint and calculateDistance round-trip', () => {
        const p = destinationPoint(47.5, 19.0, 73, 1234);
        expect(calculateDistance(47.5, 19.0, p.lat, p.lon) * 1000).toBeCloseTo(1234, 3);
        expect(calculateBearing(47.5, 19.0, p.lat, p.lon)).toBeCloseTo(73, 3);
    });

    it('bearing is normalised to 0..360', () => {
        const west = destinationPoint(47.5, 19.0, 270, 1000);
        expect(calculateBearing(47.5, 19.0, west.lat, west.lon)).toBeCloseTo(270, 1);
    });

    it('cross-track is positive right of track, negative left', () => {
        const mid = destinationPoint(start.lat, start.lon, 0, 1000);
        const right = destinationPoint(mid.lat, mid.lon, 90, 25);
        const left = destinationPoint(mid.lat, mid.lon, 270, 25);
        expect(calculateCrossTrackDistance(right, start, end)).toBeCloseTo(25, 1);
        expect(calculateCrossTrackDistance(left, start, end)).toBeCloseTo(-25, 1);
        expect(calculateCrossTrackDistance(mid, start, end)).toBeCloseTo(0, 3);
    });

    it('along-track measures from the start, negative before it', () => {
        const p = destinationPoint(destinationPoint(start.lat, start.lon, 0, 700).lat, start.lon, 90, 30);
        expect(calculateAlongTrackDistance(p, start, end)).toBeCloseTo(700, 0);
        const before = destinationPoint(start.lat, start.lon, 180, 100);
        expect(calculateAlongTrackDistance(before, start, end)).toBeCloseTo(-100, 1);
    });

    it('vertical deviation interpolates line altitude, and extrapolates past the ends', () => {
        const mid = { ...destinationPoint(start.lat, start.lon, 0, 1000), alt: 560 };
        expect(calculateVerticalDeviation(mid, start, end)).toBeCloseTo(10, 1); // line is 550 here
        const before = { ...destinationPoint(start.lat, start.lon, 180, 200), alt: 490 };
        expect(calculateVerticalDeviation(before, start, end)).toBeCloseTo(0, 1); // line is 490 here
    });
});

describe('IlsScale', () => {
    it('1 dot = green limit, 2 dots = yellow limit, sign follows deviation', () => {
        expect(deviationToDots(5, 5, 10)).toBeCloseTo(1);
        expect(deviationToDots(-10, 5, 10)).toBeCloseTo(-2);
        expect(deviationToDots(7.5, 5, 10)).toBeCloseTo(1.5);
    });

    it('approaches but never exceeds MAX_DOTS', () => {
        expect(deviationToDots(1e6, 5, 10)).toBeLessThanOrEqual(MAX_DOTS);
        expect(deviationToDots(1e6, 5, 10)).toBeGreaterThan(4.4);
    });

    it('falls back to yellow = 2 × green and to 0 for invalid input', () => {
        expect(deviationToDots(10, 5, 0)).toBeCloseTo(2);
        expect(deviationToDots(NaN, 5, 10)).toBe(0);
        expect(deviationToDots(3, 0, 10)).toBe(0);
    });

    it('axisQuality uses strict < thresholds', () => {
        expect(axisQuality(4.9, 5, 10)).toBe('green');
        expect(axisQuality(-5, 5, 10)).toBe('yellow');
        expect(axisQuality(10, 5, 10)).toBe('red');
    });
});
