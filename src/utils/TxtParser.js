/**
 * Parses fixed-width flight-line TXT files (e.g. Vernova survey mission format).
 *
 * Format: comment lines starting with "#" (header metadata), followed by data
 * rows of whitespace-separated columns: lon lat alt row_Nr section_Nr
 * - `row_Nr` (4th column) pairs with another row sharing the same row_Nr AND
 *   section_Nr to form one flight line's start/end points; row_Nr also serves
 *   as the line's sequence number.
 * - `section_Nr` (5th column) groups lines into flight sections.
 * - Altitudes in this format are already ellipsoidal (WGS-84), unlike KML
 *   altitudes which are MSL, so no geoid undulation correction is applied.
 *
 * @param {string} txtText - The raw TXT file content.
 * @returns {Array<{seq: number, section: number, start: {lat: number, lon: number, alt: number}, end: {lat: number, lon: number, alt: number}}>}
 */
export const parseTXT = (txtText) => {
    const dataLines = txtText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#'));

    const groups = new Map(); // key: `${section}:${seq}` -> [point, point]

    dataLines.forEach((line, idx) => {
        const cols = line.split(/\s+/);
        if (cols.length < 5) {
            throw new Error(`Row ${idx + 1} has ${cols.length} columns; expected at least 5 (lon lat alt seq section).`);
        }

        const lon = parseFloat(cols[0]);
        const lat = parseFloat(cols[1]);
        const alt = parseFloat(cols[2]);
        const seq = parseInt(cols[3], 10);
        const section = parseInt(cols[4], 10);

        if ([lon, lat, alt].some(Number.isNaN) || Number.isNaN(seq) || Number.isNaN(section)) {
            throw new Error(`Row ${idx + 1} has a non-numeric value: "${line}"`);
        }

        const key = `${section}:${seq}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ lat, lon, alt });
    });

    const lines = [];
    for (const [key, points] of groups) {
        if (points.length !== 2) {
            throw new Error(`Row/section pair ${key} appears ${points.length} time(s); expected exactly 2 (start and end).`);
        }
        const [section, seq] = key.split(':').map(Number);
        lines.push({ seq, section, start: points[0], end: points[1] });
    }

    // Sections numbered from 0 are shifted to start from 1; sections starting
    // at any other number are left as-is (they already use the file's own numbering).
    const minSeqBySection = new Map();
    lines.forEach(l => {
        const min = minSeqBySection.get(l.section);
        if (min === undefined || l.seq < min) minSeqBySection.set(l.section, l.seq);
    });
    lines.forEach(l => {
        if (minSeqBySection.get(l.section) === 0) l.seq += 1;
    });

    return lines.sort((a, b) => a.section - b.section || a.seq - b.seq);
};
