import React, { useRef, useEffect, useState } from 'react';
import { calculateDistance, calculateBearing } from '../utils/GeoUtils';

const MiniMap = ({ currentLine, gpsData, direction, className, onClose }) => {
    const canvasRef = useRef(null);
    const [path, setPath] = useState([]);

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

            // Draw background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, width, height);

            if (!currentLine) return;

            // Define bounds
            const start = direction === 'normal' ? currentLine.start : currentLine.end;
            const end = direction === 'normal' ? currentLine.end : currentLine.start;

            let minLat = Math.min(start.lat, end.lat);
            let maxLat = Math.max(start.lat, end.lat);
            let minLon = Math.min(start.lon, end.lon);
            let maxLon = Math.max(start.lon, end.lon);

            // Include aircraft position in bounds
            if (gpsData.lat !== 0) {
                minLat = Math.min(minLat, gpsData.lat);
                maxLat = Math.max(maxLat, gpsData.lat);
                minLon = Math.min(minLon, gpsData.lon);
                maxLon = Math.max(maxLon, gpsData.lon);
            }

            // Include path history
            path.forEach(p => {
                minLat = Math.min(minLat, p.lat);
                maxLat = Math.max(maxLat, p.lat);
                minLon = Math.min(minLon, p.lon);
                maxLon = Math.max(maxLon, p.lon);
            });

            // Add padding (10%)
            const latRange = maxLat - minLat || 0.01;
            const lonRange = maxLon - minLon || 0.01;
            const paddingLat = latRange * 0.1;
            const paddingLon = lonRange * 0.1;

            minLat -= paddingLat;
            maxLat += paddingLat;
            minLon -= paddingLon;
            maxLon += paddingLon;

            // Transform Function
            const toX = (lon) => {
                return ((lon - minLon) / (maxLon - minLon)) * width;
            };
            const toY = (lat) => {
                // Lat increases upwards, but canvas Y increases downwards
                return height - ((lat - minLat) / (maxLat - minLat)) * height;
            };

            // Draw Flight Line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
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

            // Draw Path History
            if (path.length > 1) {
                ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(toX(path[0].lon), toY(path[0].lat));
                for (let i = 1; i < path.length; i++) {
                    ctx.lineTo(toX(path[i].lon), toY(path[i].lat));
                }
                ctx.stroke();
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
        };

        render();
        window.addEventListener('resize', render);
        return () => window.removeEventListener('resize', render);
    }, [currentLine, gpsData, path, direction]);

    return (
        <div className={`glass-panel ${className || ''}`} style={{ overflow: 'hidden', position: 'relative' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
            {onClose && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        border: 'none',
                        background: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        lineHeight: '1',
                        padding: 0,
                        pointerEvents: 'auto',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.8)'}
                    onMouseLeave={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.6)'}
                    title="Close MiniMap"
                >
                    ×
                </button>
            )}
        </div>
    );
};

export default MiniMap;
