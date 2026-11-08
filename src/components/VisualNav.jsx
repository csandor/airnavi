import React, { useRef, useEffect } from 'react';
import { QUALITY_COLORS } from '../utils/QualityUtils';
import { deviationToDots, axisQuality } from '../utils/IlsScale';

const VisualNav = ({ crossTrackDist, altDiff, heading, targetHeading, limits, onLayout }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

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
            const spacing = compassRadius; // gap between instruments = one radius

            const totalGroupWidth = compassRadius * 2 + spacing + compassRadius * 2;
            const groupLeft = (width - totalGroupWidth) / 2;
            const compassX = groupLeft + compassRadius;
            const hudCenterX = groupLeft + compassRadius * 2 + spacing + compassRadius;

            // Notify parent of the instrument layout (sizes the Line Gauge overlay)
            if (onLayout) onLayout({ hudCenterX, canvasWidth: width, compassRadius });

            // Classic instrument styling shared by the ILS dial and the compass,
            // modelled on the Wikimedia "ILS_gauge.svg" gauge: grey rounded-square bezel with
            // two corner knobs, a light ring, and a black face of radius `faceR`.
            const drawBezel = (x, y, faceR) => {
                const half = faceR * 1.12;
                const corner = faceR * 0.27;
                ctx.save();
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(x - half, y - half, half * 2, half * 2, corner);
                else ctx.rect(x - half, y - half, half * 2, half * 2); // pre-2023 browsers
                ctx.fillStyle = '#999';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = Math.max(1, faceR * 0.008);
                ctx.stroke();
                // Corner knobs: half-discs whose flat side faces the centre
                const knobR = faceR * 0.19;
                [[-1, Math.PI * 0.75], [1, Math.PI * 1.25]].forEach(([side, startAngle]) => {
                    const kx = x + side * faceR * 0.8;
                    const ky = y - faceR * 0.78;
                    const grad = ctx.createLinearGradient(kx - side * knobR, ky - knobR, kx + side * knobR, ky + knobR);
                    grad.addColorStop(0, '#ccc');
                    grad.addColorStop(1, '#4d4d4d');
                    ctx.beginPath();
                    ctx.arc(kx, ky, knobR, startAngle, startAngle + Math.PI);
                    ctx.closePath();
                    ctx.fillStyle = grad;
                    ctx.fill();
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = Math.max(1, faceR * 0.012);
                    ctx.stroke();
                });
                // Light ring, then the black face
                ctx.beginPath();
                ctx.arc(x, y, faceR * 1.045, 0, Math.PI * 2);
                ctx.fillStyle = '#e6e6e6';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = Math.max(1, faceR * 0.014);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x, y, faceR, 0, Math.PI * 2);
                ctx.fillStyle = '#1a1a1a';
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            };

            // ILS course deviation dial: fixed face, vertical needle = cross-track,
            // horizontal needle = vertical deviation, both pointing toward the line
            // ("fly to the needle"). Four dots per side;
            // dots are scaled by the active limits (1 dot = green, 2 dots = yellow), so a
            // needle inside the first dot means that axis is green.
            const drawIls = (x, y, faceR) => {
                drawBezel(x, y, faceR);
                const firstDot = faceR * 0.318; // just outside the centre circle
                const dotGap = faceR * 0.163;
                const dotsToPx = (dots) => {
                    const abs = Math.abs(dots);
                    const px = abs <= 1 ? abs * firstDot : firstDot + (abs - 1) * dotGap;
                    return Math.sign(dots) * px;
                };
                const needleX = x - dotsToPx(deviationToDots(crossTrackDist, limits.green, limits.yellow));
                const needleY = y + dotsToPx(deviationToDots(altDiff, limits.vertical_green, limits.vertical_yellow));

                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, faceR, 0, Math.PI * 2);
                ctx.clip();

                // Scale dots
                ctx.fillStyle = '#fff';
                const dotR = faceR * 0.042;
                for (let n = 0; n < 4; n++) {
                    const d = firstDot + n * dotGap;
                    [[d, 0], [-d, 0], [0, d], [0, -d]].forEach(([dx, dy]) => {
                        ctx.beginPath();
                        ctx.arc(x + dx, y + dy, dotR, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }

                // Centre reference circle
                const strokeW = faceR * 0.038;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = strokeW;
                ctx.beginPath();
                ctx.arc(x, y, faceR * 0.168, 0, Math.PI * 2);
                ctx.stroke();

                // Needles, coloured by that axis' quality (the only quality cue in ILS mode)
                const needleHalf = faceR * 0.573;
                ctx.lineCap = 'butt';
                ctx.strokeStyle = QUALITY_COLORS[axisQuality(crossTrackDist, limits.green, limits.yellow)];
                ctx.beginPath();
                ctx.moveTo(needleX, y - needleHalf);
                ctx.lineTo(needleX, y + needleHalf);
                ctx.stroke();
                ctx.strokeStyle = QUALITY_COLORS[axisQuality(altDiff, limits.vertical_green, limits.vertical_yellow)];
                ctx.beginPath();
                ctx.moveTo(x - needleHalf, needleY);
                ctx.lineTo(x + needleHalf, needleY);
                ctx.stroke();
                ctx.restore();

                // Scale legend under the bezel: what one dot means on each axis
                const fontSize = Math.max(10, Math.round(faceR * 0.13));
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.font = `${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(`1 dot: ↔ ${limits.green} m  ↕ ${limits.vertical_green} m`, x, y + faceR * 1.12 + fontSize * 0.4);
            };
            // Shrink the faces so each bezel occupies roughly the layout radius.
            const faceScale = 0.88;

            drawIls(hudCenterX, height / 2, compassRadius * faceScale);


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
                drawBezel(x, y, radius);
                ctx.save();
                ctx.translate(x, y);

                // Keep the card and course line on the face, off the bezel
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.clip();

                // Rotating Part
                ctx.save();
                ctx.rotate(-heading * Math.PI / 180);

                // Ticks and numbers
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Minor ticks every 5 deg, longer every 10 deg, like a panel heading card
                ctx.strokeStyle = '#fff';
                for (let deg = 0; deg < 360; deg += 5) {
                    if (deg % 30 === 0) continue;
                    const rad = deg * Math.PI / 180;
                    const inner = radius - (deg % 10 === 0 ? radius * 0.09 : radius * 0.05);
                    ctx.lineWidth = deg % 10 === 0 ? 1.5 : 1;
                    ctx.beginPath();
                    ctx.moveTo(Math.sin(rad) * radius, -Math.cos(rad) * radius);
                    ctx.lineTo(Math.sin(rad) * inner, -Math.cos(rad) * inner);
                    ctx.stroke();
                }
                ctx.lineWidth = 2;

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
                    ctx.fillStyle = 'white';
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
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -radius - radius * 0.07);
                ctx.lineTo(0, -radius + radius * 0.21);
                ctx.stroke();

                ctx.restore();
            };

            // Draw the compass at its calculated horizontal position
            drawCompass(compassX, height / 2, compassRadius * faceScale);
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
