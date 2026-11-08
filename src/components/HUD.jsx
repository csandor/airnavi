import React from 'react';
import DistanceDisplay from './DistanceDisplay';

const HUD = ({
    crossTrackDist,
    altDiff,
    distanceToStart,
    distLabel = "Dist",
    speed,
    headingDiff,
    className,
    units = 'metric',
    limits
}) => {
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


export default HUD;
