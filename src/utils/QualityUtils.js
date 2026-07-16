/**
 * Classifies flight-line tracking quality from cross-track and vertical deviation,
 * using the same "worst axis wins" rule as the HUD halo: green requires both axes
 * within their green limits, yellow requires both within their yellow limits,
 * anything else (either axis past yellow) is red.
 * @returns {'green'|'yellow'|'red'}
 */
export const classifyQuality = (crossTrackDist, altDiff, limits) => {
    const xt = Math.abs(crossTrackDist);
    const vt = Math.abs(altDiff);

    if (xt < limits.green && vt < limits.vertical_green) return 'green';
    if (xt < limits.yellow && vt < limits.vertical_yellow) return 'yellow';
    return 'red';
};

const QUALITY_RANK = { green: 0, yellow: 1, red: 2 };

/**
 * Returns the worse of two qualities (red > yellow > green).
 */
export const worseQuality = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    return QUALITY_RANK[a] >= QUALITY_RANK[b] ? a : b;
};
