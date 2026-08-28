import React, { useMemo } from 'react';
import { calculateBearing } from '../utils/GeoUtils';
import DistanceDisplay from './DistanceDisplay';

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
    limits,
    horizontalOffset = 0,
    radius = 60
}) => {

    // Thresholds from runtime settings
    const greenLimit = limits.green;
    const yellowLimit = limits.yellow;
    const vGreenLimit = limits.vertical_green;
    const vYellowLimit = limits.vertical_yellow;

    const haloColor = 'rgba(255, 255, 255, 0.8)';

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

            <DistanceDisplay
                distanceToStart={distanceToStart}
                distLabel={distLabel}
                crossTrackDist={crossTrackDist}
                headingDiff={headingDiff}
                altDiff={altDiff}
                speed={speed}
                units={units}
                limits={limits}
            />
        </div>
    );
};

const Arrow = ({ direction }) => {
    let rotation = 0;
    if (direction === 'right') rotation = 90;
    if (direction === 'down') rotation = 180;
    if (direction === 'left') rotation = 270;

    return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: `rotate(${rotation}deg)`, filter: 'drop-shadow(0 0 5px rgba(0,0,0,0.5))', color: 'white' }}>
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
    )
}

export default HUD;
