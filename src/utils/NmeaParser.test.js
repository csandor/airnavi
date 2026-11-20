import { describe, it, expect } from 'vitest';
import { nmeaChecksumOk, parseNmeaSentence, NmeaStream } from './NmeaParser';

// Build a sentence with a correct checksum from its body (between '$' and '*')
const s = (body) => {
    let cs = 0;
    for (const ch of body) cs ^= ch.charCodeAt(0);
    return `$${body}*${cs.toString(16).toUpperCase().padStart(2, '0')}`;
};

const GGA = s('GNGGA,123519.00,4724.5000,N,01858.2500,E,4,14,0.7,350.2,M,44.1,M,1.0,0000');
const RMC = s('GNRMC,123519.00,A,4724.5000,N,01858.2500,E,72.0,45.5,201126,,,R');
const VTG = s('GNVTG,46.0,T,,M,72.0,N,133.3,K,R');

const collect = (opts) => {
    const fixes = [];
    const stream = new NmeaStream(f => fixes.push(f), opts);
    return { fixes, stream };
};

describe('nmeaChecksumOk', () => {
    it('accepts a correct checksum and rejects a wrong one', () => {
        expect(nmeaChecksumOk('$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47')).toBe(true);
        expect(nmeaChecksumOk('$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*48')).toBe(false);
        expect(nmeaChecksumOk('GPGGA,no dollar')).toBe(false);
    });
});

describe('parseNmeaSentence', () => {
    it('parses GGA position, altitude, geoid separation and fix quality', () => {
        const r = parseNmeaSentence(GGA);
        expect(r.type).toBe('GGA');
        expect(r.time).toBe('123519.00');
        expect(r.lat).toBeCloseTo(47 + 24.5 / 60, 9);
        expect(r.lon).toBeCloseTo(18 + 58.25 / 60, 9);
        expect(r.altMsl).toBeCloseTo(350.2);
        expect(r.geoidSep).toBeCloseTo(44.1);
        expect(r.fixQuality).toBe(4);
        expect(r.satellites).toBe(14);
        expect(r.hdop).toBeCloseTo(0.7);
    });
    it('makes southern and western coordinates negative', () => {
        const r = parseNmeaSentence(s('GPGGA,000000,3345.0000,S,07030.0000,W,1,08,1.0,10.0,M,,M,,'));
        expect(r.lat).toBeCloseTo(-33.75);
        expect(r.lon).toBeCloseTo(-70.5);
        expect(r.geoidSep).toBeNull();
    });
    it('parses RMC speed (knots -> m/s) and course', () => {
        const r = parseNmeaSentence(RMC);
        expect(r.type).toBe('RMC');
        expect(r.speed).toBeCloseTo(72 * 0.514444, 3);
        expect(r.course).toBeCloseTo(45.5);
    });
    it('parses VTG speed and course', () => {
        const r = parseNmeaSentence(VTG);
        expect(r.type).toBe('VTG');
        expect(r.speed).toBeCloseTo(133.3 / 3.6, 3);
        expect(r.course).toBeCloseTo(46);
    });
    it('returns null for bad checksum, unknown types and invalid fixes', () => {
        expect(parseNmeaSentence(GGA.replace('4724', '4725'))).toBeNull();
        expect(parseNmeaSentence(s('GPGSV,3,1,11,03,03,111,00'))).toBeNull();
        expect(parseNmeaSentence(s('GPGGA,123519,,,,,0,00,,,M,,M,,'))).toBeNull();
        expect(parseNmeaSentence(s('GPRMC,123519,V,,,,,,,201126,,,N'))).toBeNull();
    });
});

describe('NmeaStream', () => {
    it('merges GGA + RMC of one epoch into a single fix with ellipsoidal altitude', () => {
        const { fixes, stream } = collect();
        stream.feed(`${GGA}\r\n${RMC}\r\n`);
        expect(fixes).toHaveLength(1);
        const f = fixes[0];
        expect(f.lat).toBeCloseTo(47.408333, 5);
        expect(f.alt).toBeCloseTo(350.2 + 44.1);
        expect(f.altMsl).toBeCloseTo(350.2);
        expect(f.speed).toBeCloseTo(37.04, 2);
        expect(f.heading).toBeCloseTo(45.5);
        expect(f.fixQuality).toBe(4);
    });
    it('handles RMC before GGA and sentences split across chunks', () => {
        const { fixes, stream } = collect();
        const text = `${RMC}\r\n${GGA}\r\n`;
        stream.feed(text.slice(0, 20));
        stream.feed(text.slice(20, 70));
        stream.feed(text.slice(70));
        expect(fixes).toHaveLength(1);
        expect(fixes[0].heading).toBeCloseTo(45.5);
    });
    it('uses VTG when there is no RMC, and emits a GGA-only epoch when the next epoch starts', () => {
        const { fixes, stream } = collect();
        const gga2 = s('GNGGA,123519.10,4724.5010,N,01858.2500,E,4,14,0.7,350.3,M,44.1,M,1.0,0000');
        const gga3 = s('GNGGA,123519.20,4724.5020,N,01858.2500,E,4,14,0.7,350.4,M,44.1,M,1.0,0000');
        stream.feed(`${gga2}\n${VTG}\n${gga3}\n`);
        expect(fixes).toHaveLength(1);
        expect(fixes[0].heading).toBeCloseTo(46);
        expect(fixes[0].speed).toBeCloseTo(133.3 / 3.6, 3);
        stream.flush();
        expect(fixes).toHaveLength(2);
        expect(fixes[1].altMsl).toBeCloseTo(350.4);
    });
    it('falls back to the given undulation when GGA has no geoid separation', () => {
        const { fixes, stream } = collect({ fallbackUndulation: 43 });
        stream.feed(s('GPGGA,000000,4724.5,N,01858.25,E,1,08,1.0,300.0,M,,M,,') + '\n');
        stream.flush();
        expect(fixes[0].alt).toBeCloseTo(343);
    });
    it('carries speed/course from an RMC-only epoch into the next GGA-only fix', () => {
        const { fixes, stream } = collect();
        const rmcEarlier = s('GNRMC,123518.00,A,4724.4990,N,01858.2500,E,72.0,45.5,201126,,,R');
        stream.feed(`${rmcEarlier}\n${GGA}\n`);
        stream.flush();
        expect(fixes).toHaveLength(1);
        expect(fixes[0].heading).toBeCloseTo(45.5);
    });
    it('ignores garbage lines', () => {
        const { fixes, stream } = collect();
        stream.feed('garbage\n$PUBX,00*33\n' + GGA + '\n' + RMC + '\n');
        expect(fixes).toHaveLength(1);
    });
});
