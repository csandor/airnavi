// GPS position sources. Each start* function calls onFix with App's gpsData shape
// ({lat, lon, alt (WGS-84 ellipsoidal), speed (m/s), heading (deg), ...}) and returns
// a stop function. The simulator (GPSEmulator.js) is the third source.
import { NmeaStream } from './NmeaParser';
import { toEllipsoidalAltitude } from './AltitudeDatum';

/** The device/browser GPS via navigator.geolocation.watchPosition. */
export const startBrowserGps = ({ datum, undulation }, onFix, onError = (e) => console.warn(e)) => {
    const watchId = navigator.geolocation.watchPosition((pos) => {
        onFix({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            alt: toEllipsoidalAltitude(pos.coords.altitude, datum, undulation),
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || 0,
            source: 'device',
        });
    }, onError, {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
};

// "hhmmss.ss" -> seconds since midnight
const utcSeconds = (t) => {
    if (!t || t.length < 6) return null;
    return Number(t.slice(0, 2)) * 3600 + Number(t.slice(2, 4)) * 60 + Number(t.slice(4));
};

/**
 * Parses a recorded NMEA log into fixes with their playback offset (ms from the first
 * fix), taken from the GGA UTC times; midnight rollover is handled. Fixes without a
 * usable time are spaced 1 s apart.
 */
export const nmeaLogToTimedFixes = (text, { fallbackUndulation = 0 } = {}) => {
    const fixes = [];
    const stream = new NmeaStream(f => fixes.push(f), { fallbackUndulation });
    stream.feed(text.endsWith('\n') ? text : text + '\n');
    stream.flush();

    const out = [];
    let first = null;
    let prev = null;
    let dayOffset = 0;
    fixes.forEach((fix) => {
        let t = utcSeconds(fix.time);
        if (t === null) t = prev === null ? 0 : prev + 1;
        else t += dayOffset;
        if (prev !== null && t < prev - 43200) { dayOffset += 86400; t += 86400; }
        if (first === null) first = t;
        prev = t;
        out.push({ fix: { ...fix, source: 'nmea' }, offsetMs: Math.round((t - first) * 1000) });
    });
    return out;
};

/** Replays a recorded NMEA log in real time (or `speedup`× faster). Calls onEnd when done. */
export const startNmeaReplay = (text, onFix, { fallbackUndulation = 0, speedup = 1, onEnd } = {}) => {
    const timed = nmeaLogToTimedFixes(text, { fallbackUndulation });
    const timers = timed.map(({ fix, offsetMs }) => setTimeout(() => onFix(fix), offsetMs / speedup));
    const last = timed.length ? timed[timed.length - 1].offsetMs / speedup : 0;
    const endTimer = setTimeout(() => onEnd?.(timed.length), last + 1);
    return () => { timers.forEach(clearTimeout); clearTimeout(endTimer); };
};

/**
 * Rolling fix-rate meter: tick() on every fix, hz() averages the intervals of the
 * fixes received in the last `windowMs`.
 */
export class FixRateMeter {
    constructor(windowMs = 3000) {
        this.windowMs = windowMs;
        this.times = [];
    }

    tick(now = Date.now()) {
        this.times.push(now);
        while (this.times.length && now - this.times[0] > this.windowMs) this.times.shift();
    }

    hz(now = Date.now()) {
        const recent = this.times.filter(t => now - t <= this.windowMs);
        if (recent.length < 2) return 0;
        return (recent.length - 1) / ((recent[recent.length - 1] - recent[0]) / 1000);
    }
}

/** Human-readable GGA fix quality. */
export const FIX_QUALITY_LABELS = { 1: 'GPS', 2: 'DGPS', 4: 'RTK fixed', 5: 'RTK float', 6: 'DR' };
