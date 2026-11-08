// GPS altitude datum handling.
//
// The app compares GPS altitude against ellipsoidal (WGS-84) line altitudes.
// The W3C Geolocation spec says coords.altitude is ellipsoidal, and Android
// browsers follow that, but iOS/iPadOS WebKit passes through CoreLocation's
// CLLocation.altitude, which is height above mean sea level. On those devices
// the raw value reads about one geoid undulation (~43 m in Hungary) too low.

export const GPS_ALTITUDE_DATUMS = ['auto', 'ellipsoidal', 'msl'];

// iPadOS 13+ reports a desktop Mac user agent, so a touch-capable "Mac" is an iPad.
export const isAppleMobileDevice = (nav = globalThis.navigator) => {
    if (!nav) return false;
    const ua = nav.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return /Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1;
};

// Resolves the 'auto' setting to the datum this device's browser actually reports.
export const resolveGpsAltitudeDatum = (setting, nav = globalThis.navigator) => {
    if (setting === 'ellipsoidal' || setting === 'msl') return setting;
    return isAppleMobileDevice(nav) ? 'msl' : 'ellipsoidal';
};

// Converts a raw coords.altitude to ellipsoidal height. A missing altitude
// (null) stays 0 rather than becoming the bare undulation.
export const toEllipsoidalAltitude = (altitude, datum, undulation) => {
    if (altitude == null) return 0;
    return datum === 'msl' ? altitude + undulation : altitude;
};
