import React from 'react';

const DistanceDisplay = ({
    distanceToStart,
    distLabel = "Dist",
    crossTrackDist,
    headingDiff,
    altDiff,
    speed,
    units = 'metric',
    limits,
    style
}) => {
    const speedKts = speed * 1.94384;

    const tierColor = (value, yellowLimit, redLimit) =>
        value > redLimit ? 'hsl(var(--color-danger))'
            : value > yellowLimit ? 'hsl(var(--color-warning))'
                : 'white';

    const crossTrackColor = tierColor(Math.abs(crossTrackDist), limits.green, limits.yellow);
    const headingColor = tierColor(Math.abs(headingDiff || 0), limits.heading_green, limits.heading_yellow);
    const altColor = tierColor(Math.abs(altDiff), limits.vertical_green, limits.vertical_yellow);
    const speedColor = tierColor(speedKts, limits.speed_green, limits.speed_yellow);

    return (
        <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '20px',
            background: 'rgba(0,0,0,0.5)',
            padding: '10px 20px',
            borderRadius: '12px',
            backdropFilter: 'blur(5px)',
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            ...style
        }}>
            <DataField label={distLabel} value={`${(distanceToStart).toFixed(0)} m`} />
            <DataField label="X-Track" value={`${Math.abs(crossTrackDist).toFixed(1)} m`} color={crossTrackColor} />
            <DataField label="Hdg Diff" value={`${Math.abs(headingDiff || 0).toFixed(1)}°`} color={headingColor} />
            <DataField
                label="Alt Diff"
                value={units === 'metric'
                    ? `${altDiff >= 0 ? '+' : ''}${altDiff.toFixed(1)} m`
                    : `${altDiff >= 0 ? '+' : ''}${(altDiff * 3.28084).toFixed(0)} ft`}
                color={altColor}
            />
            <DataField
                label="Speed"
                value={units === 'metric'
                    ? `${(speed * 3.6).toFixed(0)} km/h`
                    : `${speedKts.toFixed(0)} kts`}
                color={speedColor}
            />
        </div>
    );
};

const DataField = ({ label, value, color }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--color-text-secondary))', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: color || 'white', fontFamily: 'monospace' }}>{value}</span>
    </div>
);

export default DistanceDisplay;
