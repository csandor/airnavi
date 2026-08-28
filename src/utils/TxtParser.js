// A header comment line declaring custom row order, e.g. "# 3 1 4 2 //row order".
// Only meaningful for single-section files — see parseTXT.
const ROW_ORDER_RE = /^#\s*(.+?)\s*\/\/\s*row order\s*$/i;

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
 * - A single-section file may declare a custom row order via a header comment
 *   line of the form "# <space-delimited seq list> //row order" — this defines
 *   both display and auto-advance order for that section (see App.jsx).
 *
 * @param {string} txtText - The raw TXT file content.
 * @returns {{lines: Array<{seq: number, section: number, start: {lat: number, lon: number, alt: number}, end: {lat: number, lon: number, alt: number}}>, rowOrder: number[] | null}}
 */
export const parseTXT = (txtText) => {
    const allLines = txtText.split(/\r?\n/).map(l => l.trim());

    let rowOrderRaw = null;
    allLines.forEach(l => {
        const match = l.match(ROW_ORDER_RE);
        if (match) rowOrderRaw = match[1].split(/\s+/).map(Number);
    });

    const dataLines = allLines.filter(l => l.length > 0 && !l.startsWith('#'));

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
    // The row-order comment is left as originally written — mission files have been
    // observed to reference row numbers inconsistently with the 0-based data rows,
    // so shifting it would silently "fix" something that isn't actually broken.
    const minSeqBySection = new Map();
    lines.forEach(l => {
        const min = minSeqBySection.get(l.section);
        if (min === undefined || l.seq < min) minSeqBySection.set(l.section, l.seq);
    });
    lines.forEach(l => {
        if (minSeqBySection.get(l.section) === 0) l.seq += 1;
    });

    lines.sort((a, b) => a.section - b.section || a.seq - b.seq);

    // The row-order comment only applies to single-section files — with more than
    // one section it's ambiguous which section it describes, so it's ignored.
    const sectionCount = new Set(lines.map(l => l.section)).size;
    let rowOrder = null;
    if (rowOrderRaw && sectionCount === 1) {
        rowOrder = rowOrderRaw;

        const knownSeqs = new Set(lines.map(l => l.seq));
        rowOrder.forEach(seq => {
            if (!knownSeqs.has(seq)) {
                throw new Error(`Row order references line ${seq}, which does not exist in the file.`);
            }
        });
    }

    return { lines, rowOrder };
};
