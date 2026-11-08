// Needle deflection scale for the ILS-style instrument (see VisualNav.jsx).
//
// Each axis is scaled by its own quality limits so the dots mean the same thing on
// both needles: 1 dot = green limit, 2 dots = yellow limit (linear up to there),
// then an exponential approach to MAX_DOTS so large errors stay on the dial
// while still moving the needle. Returns signed dots (sign follows `deviation`).

export const MAX_DOTS = 2.8;

export const deviationToDots = (deviation, greenLimit, yellowLimit) => {
    if (!Number.isFinite(deviation) || !(greenLimit > 0)) return 0;
    const yellow = yellowLimit > greenLimit ? yellowLimit : greenLimit * 2;
    const abs = Math.abs(deviation);
    let dots;
    if (abs <= greenLimit) {
        dots = abs / greenLimit;
    } else if (abs <= yellow) {
        dots = 1 + (abs - greenLimit) / (yellow - greenLimit);
    } else {
        dots = 2 + (MAX_DOTS - 2) * (1 - Math.exp(-(abs - yellow) / yellow));
    }
    return Math.sign(deviation) * dots;
};

// Per-axis quality, matching classifyQuality's thresholds for a single axis.
export const axisQuality = (deviation, greenLimit, yellowLimit) => {
    const abs = Math.abs(deviation);
    if (abs < greenLimit) return 'green';
    if (abs < yellowLimit) return 'yellow';
    return 'red';
};
