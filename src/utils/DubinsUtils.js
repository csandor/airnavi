import { toRad, toDeg, EARTH_RADIUS_KM } from './GeoUtils';

// Converts a lat/lon point to local flat-earth XY meters (equirectangular),
// centered on `origin`. X = east, Y = north.
export const latLonToLocalXY = (origin, point) => {
    const originLatRad = toRad(origin.lat);
    const metersPerDegLat = (Math.PI / 180) * EARTH_RADIUS_KM * 1000;
    const metersPerDegLon = metersPerDegLat * Math.cos(originLatRad);
    return {
        x: (point.lon - origin.lon) * metersPerDegLon,
        y: (point.lat - origin.lat) * metersPerDegLat
    };
};

// Inverse of latLonToLocalXY.
export const localXYToLatLon = (origin, x, y) => {
    const originLatRad = toRad(origin.lat);
    const metersPerDegLat = (Math.PI / 180) * EARTH_RADIUS_KM * 1000;
    const metersPerDegLon = metersPerDegLat * Math.cos(originLatRad);
    return {
        lat: origin.lat + y / metersPerDegLat,
        lon: origin.lon + x / metersPerDegLon
    };
};

// Local convention: headings are compass degrees (0 = north, 90 = east),
// converted to standard math radians (0 = east, CCW positive) for the solver.
const headingToMathRad = (headingDeg) => toRad(90 - headingDeg);
const mathRadToHeading = (rad) => (90 - toDeg(rad) + 360) % 360;

const mod2pi = (theta) => {
    let t = theta % (2 * Math.PI);
    if (t < 0) t += 2 * Math.PI;
    return t;
};

// Classic Dubins path primitives, operating in a normalized frame where the
// start is at the origin facing angle 0 and the end is at distance d away.
// Returns { t, p, q, length } for each word, or null if not achievable.
const dubinsLSL = (alpha, beta, d) => {
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const pSq = 2 + d * d - 2 * Math.cos(alpha - beta) + 2 * d * (sa - sb);
    if (pSq < 0) return null;
    const tmp = Math.atan2(cb - ca, d + sa - sb);
    const t = mod2pi(-alpha + tmp);
    const p = Math.sqrt(pSq);
    const q = mod2pi(beta - tmp);
    return { t, p, q, length: t + p + q, types: ['L', 'S', 'L'] };
};

const dubinsRSR = (alpha, beta, d) => {
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const pSq = 2 + d * d - 2 * Math.cos(alpha - beta) + 2 * d * (sb - sa);
    if (pSq < 0) return null;
    const tmp = Math.atan2(ca - cb, d - sa + sb);
    const t = mod2pi(alpha - tmp);
    const p = Math.sqrt(pSq);
    const q = mod2pi(-beta + tmp);
    return { t, p, q, length: t + p + q, types: ['R', 'S', 'R'] };
};

const dubinsLSR = (alpha, beta, d) => {
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const pSq = -2 + d * d + 2 * Math.cos(alpha - beta) + 2 * d * (sa + sb);
    if (pSq < 0) return null;
    const p = Math.sqrt(pSq);
    const tmp = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p);
    const t = mod2pi(-alpha + tmp);
    const q = mod2pi(-mod2pi(beta) + tmp);
    return { t, p, q, length: t + p + q, types: ['L', 'S', 'R'] };
};

const dubinsRSL = (alpha, beta, d) => {
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const pSq = d * d - 2 + 2 * Math.cos(alpha - beta) - 2 * d * (sa + sb);
    if (pSq < 0) return null;
    const p = Math.sqrt(pSq);
    const tmp = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p);
    const t = mod2pi(alpha - tmp);
    const q = mod2pi(beta - tmp);
    return { t, p, q, length: t + p + q, types: ['R', 'S', 'L'] };
};

const dubinsRLR = (alpha, beta, d) => {
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const tmp = (6 - d * d + 2 * Math.cos(alpha - beta) + 2 * d * (sa - sb)) / 8;
    if (Math.abs(tmp) > 1) return null;
    const p = mod2pi(2 * Math.PI - Math.acos(tmp));
    const t = mod2pi(alpha - Math.atan2(ca - cb, d - sa + sb) + p / 2);
    const q = mod2pi(alpha - beta - t + p);
    return { t, p, q, length: t + p + q, types: ['R', 'L', 'R'] };
};

