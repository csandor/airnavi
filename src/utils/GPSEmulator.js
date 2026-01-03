import config from '../config';

/**
 * Simulates GPS movement along a path. 
 */
export class GPSEmulator {
    constructor() {
        this.intervalId = null;
        this.currentPos = { lat: 0, lon: 0, alt: 0, heading: 0, speed: 0 };
    }

    startSimulation(startPoint, endPoint, speedKnots = 100, onPositionUpdate) {
        this.stopSimulation();

        console.log("Starting Simulation", { startPoint, endPoint, speedKnots });

        // Linear interpolation logic
        const speedMps = speedKnots * 0.514444;
        const totalDistM = this.getDistance(startPoint, endPoint);
        const totalTimeS = totalDistM / speedMps;

        console.log(`Total Distance: ${totalDistM}m, Total Time: ${totalTimeS}s`);

        // Calculate constant bearing for the leg
        const bearing = this.getBearing(startPoint, endPoint);

        const updateIntervalMs = 1000;
        let elapsedS = 0;

        // Initial Update
        this.currentPos = {
            lat: startPoint.lat,
            lon: startPoint.lon,
            alt: startPoint.alt,
            heading: bearing,
            speed: speedMps
        };
        onPositionUpdate(this.currentPos);

        this.intervalId = setInterval(() => {
            elapsedS += updateIntervalMs / 1000;
            const progress = Math.min(elapsedS / totalTimeS, 1);

            const newLat = startPoint.lat + (endPoint.lat - startPoint.lat) * progress;
            const newLon = startPoint.lon + (endPoint.lon - startPoint.lon) * progress;
            const newAlt = startPoint.alt + (endPoint.alt - startPoint.alt) * progress;

            // Add some "noise"
            // Previous: 0.0001 (~10m). New: 0.0005 (~50m)
            const noiseLat = (Math.random() - 0.5) * config.simulation.jitter.lat;
            const noiseLon = (Math.random() - 0.5) * config.simulation.jitter.lon;
            // Previous: 5m. New: 20m
            const noiseAlt = (Math.random() - 0.5) * config.simulation.jitter.alt;
            // Heading Noise: +/- 5 degrees
            const noiseHeading = (Math.random() - 0.5) * config.simulation.jitter.heading;

            this.currentPos = {
                lat: newLat + noiseLat,
                lon: newLon + noiseLon,
                alt: newAlt + noiseAlt,
                heading: (bearing + noiseHeading + 360) % 360,
                speed: speedMps
            };

            onPositionUpdate(this.currentPos);

            if (progress >= 1) {
                console.log("Simulation Finished");
                this.stopSimulation();
            }
        }, updateIntervalMs);
    }

    stopSimulation() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // Simple distance for emulator internal use (reuse GeoUtils in real app)
    getDistance(p1, p2) {
        const R = 6371e3; // metres
        const φ1 = p1.lat * Math.PI / 180;
        const φ2 = p2.lat * Math.PI / 180;
        const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
        const Δλ = (p2.lon - p1.lon) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    getBearing(start, end) {
        const toRad = (deg) => deg * Math.PI / 180;
        const toDeg = (rad) => rad * 180 / Math.PI;

        const lat1 = toRad(start.lat);
        const lat2 = toRad(end.lat);
        const dLon = toRad(end.lon - start.lon);

        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

        const brng = toDeg(Math.atan2(y, x));
        return (brng + 360) % 360;
    }
}

export const gpsEmulator = new GPSEmulator();
