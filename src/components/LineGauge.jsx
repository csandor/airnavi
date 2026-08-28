import React, { useRef, useEffect } from 'react';
import { calculateDistance, calculateAlongTrackDistance } from '../utils/GeoUtils';
import { QUALITY_COLORS } from '../utils/QualityUtils';

const EMPTY_COLOR = 'rgba(255, 255, 255, 0.15)';
const NOT_RECORDING_COLOR = 'rgba(80, 80, 80, 0.6)';

// Vertical gauge symbolizing the selected flight line: fills from the bottom as the
// aircraft progresses along-track, colored per-chunk by the same tracking quality
// ('green'/'yellow'/'red') used for the flown-track rendering on the maps.
const LineGauge = ({ currentLine, direction, gpsData, flightStatus, chunkQuality, qualitySegmentLength = 10, onClose }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const render = () => {
            const width = canvas.width = canvas.offsetWidth;
            const height = canvas.height = canvas.offsetHeight;

            ctx.clearRect(0, 0, width, height);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, width, height);

            if (!currentLine) return;

            const start = direction === 'normal' ? currentLine.start : currentLine.end;
            const end = direction === 'normal' ? currentLine.end : currentLine.start;
            const totalLen = calculateDistance(start.lat, start.lon, end.lat, end.lon) * 1000;
            if (totalLen <= 0) return;

            const hasAircraft = gpsData && gpsData.lat !== 0;
            const alongTrack = hasAircraft ? calculateAlongTrackDistance(gpsData, start, end) : 0;
            const progress = Math.max(0, Math.min(1, alongTrack / totalLen));

            // Empty (not-yet-flown) portion, top-down.
            ctx.fillStyle = EMPTY_COLOR;
            ctx.fillRect(0, 0, width, height);

            // Flown portion, bottom-up, one segment per quality chunk while recording.
            const flownHeight = height * progress;
            const flownTop = height - flownHeight;

            if (flightStatus === 'flying' && chunkQuality) {
                const numChunks = Math.ceil(totalLen / qualitySegmentLength);
                for (let c = 0; c < numChunks; c++) {
                    const chunkStart = c * qualitySegmentLength;
                    const chunkEnd = Math.min(chunkStart + qualitySegmentLength, totalLen);
                    if (chunkStart > alongTrack) break;

                    const segTop = height - (Math.min(chunkEnd, alongTrack) / totalLen) * height;
                    const segBottom = height - (chunkStart / totalLen) * height;
                    const quality = chunkQuality[c];
                    ctx.fillStyle = quality ? QUALITY_COLORS[quality] : NOT_RECORDING_COLOR;
                    ctx.fillRect(0, segTop, width, segBottom - segTop);
                }
            } else if (flownHeight > 0) {
                ctx.fillStyle = NOT_RECORDING_COLOR;
                ctx.fillRect(0, flownTop, width, flownHeight);
            }

            // Fill-line marker.
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, flownTop);
            ctx.lineTo(width, flownTop);
            ctx.stroke();
        };

        render();
        window.addEventListener('resize', render);
        return () => window.removeEventListener('resize', render);
    }, [currentLine, direction, gpsData, flightStatus, chunkQuality, qualitySegmentLength]);

    return (
        <div className="glass-panel" style={{ overflow: 'hidden', position: 'relative', width: '100%', height: '100%' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '4px', pointerEvents: 'auto' }}>
                {onClose && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        style={{
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
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.8)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(0, 0, 0, 0.6)'}
                        title="Close Line Gauge"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
};

export default LineGauge;