const dubinsLRL = (alpha, beta, d) => {
    const ca = Math.cos(alpha), sa = Math.sin(alpha);
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const tmp = (6 - d * d + 2 * Math.cos(alpha - beta) + 2 * d * (sb - sa)) / 8;
    if (Math.abs(tmp) > 1) return null;
    const p = mod2pi(2 * Math.PI - Math.acos(tmp));
    const t = mod2pi(-alpha + Math.atan2(-ca + cb, d + sa - sb) + p / 2);
    const q = mod2pi(beta - alpha - t + p);
    return { t, p, q, length: t + p + q, types: ['L', 'R', 'L'] };
};

const DUBINS_WORDS = [dubinsLSL, dubinsRSR, dubinsLSR, dubinsRSL, dubinsRLR, dubinsLRL];

// Samples a point on a unit-radius arc/segment given the segment type, start
// pose (x, y, heading in math radians), and traveled parameter (radians for
// turns, normalized distance for straight segments).
const advance = (pose, type, param) => {
    let { x, y, theta } = pose;
    if (type === 'S') {
        return { x: x + Math.cos(theta) * param, y: y + Math.sin(theta) * param, theta };
    }
    const sign = type === 'L' ? 1 : -1;
    const newTheta = theta + sign * param;
    const cx = x - sign * Math.sin(theta);
    const cy = y + sign * Math.cos(theta);
    return {
        x: cx + sign * Math.sin(newTheta),
        y: cy - sign * Math.cos(newTheta),
        theta: newTheta
    };
};

const SAMPLE_STEP_RAD = toRad(5); // ~5 degree arc sampling step

const samplePath = (word, startPose) => {
    const segments = [
        { type: word.types[0], length: word.t },
        { type: word.types[1], length: word.p },
        { type: word.types[2], length: word.q }
    ];
    const points = [{ x: startPose.x, y: startPose.y }];
    let pose = { ...startPose };
    for (const seg of segments) {
        const step = seg.type === 'S' ? seg.length : SAMPLE_STEP_RAD;
        const steps = Math.max(1, Math.ceil(seg.length / step));
        const actualStep = seg.length / steps;
        for (let i = 0; i < steps; i++) {
            pose = advance(pose, seg.type, actualStep);
            points.push({ x: pose.x, y: pose.y });
        }
    }
    return points;
};

/**
 * Computes the shortest Dubins path between two poses in a planar XY frame.
 * @param {{x:number, y:number, heading:number}} start - heading in compass degrees
 * @param {{x:number, y:number, heading:number}} end - heading in compass degrees
 * @param {number} minRadius - minimum turn radius (meters)
 * @returns {{points: Array<{x:number,y:number}>, length: number} | null}
 */
export const computeDubinsPath = (start, end, minRadius) => {
    if (!minRadius || minRadius <= 0) return null;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) / minRadius;
    if (!isFinite(dist)) return null;

    const startTheta = headingToMathRad(start.heading);
    const endTheta = headingToMathRad(end.heading);
    const chordAngle = Math.atan2(dy, dx);
    const alpha = mod2pi(startTheta - chordAngle);
    const beta = mod2pi(endTheta - chordAngle);

    let best = null;
    for (const wordFn of DUBINS_WORDS) {
        const candidate = wordFn(alpha, beta, dist);
        if (candidate && (!best || candidate.length < best.length)) {
            best = candidate;
        }
    }
    if (!best) return null;

    const normalizedPoints = samplePath(best, { x: 0, y: 0, theta: startTheta });

    // Scale back from normalized (radius = 1) frame and translate to world origin.
    const points = normalizedPoints.map(p => ({
        x: start.x + p.x * minRadius,
        y: start.y + p.y * minRadius
    }));

    return { points, length: best.length * minRadius };
};

/**
 * Plans a Dubins path in lat/lon space from the aircraft's current pose to a
 * target pose (e.g. the flight line's approach point), using a local flat-earth
 * projection centered on the aircraft position.
 * @param {{lat:number, lon:number, heading:number}} aircraft
 * @param {{lat:number, lon:number, heading:number}} target
 * @param {number} minRadius - minimum turn radius (meters)
 * @returns {{points: Array<{lat:number, lon:number}>, length: number} | null}
 */
export const planDubinsPath = (aircraft, target, minRadius) => {
    if (!aircraft || !target) return null;
    if (aircraft.lat === target.lat && aircraft.lon === target.lon) return null;

    const origin = { lat: aircraft.lat, lon: aircraft.lon };
    const startXY = { x: 0, y: 0, heading: aircraft.heading };
    const targetLocal = latLonToLocalXY(origin, target);
    const endXY = { x: targetLocal.x, y: targetLocal.y, heading: target.heading };

    const result = computeDubinsPath(startXY, endXY, minRadius);
    if (!result) return null;

    return {
        points: result.points.map(p => localXYToLatLon(origin, p.x, p.y)),
        length: result.length
    };
};
