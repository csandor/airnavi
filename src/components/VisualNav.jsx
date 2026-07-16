import React, { useRef, useEffect } from 'react';

const VisualNav = ({ crossTrackDist, altDiff, heading, targetHeading, limits, crosshair, attitude, onLayout }) => {
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

            // Logarithmic crosshair displacement.
            // maxPx = 2 * compassRadius (computed later, so we forward-ref it here after sizing).
            // logDisplace(value, maxDist, maxPx):
            //   maps [0, maxDist] -> [0, maxPx] logarithmically, clamped at maxPx.
            //   ref = maxDist * 0.1 controls curve shape (smaller = more aggressive log).
            const logDisplace = (value, maxDist, maxPx) => {
                const sign = value < 0 ? -1 : 1;
                const abs = Math.abs(value);
                const ref = maxDist * 0.1;
                const px = maxPx * Math.log(1 + abs / ref) / Math.log(1 + maxDist / ref);
                return sign * Math.min(px, maxPx);
            };
            // maxPx is set after compassRadius is computed below; offsetX/Y assigned there too.

            // --- Dynamic sizing: fill available space without overlapping bottom data panel ---
            // Bottom data panel is ~70px tall + 20px bottom margin = 90px reserved
            const bottomReserved = 90;
            const padding = 16;
            const usableHeight = height - bottomReserved - padding * 2;
            const maxRadiusFromHeight = usableHeight / 2;

            // Both instruments are the same radius; spacing between their edges = one diameter
            const BASE_RADIUS = 72;
            const BASE_SPACING = BASE_RADIUS; // gap between the two instruments = one radius
            const BASE_TOTAL_WIDTH = BASE_RADIUS * 2 + BASE_SPACING + BASE_RADIUS * 2;

            const maxRadiusFromWidth = (width - padding * 2) * BASE_RADIUS / BASE_TOTAL_WIDTH;
            const compassRadius = Math.floor(Math.min(maxRadiusFromHeight, maxRadiusFromWidth) * 0.8);
            const scale_factor = compassRadius / BASE_RADIUS;
            const spacing = compassRadius; // gap between instruments = one radius

            const totalGroupWidth = compassRadius * 2 + spacing + compassRadius * 2;
            const groupLeft = (width - totalGroupWidth) / 2;
            const compassX = groupLeft + compassRadius;
            const hudCenterX = groupLeft + compassRadius * 2 + spacing + compassRadius;

            // Notify parent of gate center so HUD halo can be aligned to it
            if (onLayout) onLayout({ hudCenterX, canvasWidth: width, compassRadius });

            const maxPx = compassRadius * 2;
            const offsetX = -logDisplace(crossTrackDist, crosshair.maxCrossTrack, maxPx);
            const offsetY =  logDisplace(altDiff,        crosshair.maxAltDiff,    maxPx);

            const cx = hudCenterX + offsetX;
            const cy = height / 2 + offsetY;

            // Gate crosshair — circle with 4 tick lines extending inside and outside the rim
            const tickInner = compassRadius * 0.55; // line starts inside the circle
            const tickOuter = compassRadius * 1.2;  // line ends outside the circle
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            // Circle
            ctx.beginPath();
            ctx.arc(cx, cy, compassRadius, 0, Math.PI * 2);
            ctx.stroke();
            // Four ticks
            ctx.beginPath();
            ctx.moveTo(cx, cy - tickOuter); ctx.lineTo(cx, cy - tickInner); // top
            ctx.moveTo(cx, cy + tickInner); ctx.lineTo(cx, cy + tickOuter); // bottom
            ctx.moveTo(cx - tickOuter, cy); ctx.lineTo(cx - tickInner, cy); // left
            ctx.moveTo(cx + tickInner, cy); ctx.lineTo(cx + tickOuter, cy); // right
            ctx.stroke();

            // Draw lines connecting corners to a vanishing point?
            // Vanishing point would be further offset?
            // For simple visualization, just the gate moving relative to center is enough.

            // Center Crosshair (Aircraft)
            const crossSize = Math.floor(20 * scale_factor);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hudCenterX - crossSize, height / 2);
            ctx.lineTo(hudCenterX + crossSize, height / 2);
            ctx.moveTo(hudCenterX, height / 2 - crossSize);
            ctx.lineTo(hudCenterX, height / 2 + crossSize);
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

                    // Ticks — proportional to radius
                    const tickOuter = radius;
                    const tickInner = radius - (isCardinal ? radius * 0.17 : radius * 0.11);
                    ctx.beginPath();
                    ctx.moveTo(Math.sin(rad) * tickOuter, -Math.cos(rad) * tickOuter);
                    ctx.lineTo(Math.sin(rad) * tickInner, -Math.cos(rad) * tickInner);
                    ctx.stroke();

                    // Text — proportional to radius
                    const textR = radius - radius * 0.28;
                    ctx.save();
                    ctx.translate(Math.sin(rad) * textR, -Math.cos(rad) * textR);

                    let label = (deg / 10).toString();
                    if (deg === 0) label = 'N';
                    if (deg === 90) label = 'E';
                    if (deg === 180) label = 'S';
                    if (deg === 270) label = 'W';

                    const fontSize = Math.max(8, Math.round(radius * 0.19));
                    ctx.fillStyle = isCardinal ? 'var(--color-success)' : 'white';
                    ctx.font = isCardinal ? `bold ${fontSize}px Arial` : `${Math.max(7, Math.round(radius * 0.14))}px Arial`;
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
                    const arrowW = radius * 0.07;
                    const arrowH = radius * 0.13;
                    ctx.save();
                    ctx.translate(0, yTop);
                    ctx.beginPath();
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 2;
                    ctx.moveTo(-arrowW, arrowH);
                    ctx.lineTo(0, 0);
                    ctx.lineTo(arrowW, arrowH);
                    ctx.stroke();
                    ctx.restore();

                    ctx.restore(); // Restore targetRad/shift
                    ctx.restore(); // Restore heading
                }

                // Static Center Airplane — scale with radius
                drawAirplane(0, 0, radius / BASE_RADIUS * 0.8);

                // Top Indicator (Lubber Line)
                ctx.strokeStyle = 'var(--color-danger)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -radius - radius * 0.07);
                ctx.lineTo(0, -radius + radius * 0.21);
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
    }, [crossTrackDist, altDiff, heading, targetHeading, limits, crosshair]);

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
