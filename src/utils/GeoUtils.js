export const EARTH_RADIUS_KM = 6371;

/**
 * Converts degrees to radians.
 */
export const toRad = (value) => (value * Math.PI) / 180;

/**
 * Converts radians to degrees.
 */
export const toDeg = (value) => (value * 180) / Math.PI;

/**
 * Calculates the great-circle distance between two points in kilometers.
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
};

/**
 * Calculates the initial bearing from start point to end point.
 * Returns value in degrees [0, 360).
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
};

/**
 * Calculates cross-track distance (distance from point to the path defined by start and end).
 * Returns distance in meters. Positive means right of track, negative means left.
 */
export const calculateCrossTrackDistance = (point, lineStart, lineEnd) => {
    const d13 = calculateDistance(lineStart.lat, lineStart.lon, point.lat, point.lon);
    const theta13 = toRad(calculateBearing(lineStart.lat, lineStart.lon, point.lat, point.lon));
    const theta12 = toRad(calculateBearing(lineStart.lat, lineStart.lon, lineEnd.lat, lineEnd.lon));

    const dXt = Math.asin(Math.sin(d13 / EARTH_RADIUS_KM) * Math.sin(theta13 - theta12)) * EARTH_RADIUS_KM;
    return dXt * 1000; // Convert to meters
};

/**
 * Calculates distance along track (projected point on line).
 * Returns distance in meters from start point.
 */
export const calculateAlongTrackDistance = (point, lineStart, lineEnd) => {
    const d13 = calculateDistance(lineStart.lat, lineStart.lon, point.lat, point.lon);
    const theta13 = toRad(calculateBearing(lineStart.lat, lineStart.lon, point.lat, point.lon));
    const theta12 = toRad(calculateBearing(lineStart.lat, lineStart.lon, lineEnd.lat, lineEnd.lon));

    const dAt = Math.acos(Math.cos(d13 / EARTH_RADIUS_KM) / Math.cos(Math.asin(Math.sin(d13 / EARTH_RADIUS_KM) * Math.sin(theta13 - theta12)))) * EARTH_RADIUS_KM;

    // Simple projection logic approximation for short distances if above formula has issues with edge cases,
    // but cross-track / along-track usually follows standard navigation formulas.
    // Let's use simpler spherical trigonometry:
    // dAt = asin( sin(d13) * cos(theta13-theta12) ) * R (approx)
    // Precise: tan(dAt) = tan(d13) * cos(theta13 - theta12)

    // actually, simpler logic for short distances (planar approximation) might be enough, but let's stick to sphere.
    // Cross-track formula above is correct.
    // Along-track:
    const d12 = calculateDistance(lineStart.lat, lineStart.lon, lineEnd.lat, lineEnd.lon);

    // Project point to line
    // We can just take distance to start and use the angle.
    // Distance from start to point * cos(angle diff)
    const angleDiff = theta13 - theta12;
    const distToPoint = calculateDistance(lineStart.lat, lineStart.lon, point.lat, point.lon);
    return distToPoint * Math.cos(angleDiff) * 1000; // meters
};

/**
 * Calculates the destination point given a start point, bearing, and distance.
 * @param {number} lat - Start latitude (degrees)
 * @param {number} lon - Start longitude (degrees)
 * @param {number} bearingDeg - Bearing (degrees)
 * @param {number} distanceMeters - Distance to travel (meters)
 * @returns {{lat: number, lon: number}}
 */
export const destinationPoint = (lat, lon, bearingDeg, distanceMeters) => {
    const d = distanceMeters / 1000 / EARTH_RADIUS_KM;
    const brng = toRad(bearingDeg);
    const lat1 = toRad(lat);
    const lon1 = toRad(lon);

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
    );
    const lon2 = lon1 + Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

    return { lat: toDeg(lat2), lon: toDeg(lon2) };
};

/**
 * Calculates vertical deviation (altitude difference) expected at the projected point on the line.
 * Assumes linear altitude change between start and end.
 * @param {object} point - {lat, lon, alt} (alt in meters)
 * @param {object} lineStart - {lat, lon, alt}
 * @param {object} lineEnd - {lat, lon, alt}
 * @returns {number} - Altitude difference in meters (aircraft alt - line alt). Positive = above line.
 */
export const calculateVerticalDeviation = (point, lineStart, lineEnd) => {
    // 1. Calculate how far along the line we are (0 to 1)
    const totalDist = calculateDistance(lineStart.lat, lineStart.lon, lineEnd.lat, lineEnd.lon) * 1000; // meters
    const alongTrack = calculateAlongTrackDistance(point, lineStart, lineEnd);

    let progress = 0;
    if (totalDist > 0) {
        progress = alongTrack / totalDist;
    }

    // Clamp progress? Maybe not, if we are before start or after end.
    // The line "plane" extends infinitely for alignment, but usually we care about the segment.
    // Let's extrapolate.

    const expectedAlt = lineStart.alt + (lineEnd.alt - lineStart.alt) * progress;
    return point.alt - expectedAlt;
};
