// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseKML } from './KMLParser';

const placemark = (seq, coords, altitudeMode = 'absolute') => `
  <Placemark>
    <ExtendedData><SchemaData><SimpleData name="id">${seq}</SimpleData><SimpleData name="other">99</SimpleData></SchemaData></ExtendedData>
    <LineString>${altitudeMode ? `<altitudeMode>${altitudeMode}</altitudeMode>` : ''}
      <coordinates>${coords}</coordinates>
    </LineString>
  </Placemark>`;
const kml = (...pms) => `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${pms.join('')}</Document></kml>`;

describe('parseKML', () => {
    it('uses the first SimpleData as seq and sorts by it', () => {
        const lines = parseKML(kml(
            placemark(2, '19.1,47.1,500 19.2,47.2,510'),
            placemark(1, '19.0,47.0,500 19.0,47.1,500'),
        ));
        expect(lines.map(l => l.seq)).toEqual([1, 2]);
        expect(lines[1]).toEqual({
            seq: 2,
            start: { lon: 19.1, lat: 47.1, alt: 500 },
            end: { lon: 19.2, lat: 47.2, alt: 510 },
        });
    });

    it('accepts a LineString without altitudeMode', () => {
        expect(parseKML(kml(placemark(1, '19,47,500 19,47.1,500', null)))).toHaveLength(1);
    });

    it('rejects a placemark without SimpleData', () => {
        const text = kml('<Placemark><LineString><coordinates>19,47,1 19,47.1,1</coordinates></LineString></Placemark>');
        expect(() => parseKML(text)).toThrow(/missing a SimpleData/);
    });

    it('rejects altitudeMode other than absolute', () => {
        expect(() => parseKML(kml(placemark(1, '19,47,500 19,47.1,500', 'relativeToGround')))).toThrow(/Must be "absolute"/);
    });

    it('rejects lines with other than 2 vertices', () => {
        expect(() => parseKML(kml(placemark(1, '19,47,500 19,47.1,500 19,47.2,500')))).toThrow(/3 points/);
    });

    it('rejects 2D coordinates', () => {
        expect(() => parseKML(kml(placemark(1, '19,47 19,47.1')))).toThrow(/must be 3D/);
    });
});

// Intentionally broken samples (gitignored; skipped on a fresh checkout)
const errFiles = ['lines-err.kml', 'lines-err-2d.kml', 'lines-err-noseq.kml'].map(f => `test-kml/${f}`);
describe.skipIf(!errFiles.every(f => existsSync(f)))('parseKML on test-kml/lines-err-*.kml', () => {
    it.each(errFiles)('%s throws', (f) => {
        expect(() => parseKML(readFileSync(f, 'utf8'))).toThrow();
    });
});
