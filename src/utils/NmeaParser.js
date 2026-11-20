// NMEA 0183 parser for external GNSS receivers (Garmin GLO 2, Emlid Reach M2).
//
// Only the sentences needed for navigation are read: GGA (position, MSL altitude,
// geoid separation, fix quality), RMC and VTG (ground speed and course). Any talker
// ID is accepted (GP, GN, GL, GA, GB, BD...). NmeaStream turns a raw text stream
// into one fix per epoch, shaped like App's gpsData.

const KNOTS_TO_MPS = 0.514444;

/** True when the sentence's '*hh' checksum matches the XOR of the characters between '$' and '*'. */
export const nmeaChecksumOk = (sentence) => {
    const m = /^\$([^*]+)\*([0-9A-Fa-f]{2})\s*$/.exec(sentence);
    if (!m) return false;
    let cs = 0;
    for (let i = 0; i < m[1].length; i++) cs ^= m[1].charCodeAt(i);
    return cs === parseInt(m[2], 16);
};

const num = (v) => (v === undefined || v === '' ? null : Number(v));

// ddmm.mmmm / dddmm.mmmm + hemisphere -> signed decimal degrees
const coord = (value, hemi, degDigits) => {
    if (!value) return null;
    const deg = Number(value.slice(0, degDigits));
    const min = Number(value.slice(degDigits));
    const d = deg + min / 60;
    return hemi === 'S' || hemi === 'W' ? -d : d;
};

/**
 * Parses one sentence. Returns {type: 'GGA'|'RMC'|'VTG', ...} or null when the
 * checksum is wrong, the type is not used, or the receiver reports no valid fix.
 */
export const parseNmeaSentence = (sentence) => {
    const line = sentence.trim();
    if (!nmeaChecksumOk(line)) return null;
    const f = line.slice(1, line.indexOf('*')).split(',');
    const type = f[0].slice(2);

    if (type === 'GGA') {
        const fixQuality = Number(f[6]);
        const lat = coord(f[2], f[3], 2);
        const lon = coord(f[4], f[5], 3);
        if (!fixQuality || lat === null || lon === null) return null;
        return {
            type, time: f[1], lat, lon, fixQuality,
            satellites: num(f[7]), hdop: num(f[8]),
            altMsl: num(f[9]), geoidSep: num(f[11]),
        };
    }
    if (type === 'RMC') {
        if (f[2] !== 'A') return null;
        const knots = num(f[7]);
        return { type, time: f[1], speed: knots === null ? null : knots * KNOTS_TO_MPS, course: num(f[8]) };
    }
    if (type === 'VTG') {
        const kmh = num(f[7]);
        const knots = num(f[5]);
        const speed = kmh !== null ? kmh / 3.6 : (knots !== null ? knots * KNOTS_TO_MPS : null);
        return { type, speed, course: num(f[1]) };
    }
    return null;
};

/**
 * Feeds raw NMEA text (any chunking) and calls onFix once per epoch with
 * {lat, lon, alt, altMsl, speed, heading, fixQuality, satellites, hdop, time}.
 * `alt` is WGS-84 ellipsoidal: GGA's MSL altitude plus its geoid separation, or plus
 * `fallbackUndulation` when the receiver leaves the separation empty.
 *
 * An epoch is the GGA and RMC sharing one UTC time (VTG has no time and joins the
 * current epoch). It is emitted as soon as it has both position and motion, or when
 * the next epoch starts / flush() is called. Speed and heading carry over from the
 * previous epoch when an epoch has no motion sentence.
 */
export class NmeaStream {
    constructor(onFix, { fallbackUndulation = 0 } = {}) {
        this.onFix = onFix;
        this.fallbackUndulation = fallbackUndulation;
        this.buffer = '';
        this.epoch = null;
        this.lastMotion = { speed: 0, course: 0 };
    }

    feed(text) {
        this.buffer += text;
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop();
        for (const line of lines) this.handle(parseNmeaSentence(line));
    }

    flush() {
        this.emit();
    }

    handle(msg) {
        if (!msg) return;
        if (msg.type === 'VTG') {
            if (this.epoch && !this.epoch.done) {
                this.epoch.motion = msg;
                if (this.epoch.gga) this.emit();
            }
            return;
        }
        if (!this.epoch || this.epoch.time !== msg.time) {
            this.emit();
            this.epoch = { time: msg.time, gga: null, motion: null, done: false };
        }
        if (this.epoch.done) return;
        if (msg.type === 'GGA') this.epoch.gga = msg;
        else this.epoch.motion = msg;
        if (this.epoch.gga && this.epoch.motion) this.emit();
    }

    emit() {
        const e = this.epoch;
        if (!e || e.done) return;
        if (e.motion) {
            this.lastMotion = {
                speed: e.motion.speed ?? this.lastMotion.speed,
                course: e.motion.course ?? this.lastMotion.course,
            };
        }
        if (!e.gga) return; // motion-only epoch: keep its speed/course for the next fix
        e.done = true;
        const g = e.gga;
        const sep = g.geoidSep ?? this.fallbackUndulation;
        this.onFix({
            lat: g.lat,
            lon: g.lon,
            alt: g.altMsl === null ? 0 : g.altMsl + sep,
            altMsl: g.altMsl,
            speed: this.lastMotion.speed,
            heading: this.lastMotion.course,
            fixQuality: g.fixQuality,
            satellites: g.satellites,
            hdop: g.hdop,
            time: g.time,
        });
    }
}
