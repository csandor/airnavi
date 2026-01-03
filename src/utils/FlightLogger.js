export class FlightLogger {
    constructor() {
        this.history = [];
        this.reset();
    }

    reset() {
        this.startTime = null;
        this.endTime = null;
        this.stats = {
            maxDistanceToLine: 0,
            maxAltDiff: 0,
            maxAttitudeDiff: 0,
            maxSpeed: 0,
            maxHeadingDiff: 0
        };
        // Do not clear history here
    }

    startFlight() {
        this.reset(); // Ensure clean state for new flight
        this.startTime = new Date();
    }

    updateStats(data) {
        if (!this.startTime) return; // Not started

        // data: { crossTrackDist, altDiff, speed, headingDiff }
        if (Math.abs(data.crossTrackDist) > this.stats.maxDistanceToLine) {
            this.stats.maxDistanceToLine = Math.abs(data.crossTrackDist);
        }
        if (Math.abs(data.altDiff) > this.stats.maxAltDiff) {
            this.stats.maxAltDiff = Math.abs(data.altDiff);
        }
        if (data.speed > this.stats.maxSpeed) {
            this.stats.maxSpeed = data.speed;
        }
        if (Math.abs(data.headingDiff) > this.stats.maxHeadingDiff) {
            this.stats.maxHeadingDiff = Math.abs(data.headingDiff);
        }
    }

    endFlight(lineId, completionPct = 100, direction = 'normal') {
        this.endTime = new Date();

        // Store session
        this.history.push({
            lineId: lineId,
            date: this.startTime ? this.startTime.toLocaleDateString() : 'N/A',
            startTime: this.startTime ? this.startTime.toLocaleTimeString() : 'N/A',
            endTime: this.endTime.toLocaleTimeString(),
            duration: (this.endTime - this.startTime) / 1000,
            completionPct: completionPct.toFixed(1),
            direction: direction === 'normal' ? 'Forward' : 'Backward',
            stats: { ...this.stats }
        });
    }

    getLastSession() {
        if (this.history.length === 0) return null;
        return this.history[this.history.length - 1];
    }

    deleteLastSession() {
        if (this.history.length > 0) {
            this.history.pop();
        }
    }

    downloadCSV() {
        if (this.history.length === 0) {
            alert("No flight logs to download.");
            return;
        }

        const headers = ["Line ID", "Date", "Start Time", "End Time", "Duration (s)", "Direction", "Completion (%)", "Max X-Track (m)", "Max Alt Diff (m)", "Max Speed (km/h)", "Max Hdg Diff (deg)"];
        const rows = this.history.map(session => [
            session.lineId,
            session.date,
            session.startTime,
            session.endTime,
            session.duration.toFixed(1),
            session.direction,
            session.completionPct,
            session.stats.maxDistanceToLine.toFixed(1),
            session.stats.maxAltDiff.toFixed(1),
            (session.stats.maxSpeed * 3.6).toFixed(1),
            session.stats.maxHeadingDiff.toFixed(1)
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flight_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const flightLogger = new FlightLogger();
