import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseTXT, parseTolerances } from './TxtParser';

// Two rows per line: start, then end. Columns: lon lat alt row_Nr section_Nr
const row = (lon, lat, alt, seq, section) => `${lon} ${lat} ${alt} ${seq} ${section}`;
const lineRows = (seq, section = 1, alt = 500) => [
    row(19.0 + seq * 0.01, 47.0, alt, seq, section),
    row(19.0 + seq * 0.01, 47.1, alt, seq, section),
];

describe('parseTXT', () => {
    it('pairs rows sharing (section, row) into start/end lines', () => {
        const { lines, rowOrder, tolerances } = parseTXT([...lineRows(1), ...lineRows(2)].join('\n'));
        expect(lines).toHaveLength(2);
        expect(lines[0]).toEqual({
            seq: 1, section: 1,
            start: { lat: 47.0, lon: 19.01, alt: 500 },
            end: { lat: 47.1, lon: 19.01, alt: 500 },
        });
        expect(rowOrder).toBeNull();
        expect(tolerances).toBeNull();
    });

    it('handles CRLF line endings and skips # comments and blank lines', () => {
        const text = ['# header', '', ...lineRows(1), '  # indented comment'].join('\r\n');
        expect(parseTXT(text).lines).toHaveLength(1);
    });

    it('shifts a 0-based section by +1, leaves other sections alone', () => {
        const text = [...lineRows(0, 1), ...lineRows(1, 1), ...lineRows(3, 2), ...lineRows(4, 2)].join('\n');
        const seqs = parseTXT(text).lines.map(l => [l.section, l.seq]);
        expect(seqs).toEqual([[1, 1], [1, 2], [2, 3], [2, 4]]);
    });

    it('sorts by section then seq', () => {
        const text = [...lineRows(2, 2), ...lineRows(1, 2), ...lineRows(5, 1)].join('\n');
        expect(parseTXT(text).lines.map(l => [l.section, l.seq])).toEqual([[1, 5], [2, 1], [2, 2]]);
    });

    it('reads the row-order comment without shifting it', () => {
        // Data rows are 0-based (shifted to 1..3); the comment uses 1-based numbers as written
        const text = ['# 3 1 2 //Row Order', ...lineRows(0), ...lineRows(1), ...lineRows(2)].join('\n');
        expect(parseTXT(text).rowOrder).toEqual([3, 1, 2]);
    });

    it('throws when the row order names a row that does not exist', () => {
        // 0-based data: rows become 1..2, so row 0 in the comment is unknown
        const text = ['# 0 1 //row order', ...lineRows(0), ...lineRows(1)].join('\n');
        expect(() => parseTXT(text)).toThrow(/Row order references line 0/);
    });

    it('ignores the row-order comment in multi-section files', () => {
        const text = ['# 9 9 //row order', ...lineRows(1, 1), ...lineRows(1, 2)].join('\n');
        expect(parseTXT(text).rowOrder).toBeNull();
    });

    it('rejects rows with fewer than 5 columns', () => {
        expect(() => parseTXT('19 47 500 1')).toThrow(/expected at least 5/);
    });

    it('rejects non-numeric values', () => {
        expect(() => parseTXT('19 47 abc 1 1\n19 47 500 1 1')).toThrow(/non-numeric/);
    });

    it('rejects a row/section pair that does not appear exactly twice', () => {
        const text = [...lineRows(1), row(19, 47, 500, 1, 1)].join('\n');
        expect(() => parseTXT(text)).toThrow(/appears 3 time/);
        expect(() => parseTXT(row(19, 47, 500, 1, 1))).toThrow(/appears 1 time/);
    });
});

describe('parseTolerances', () => {
    it('maps horizontal/vertical/yaw green+yellow onto limits keys', () => {
        expect(parseTolerances([
            '#9.9 19.8 29.8 //tolerance: horizontal [m]',
            '#16.0 32.0 64.0 //tolerance: vertical [m]',
            '#5.0 10.0 20.0 //tolerance: tilt [deg]',
            '#15.0 25.0 35.0 0.0 //tolerance: yaw [deg] and system delay [ms]',
        ])).toEqual({
            green: 9.9, yellow: 19.8,
            vertical_green: 16, vertical_yellow: 32,
            heading_green: 15, heading_yellow: 25,
        });
    });

    it('skips malformed lines and returns null when none are valid', () => {
        expect(parseTolerances(['#9.9 //tolerance: horizontal', '#0 5 //tolerance: vertical'])).toBeNull();
    });
});

const vernova = 'public/kml/mis001-vernova.txt';
describe.skipIf(!existsSync(vernova))('parseTXT on the vernova sample', () => {
    it('parses 8 lines with row order 1 5 2 6 3 7 4 8 and mission tolerances', () => {
        const { lines, rowOrder, tolerances } = parseTXT(readFileSync(vernova, 'utf8'));
        expect(lines).toHaveLength(8);
        expect(lines.map(l => l.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(rowOrder).toEqual([1, 5, 2, 6, 3, 7, 4, 8]);
        expect(tolerances).toMatchObject({ green: 9.9, vertical_green: 16 });
    });
});
