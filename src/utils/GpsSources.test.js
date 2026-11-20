import { describe, it, expect, vi } from 'vitest';
import { nmeaLogToTimedFixes, startNmeaReplay, FixRateMeter } from './GpsSources';

const s = (body) => {
    let cs = 0;
    for (const ch of body) cs ^= ch.charCodeAt(0);
    return `$${body}*${cs.toString(16).toUpperCase().padStart(2, '0')}`;
};
const gga = (time, latMin) => s(`GNGGA,${time},47${latMin},N,01858.2500,E,4,14,0.7,350.0,M,44.0,M,1.0,0000`);
const rmc = (time) => s(`GNRMC,${time},A,4724.5000,N,01858.2500,E,72.0,90.0,201126,,,R`);

// 10 Hz log: three epochs 0.1 s apart
const LOG = [gga('235959.80', '24.5000'), rmc('235959.80'),
    gga('235959.90', '24.5010'), rmc('235959.90'),
    gga('000000.00', '24.5020'), rmc('000000.00')].join('\r\n');

describe('nmeaLogToTimedFixes', () => {
    it('times fixes from GGA UTC, across midnight', () => {
        const timed = nmeaLogToTimedFixes(LOG);
        expect(timed.map(t => t.offsetMs)).toEqual([0, 100, 200]);
        expect(timed[0].fix.source).toBe('nmea');
        expect(timed[2].fix.alt).toBeCloseTo(394);
        expect(timed[1].fix.heading).toBeCloseTo(90);
    });
});

describe('startNmeaReplay', () => {
    it('emits fixes on schedule and reports the end; stop cancels the rest', () => {
        vi.useFakeTimers();
        const got = [];
        const onEnd = vi.fn();
        startNmeaReplay(LOG, f => got.push(f), { onEnd });
        vi.advanceTimersByTime(150);
        expect(got).toHaveLength(2);
        vi.advanceTimersByTime(100);
        expect(got).toHaveLength(3);
        expect(onEnd).toHaveBeenCalledWith(3);

        const got2 = [];
        const stop = startNmeaReplay(LOG, f => got2.push(f));
        vi.advanceTimersByTime(50);
        stop();
        vi.advanceTimersByTime(500);
        expect(got2).toHaveLength(1);
        vi.useRealTimers();
    });
});

describe('FixRateMeter', () => {
    it('measures 10 Hz and forgets old fixes', () => {
        const m = new FixRateMeter(1000);
        for (let t = 0; t <= 1000; t += 100) m.tick(t);
        expect(m.hz(1000)).toBeCloseTo(10);
        expect(m.hz(5000)).toBe(0);
    });
});
