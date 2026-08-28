import { unzipSync, strFromU8 } from 'fflate';
import { parseTXT } from './TxtParser';

// Matches "mis###.txt" (any path prefix), case-insensitive — deliberately excludes
// "mis###_photo_coords.txt" and any "mis###.kml" sibling, since the trailing
// "\.txt$" anchor requires nothing but the extension right after the 3 digits.
const MISSION_FILE_RE = /(?:^|\/)mis(\d{3})\.txt$/i;

/**
 * Parses a zip archive containing one single-section mis###.txt file per flight
 * section (e.g. a Vernova multi-section survey export). Each file's 3-digit
 * filename number becomes its section number; every mis###.txt is parsed with
 * the existing single-section TxtParser and merged into one multi-section mission.
 *
 * @param {ArrayBuffer} zipBuffer
 * @returns {{lines: Array, rowOrders: Record<number, number[]>}}
 */
export const parseZipMission = (zipBuffer) => {
    const entries = unzipSync(new Uint8Array(zipBuffer));

    const missionFiles = Object.keys(entries)
        .map(path => ({ path, match: path.match(MISSION_FILE_RE) }))
        .filter(({ match }) => match)
        .map(({ path, match }) => ({ path, section: parseInt(match[1], 10) }));

    if (missionFiles.length === 0) {
        throw new Error('No mis###.txt mission files found in the zip.');
    }

    const lines = [];
    const rowOrders = {};

    for (const { path, section } of missionFiles) {
        const content = strFromU8(entries[path]);
        let parsed;
        try {
            parsed = parseTXT(content);
        } catch (e) {
            throw new Error(`${path}: ${e.message}`);
        }

        parsed.lines.forEach(l => lines.push({ ...l, section }));
        if (parsed.rowOrder) rowOrders[section] = parsed.rowOrder;
    }

    lines.sort((a, b) => a.section - b.section || a.seq - b.seq);

    return { lines, rowOrders };
};
