import React, { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { calculateDistance, calculateAlongTrackDistance } from '../utils/GeoUtils';
import { QUALITY_COLORS } from '../utils/QualityUtils';
import { fitMercatorView } from '../utils/MiniMapProjection';

// MapLibre is heavy: load the OSM basemap lazily, in its own chunk.
const MiniMapBasemap = lazy(() => import('./MiniMapBasemap'));

const DEFAULT_PATH_COLOR = 'rgba(255, 200, 0, 0.6)';

const MiniMap = ({ currentLine, gpsData, direction, className, flightStatus, chunkQuality, qualitySegmentLength = 10 }) => {
    const canvasRef = useRef(null);
    const [path, setPath] = useState([]);
    const [basemapView, setBasemapView] = useState(null);
    const [basemapReady, setBasemapReady] = useState(false);

    // Update path history
    useEffect(() => {
        if (!gpsData || gpsData.lat === 0) return;
        setPath(prev => {
            // Only add point if it moved a bit to save memory?
            // For now, just simplistic
            const last = prev[prev.length - 1];
            if (last) {
                const d = calculateDistance(last.lat, last.lon, gpsData.lat, gpsData.lon);
                if (d < 0.005) return prev; // < 5 meters, ignore
            }
            return [...prev, { lat: gpsData.lat, lon: gpsData.lon }];
        });
    }, [gpsData]);

    // Clear path on line change
    useEffect(() => {
        setPath([]);
    }, [currentLine]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const render = () => {
            const width = canvas.width = canvas.offsetWidth;
            const height = canvas.height = canvas.offsetHeight;

            ctx.clearRect(0, 0, width, height);

            // Over the OSM basemap only a light dimming (keeps the overlay readable on the
            // light map style); without it, the old dark panel background.
            ctx.fillStyle = basemapReady ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, width, height);

            if (!currentLine) return;

            const start = direction === 'normal' ? currentLine.start : currentLine.end;
            const end = direction === 'normal' ? currentLine.end : currentLine.start;

            // Uniform Web Mercator fit of the line (and aircraft) — same projection as the basemap
            const fitPoints = [start, end, ...(gpsData.lat !== 0 ? [gpsData] : [])];
            const { toX, toY, view } = fitMercatorView(fitPoints, width, height);
            setBasemapView(prev => (prev && prev.lon === view.lon && prev.lat === view.lat && prev.zoom === view.zoom) ? prev : view);

            // Draw Flight Line
            ctx.strokeStyle = basemapReady ? '#00e5ff' : 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(toX(start.lon), toY(start.lat));
            ctx.lineTo(toX(end.lon), toY(end.lat));
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Start Point
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(toX(start.lon), toY(start.lat), 4, 0, Math.PI * 2);
            ctx.fill();

            // Draw End Point
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(toX(end.lon), toY(end.lat), 4, 0, Math.PI * 2);
            ctx.fill();

            // Draw Path History — colored by tracking quality while recording, same as the full-screen map.
            if (path.length > 1) {
                ctx.lineWidth = 2;
                if (flightStatus === 'flying' && chunkQuality) {
                    for (let i = 1; i < path.length; i++) {
                        const alongTrack = calculateAlongTrackDistance(path[i], start, end);
                        const chunk = Math.floor(alongTrack / qualitySegmentLength);
                        const quality = chunkQuality[chunk];
                        ctx.strokeStyle = quality ? QUALITY_COLORS[quality] : DEFAULT_PATH_COLOR;
                        ctx.beginPath();
                        ctx.moveTo(toX(path[i - 1].lon), toY(path[i - 1].lat));
                        ctx.lineTo(toX(path[i].lon), toY(path[i].lat));
                        ctx.stroke();
                    }
                } else {
                    ctx.strokeStyle = DEFAULT_PATH_COLOR;
                    ctx.beginPath();
                    ctx.moveTo(toX(path[0].lon), toY(path[0].lat));
                    for (let i = 1; i < path.length; i++) {
                        ctx.lineTo(toX(path[i].lon), toY(path[i].lat));
                    }
                    ctx.stroke();
                }
            }

            // Draw Aircraft
            if (gpsData.lat !== 0) {
                const ax = toX(gpsData.lon);
                const ay = toY(gpsData.lat);

                ctx.save();
                ctx.translate(ax, ay);
                // Rotate canvas to heading?
                // Heading 0 = North (Up)
                // Canvas 0 = Right? No, usually up is -Y.
                // Standard math: 0 = East.
                // GPS Heading: 0 = North, 90 = East.
                // Context rotation is clockwise radians.
                // 0 deg heading -> points Up (-Y). 
                // We want to draw a triangle pointing up.

                ctx.rotate((gpsData.heading * Math.PI) / 180);

                ctx.fillStyle = '#00ccff';
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(6, 8);
                ctx.lineTo(0, 5);
                ctx.lineTo(-6, 8);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }

            if (basemapReady) {
                // OSM attribution (the basemap's own control is off at this size)
                ctx.font = '9px Arial';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillText('© OpenStreetMap', width - 3, height - 2);
            }
        };

        render();
        window.addEventListener('resize', render);
        return () => window.removeEventListener('resize', render);
    }, [currentLine, gpsData, path, direction, flightStatus, chunkQuality, qualitySegmentLength, basemapReady]);

    return (
        <div className={className || ''} style={{ overflow: 'hidden', position: 'relative', width: '100%', height: '100%' }}>
            <Suspense fallback={null}>
                <MiniMapBasemap view={basemapView} onReady={setBasemapReady} />
            </Suspense>
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        </div>
    );
};

export default MiniMap;
