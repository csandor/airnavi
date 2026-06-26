import React, { useMemo } from 'react';
import config from '../config';
import { calculateBearing } from '../utils/GeoUtils';

const ARROW_SIZE = 60;

const HUD = ({
    crossTrackDist,
    altDiff,
    distanceToStart,
    distLabel = "Dist",
    speed,
    heading,
    targetHeading,
    headingDiff,
    className,
    units = 'metric',
    horizontalOffset = 0,
    radius = 60
}) => {

    // Thresholds from config
    const greenLimit = config.limits.green;
    const yellowLimit = config.limits.yellow;
    const vGreenLimit = config.limits.vertical_green;
    const vYellowLimit = config.limits.vertical_yellow;

    // Determine Halo Color (Worst case wins)
    const xt = Math.abs(crossTrackDist);
    const vt = Math.abs(altDiff);

    let haloColor = 'rgba(255, 0, 0, 0.5)'; // red

    if (xt < greenLimit && vt < vGreenLimit) {
        haloColor = 'rgba(0, 255, 0, 0.6)'; // green
    } else if (xt < yellowLimit && vt < vYellowLimit) {
        haloColor = 'rgba(255, 204, 0, 0.6)'; // yellow
    }

    const showLeft = crossTrackDist > greenLimit;
    const showRight = crossTrackDist < -greenLimit;
    const showDown = altDiff > vGreenLimit;
    const showUp = altDiff < -vGreenLimit;

    return (
        <div className={`hud - container ${className || ''} `} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            height: '100%',
            width: '100%',
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)'
        }}>

            {/* Center Halo / Target */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: `calc(50% + ${horizontalOffset}px)`,
                transform: 'translate(-50%, -50%)',
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                borderRadius: '50%',
                border: `4px solid ${haloColor}`,
                boxShadow: `0 0 20px ${haloColor}`,
                transition: 'all 0.3s ease'
            }} />

            {/* Arrows */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: `calc(50% + ${horizontalOffset}px)`,
                transform: 'translate(-50%, -50%)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gridTemplateRows: '1fr 1fr 1fr',
                width: '200px',
                height: '200px',
                pointerEvents: 'none'
            }}>
                <div /* Up */ style={{ gridColumn: 2, gridRow: 1, display: 'flex', justifyContent: 'center' }}>
                    {showUp && <Arrow direction="up" />}
                </div>
                <div /* Left */ style={{ gridColumn: 1, gridRow: 2, display: 'flex', alignItems: 'center' }}>
                    {showLeft && <Arrow direction="left" />}
                </div>
                <div /* Right */ style={{ gridColumn: 3, gridRow: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {showRight && <Arrow direction="right" />}
                </div>
                <div /* Down */ style={{ gridColumn: 2, gridRow: 3, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                    {showDown && <Arrow direction="down" />}
                </div>
            </div>

            {/* Data Readouts */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                display: 'flex',
                gap: '20px',
                background: 'rgba(0,0,0,0.5)',
                padding: '10px 20px',
                borderRadius: '12px',
                backdropFilter: 'blur(5px)'
            }}>
                <DataField label={distLabel} value={`${(distanceToStart).toFixed(0)} m`} />
                <DataField label="X-Track" value={`${Math.abs(crossTrackDist).toFixed(1)} m`} color={Math.abs(crossTrackDist) > greenLimit ? 'var(--color-warning)' : 'white'} />
                <DataField label="Hdg Diff" value={`${Math.abs(headingDiff || 0).toFixed(1)}°`} color={Math.abs(headingDiff || 0) > 10 ? 'var(--color-warning)' : 'white'} />

                <DataField
                    label="Alt Diff"
                    value={units === 'metric'
                        ? `${altDiff >= 0 ? '+' : ''}${altDiff.toFixed(1)} m`
                        : `${altDiff >= 0 ? '+' : ''}${(altDiff * 3.28084).toFixed(0)} ft`}
                    color={Math.abs(altDiff) > 10 ? 'var(--color-warning)' : 'white'}
                />

                <DataField
                    label="Speed"
                    value={units === 'metric'
                        ? `${(speed * 3.6).toFixed(0)} km / h`
                        : `${(speed * 1.94384).toFixed(0)} kts`}
                />
            </div>
        </div>
    );
};

const DataField = ({ label, value, color }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: color || 'white', fontFamily: 'monospace' }}>{value}</span>
    </div>
);

const Arrow = ({ direction }) => {
    let rotation = 0;
    if (direction === 'right') rotation = 90;
    if (direction === 'down') rotation = 180;
    if (direction === 'left') rotation = 270;

    return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: `rotate(${rotation}deg)`, filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.5))', color: 'var(--color-accent-primary)' }}>
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
    )
}

export default HUD;
