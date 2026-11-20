import { describe, it, expect } from 'vitest';
import { isInStartWindow, shouldAutoStart } from './AutoStart';

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
