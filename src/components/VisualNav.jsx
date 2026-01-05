import React, { useRef, useEffect } from 'react';

const VisualNav = ({ crossTrackDist, altDiff, heading, targetHeading, limits, attitude }) => {
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
            const offsetY = altDiff * scale;

            // --- Grouped Centering Calculation ---
            const compassRadius = 72;
            const maxHudWidth = 100; // Gate size
            const spacing = 224; // Increased by one full diameter (144) from previous 80
            const totalGroupWidth = (compassRadius * 2) + spacing + maxHudWidth;

            const groupLeft = (width - totalGroupWidth) / 2;
            const compassX = groupLeft + compassRadius;
            const hudCenterX = groupLeft + (compassRadius * 2) + spacing + (maxHudWidth / 2);

            const cx = hudCenterX + offsetX;
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
            ctx.moveTo(hudCenterX - 20, height / 2);
            ctx.lineTo(hudCenterX + 20, height / 2);
            ctx.moveTo(hudCenterX, height / 2 - 20);
            ctx.lineTo(hudCenterX, height / 2 + 20);
            ctx.stroke();

            // Text info
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';

            // --- COMPASS ---
            const drawAirplane = (x, y, scale = 1) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);
                ctx.strokeStyle = 'white';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                // Fuselage
                ctx.moveTo(0, -20);
                ctx.lineTo(2, -18);
                ctx.lineTo(2, 15);
                ctx.lineTo(8, 20);
                ctx.lineTo(-8, 20);
                ctx.lineTo(-2, 15);
                ctx.lineTo(-2, -18);
                ctx.closePath();
                // Wings
                ctx.moveTo(2, -5);
                ctx.lineTo(25, 5);
                ctx.lineTo(25, 10);
                ctx.lineTo(2, 5);
                ctx.moveTo(-2, -5);
                ctx.lineTo(-25, 5);
                ctx.lineTo(-25, 10);
                ctx.lineTo(-2, 5);
                // Tail
                ctx.moveTo(2, 15);
                ctx.lineTo(10, 18);
                ctx.lineTo(10, 20);
                ctx.lineTo(2, 18);
                ctx.moveTo(-2, 15);
                ctx.lineTo(-10, 18);
                ctx.lineTo(-10, 20);
                ctx.lineTo(-2, 18);

                ctx.fill();
                ctx.stroke();
                ctx.restore();
            };

            const drawCompass = (x, y, radius) => {
                ctx.save();
                ctx.translate(x, y);

                // Outer Rim
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.stroke();

                // Rotating Part
                ctx.save();
                ctx.rotate(-heading * Math.PI / 180);

                // Ticks and numbers
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                for (let deg = 0; deg < 360; deg += 30) {
                    const rad = deg * Math.PI / 180;
                    const isCardinal = deg % 90 === 0;

                    // Ticks
                    ctx.beginPath();
                    ctx.moveTo(Math.sin(rad) * radius, -Math.cos(rad) * radius);
                    ctx.lineTo(Math.sin(rad) * (radius - (isCardinal ? 12 : 8)), -Math.cos(rad) * (radius - (isCardinal ? 12 : 8)));
                    ctx.stroke();

                    // Text
                    ctx.save();
                    ctx.translate(Math.sin(rad) * (radius - 20), -Math.cos(rad) * (radius - 20));
                    // Keep text upright relative to the rim (optional, but requested rim rotation points to N/E/S/W at top)
                    // The user said "the rim should rotate", so the letters move with the rim.

                    let label = (deg / 10).toString();
                    if (deg === 0) label = 'N';
                    if (deg === 90) label = 'E';
                    if (deg === 180) label = 'S';
                    if (deg === 270) label = 'W';

                    ctx.fillStyle = isCardinal ? 'var(--color-success)' : 'white';
                    ctx.font = isCardinal ? 'bold 14px Arial' : '10px Arial';
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                }
                ctx.restore();

                // Target Heading Indicator (Red Line with Arrow)
                if (Number.isFinite(targetHeading)) {
                    ctx.save();
                    ctx.rotate(-heading * Math.PI / 180); // Align with rotating rim

                    const targetRad = targetHeading * Math.PI / 180;

                    // --- Lateral Shift Calculation (CDI Behavior) ---
                    const greenLimit = (limits && limits.green) || 5;
                    const shift = Math.max(-radius * 0.95, Math.min(radius * 0.95, (-crossTrackDist / greenLimit) * (radius * 0.5)));

                    ctx.save();
                    ctx.rotate(targetRad);

                    // Path intersection with circle: x^2 + y^2 = radius^2
                    // Here x = shift (in the rotated targetRad context)
                    const sRad = Math.sqrt(Math.max(0, radius * radius - shift * shift));
                    const yTop = -sRad;
                    const yBottom = sRad;

                    // 1. Draw The Line (Full diameter, not clipped)
                    ctx.translate(shift, 0);
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round'; // Back to round for better aesthetics

                    const lineLen = radius * 3; // Long enough to span the whole compass
                    ctx.beginPath();
                    ctx.moveTo(0, lineLen / 2);
                    ctx.lineTo(0, -lineLen / 2);
                    ctx.stroke();

                    // 2. Draw The Arrow (Anchored at the rim intersection)
                    ctx.save();
                    ctx.translate(0, yTop);
                    ctx.beginPath();
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.moveTo(-5, 9);
                    ctx.lineTo(0, 0);
                    ctx.lineTo(5, 9);
                    ctx.stroke();
                    ctx.restore();

                    ctx.restore(); // Restore targetRad/shift
                    ctx.restore(); // Restore heading
                }

                // Static Center Airplane
                drawAirplane(0, 0, 0.8);

                // Top Indicator (Lubber Line)
                ctx.strokeStyle = 'var(--color-danger)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -radius - 5);
                ctx.lineTo(0, -radius + 15);
                ctx.stroke();

                ctx.restore();
            };

            // Draw the compass at its calculated horizontal position
            drawCompass(compassX, height / 2, compassRadius);
        };

        render();
        window.addEventListener('resize', render);
        return () => {
            window.removeEventListener('resize', render);
        }
    }, [crossTrackDist, altDiff, heading, targetHeading, limits]);

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
