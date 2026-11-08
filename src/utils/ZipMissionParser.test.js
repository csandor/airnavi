import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import { parseZipMission } from './ZipMissionParser';

const mission = (rowOrder, seqs) => [
    ...(rowOrder ? [`# ${rowOrder} //row order`] : []),
    '#9.9 19.8 29.8 //tolerance: horizontal [m]',
    ...seqs.flatMap(s => [`19 47 500 ${s} 1`, `19 47.1 500 ${s} 1`]),
].join('\n');

const zip = (files) => {
    const u8 = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
};

describe('parseZipMission', () => {
    it('uses each mis###.txt number as its section and keeps per-file row orders', () => {
        const { lines, rowOrders, tolerances } = parseZipMission(zip({
            'export/mis002.txt': mission('2 1', [0, 1]),
            'export/mis010.txt': mission(null, [1, 2, 3]),
        }));
        expect(lines.map(l => [l.section, l.seq])).toEqual([[2, 1], [2, 2], [10, 1], [10, 2], [10, 3]]);
        expect(rowOrders).toEqual({ 2: [2, 1] });
        expect(Object.keys(tolerances)).toEqual(['2', '10']);
    });

    it('ignores kml, photo-coords and other files', () => {
        const { lines } = parseZipMission(zip({
            'mis001.txt': mission(null, [1]),
            'mis001.kml': '<kml/>',
            'mis001_photo_coords.txt': 'garbage',
            'mis01.txt': 'garbage',
            'readme.txt': 'garbage',
        }));
        expect(lines).toHaveLength(1);
    });

    it('throws when the zip holds no mission files', () => {
        expect(() => parseZipMission(zip({ 'readme.txt': 'x' }))).toThrow(/No mis###\.txt/);
    });

    it('prefixes parse errors with the offending file path', () => {
        expect(() => parseZipMission(zip({ 'mis003.txt': '19 47 500 1' }))).toThrow(/^mis003\.txt: /);
    });
});

const m3 = 'public/kml/kuldetes_M3_3cm_2026.zip';
describe.skipIf(!existsSync(m3))('parseZipMission on the M3 sample', () => {
    it('parses 43 sections and 216 lines', () => {
        const { lines, rowOrders } = parseZipMission(readFileSync(m3).buffer);
        expect(lines).toHaveLength(216);
        expect(new Set(lines.map(l => l.section)).size).toBe(43);
        expect(Object.keys(rowOrders).length).toBeGreaterThan(0);
    });
});
