const config = {
    // Flight Logic
    completionThreshold: 98, // Percentage required to mark flight as "Success"

    // Data Source
    kmlFilePath: './lines.kml',

    // UI / UX
    summaryAutoCloseSeconds: 10,
    summaryDialogTimeoutMs: 10000, // Derived, or just use seconds * 1000

    // Simulation Settings
    simulation: {
        speedKnots: 500,
        preStartDistanceFactor: 0.05, // Start 5% before the actual start point
        jitter: {
            horizontalMeters: 10, // Max +/- deviation in meters
            alt: 40,               // +/- 20m
            heading: 20            // +/- 10 degrees
        }
    },

    // Limits for Halo Colors (meters)
    limits: {
        green: 5,   // Within this cross-track error -> Green Halo & Completes Line
        yellow: 10   // Within this -> Yellow Halo. Above -> Red.
    }
};

export default config;
