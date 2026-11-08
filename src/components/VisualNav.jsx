import React, { useRef, useEffect } from 'react';
import { QUALITY_COLORS } from '../utils/QualityUtils';
import { deviationToDots, axisQuality } from '../utils/IlsScale';

const VisualNav = ({ crossTrackDist, altDiff, heading, targetHeading, limits, showGauge = false, showMap = false, units = 'metric', onLayout }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const render = () => {
            const width = canvas.width = canvas.offsetWidth;
            const height = canvas.height = canvas.offsetHeight;

            ctx.clearRect(0, 0, width, height);

            // --- Panel layout: one row of bezelled instruments, centred above the data panel ---
            // Left to right: line gauge (optional), compass, ILS gauge, minimap (optional).
            // Sizes are in units of B, the bezel half-height: round instruments and the map
            // are 2B wide, the gauge bezel GAUGE_W * B, with GAP * B between bezels.
            const bottomReserved = 90; // numeric data panel (~70px) + 20px margin
            const padding = 16;
            const GAUGE_W = 0.55;
            const GAP = 0.2;
            const slots = [...(showGauge ? ['gauge'] : []), 'compass', 'ils', ...(showMap ? ['map'] : [])];
            const unitsWide = slots.reduce((sum, k) => sum + (k === 'gauge' ? GAUGE_W : 2), 0) + GAP * (slots.length - 1);
            const usableHeight = height - bottomReserved - padding * 2;
            // Leave ~0.2B under the bezels for the ILS scale legend
            const B = Math.max(10, Math.floor(Math.min(usableHeight / 2.2, (width - padding * 2) / unitsWide)));
            const faceR = B / 1.12;          // round face radius (bezel half-size = 1.12 * face)
            const faceInset = B - faceR;     // bezel border width, shared by the rectangular faces
            // Vertically centred in the space above the data panel (legend included)
            const cy = padding + Math.max(B, (usableHeight - 0.2 * B) / 2);

            // Horizon (Artificial), placed on the instruments' centre line.
            // Roll would rotate this line. For now assume level flight.
            const horizonY = cy;

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

            const slotX = {};
            let cursor = (width - unitsWide * B) / 2;
            slots.forEach(k => {
                const w = (k === 'gauge' ? GAUGE_W : 2) * B;
                slotX[k] = { left: cursor, w };
                cursor += w + GAP * B;
            });
            const compassX = slotX.compass.left + B;
            const ilsX = slotX.ils.left + B;
            // Outer corner radius of each rectangular bezel; the face corner is 0.3 of it
            const bezelCorner = {
                gauge: Math.min(B * 0.15, GAUGE_W * B * 0.3),
                map: B * 0.27,
            };
            const faceRect = (k) => slotX[k] && {
                x: slotX[k].left + faceInset,
                y: cy - B + faceInset,
                w: slotX[k].w - faceInset * 2,
                h: 2 * B - faceInset * 2,
                r: bezelCorner[k] * 0.3, // so the DOM overlay clips to the drawn face
            };
            const gaugeFace = faceRect('gauge') || null;
            const mapFace = faceRect('map') || null;

            // Tell the parent where the DOM-rendered faces go (line gauge, minimap)
            if (onLayout) onLayout({ gauge: gaugeFace, map: mapFace });

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

            // Rectangular variant of the bezel for the line gauge and minimap: grey rounded
            // rectangle, light border, black face inset by `inset` (same width as the round bezels).
            const drawRectBezel = (left, top, w, h, inset, corner) => {
                const roundRect = (x, y, rw, rh, r) => {
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(x, y, rw, rh, Math.max(0, r));
                    else ctx.rect(x, y, rw, rh);
                };
                ctx.save();
                roundRect(left, top, w, h, corner);
                ctx.fillStyle = '#999';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = Math.max(1, inset * 0.07);
                ctx.stroke();
                const ring = inset * 0.4; // light border just outside the face
                roundRect(left + inset - ring, top + inset - ring, w - 2 * (inset - ring), h - 2 * (inset - ring), corner * 0.5);
                ctx.fillStyle = '#e6e6e6';
                ctx.fill();
                ctx.lineWidth = Math.max(1, inset * 0.12);
                ctx.stroke();
                roundRect(left + inset, top + inset, w - 2 * inset, h - 2 * inset, corner * 0.3);
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
                const fmt = (m) => units === 'imperial' ? `${Math.round(m * 3.28084)} ft` : `${m} m`;
                ctx.fillText(`1 dot: ↔ ${fmt(limits.green)}  ↕ ${fmt(limits.vertical_green)}`, x, y + faceR * 1.12 + fontSize * 0.4);
            };
            drawIls(ilsX, cy, faceR);


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
                drawAirplane(0, 0, radius / 72 * 0.8); // airplane art is drawn for a 72px radius

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
            drawCompass(compassX, cy, faceR);

            // Bezels for the DOM-rendered instruments; their content is overlaid by the parent
            if (gaugeFace) drawRectBezel(slotX.gauge.left, cy - B, slotX.gauge.w, 2 * B, faceInset, bezelCorner.gauge);
            if (mapFace) drawRectBezel(slotX.map.left, cy - B, slotX.map.w, 2 * B, faceInset, bezelCorner.map);
        };

        render();
        window.addEventListener('resize', render);
        return () => {
            window.removeEventListener('resize', render);
        }
    }, [crossTrackDist, altDiff, heading, targetHeading, limits, showGauge, showMap, units]);

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
