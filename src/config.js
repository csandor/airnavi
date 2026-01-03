const config = {
    // Flight Logic
    completionThreshold: 98, // Percentage required to mark flight as "Success"

    // Data Source
    kmlFilePath: '/lines.kml',

    // UI / UX
    summaryAutoCloseSeconds: 10,
    summaryDialogTimeoutMs: 10000, // Derived, or just use seconds * 1000

    // Simulation Settings
    simulation: {
        speedKnots: 500,
        preStartDistanceFactor: 0.05, // Start 5% before the actual start point
        jitter: {
            lat: 0.001, // ~10-50m
            lon: 0.001,
            alt: 40,     // +/- 20m
            heading: 20  // +/- 5 degrees (range of 10)
        }
    },

    // Limits for Halo Colors (meters)
    limits: {
        green: 20,   // Within this cross-track error -> Green Halo & Completes Line
        yellow: 50   // Within this -> Yellow Halo. Above -> Red.
    }
};

export default config;
