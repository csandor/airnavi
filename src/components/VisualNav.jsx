import React, { useRef, useEffect } from 'react';

const VisualNav = ({ crossTrackDist, altDiff, heading, targetHeading, attitude }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const render = () => {
            const width = canvas.width = canvas.offsetWidth;
            const height = canvas.height = canvas.offsetHeight;

            ctx.clearRect(0, 0, width, height);

            // Horizon (Artificial)
            // Roll would rotate this line. For now assume level flight.
            const horizonY = height / 2;

            ctx.fillStyle = '#87CEEB'; // Sky (Day) or Stars (Night)
            // Use gradient for sky
            const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
            skyGrad.addColorStop(0, '#0d1b2a');
            skyGrad.addColorStop(1, '#1b263b');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, width, horizonY);

            // Ground
            const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
            groundGrad.addColorStop(0, '#2d6a4f');
            groundGrad.addColorStop(1, '#1b4332');
            ctx.fillStyle = groundGrad;
            ctx.fillRect(0, horizonY, width, height - horizonY);

            // Draw Horizon Line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, horizonY);
            ctx.lineTo(width, horizonY);
            ctx.stroke();

            // Draw Target "Line" / Gate
            // Perspective Projection
            // offsetX depends on crossTrackDist
            // offsetY depends on altDiff

            // Scaling factor: How many pixels per meter?
            // Depends on FOV. Let's approximate.
            // If crossTrack is 0, gate is center.
            // If crossTrack is +50m (we are Right), gate appears Left.

            const scale = 5; // pixels per meter shift
            const offsetX = -crossTrackDist * scale;
            const offsetY = altDiff * scale; // +AltDiff (We are above) -> Gate should be below (positive Y in canvas)

            const cx = width / 2 + offsetX;
            const cy = height / 2 + offsetY;

            // Draw a series of "gates" to simulate a tunnel
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;

            // Gate 1 (Near)
            const gateSize = 100;
            ctx.strokeRect(cx - gateSize / 2, cy - gateSize / 2, gateSize, gateSize);

            // Draw lines connecting corners to a vanishing point?
            // Vanishing point would be further offset?
            // For simple visualization, just the gate moving relative to center is enough.

            // Center Crosshair (Aircraft)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(width / 2 - 20, height / 2);
            ctx.lineTo(width / 2 + 20, height / 2);
            ctx.moveTo(width / 2, height / 2 - 20);
            ctx.lineTo(width / 2, height / 2 + 20);
            ctx.stroke();

            // Text info
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';
        };

        render();
        window.addEventListener('resize', render);
        return () => {
            window.removeEventListener('resize', render);
        }
    }, [crossTrackDist, altDiff, heading]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 0
            }}
        />
    );
};

export default VisualNav;
