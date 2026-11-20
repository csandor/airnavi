import React from 'react';
import { FIX_QUALITY_LABELS } from '../utils/GpsSources';

const SOURCE_LABELS = { device: 'Device GPS', nmea: 'NMEA', sim: 'Simulator' };

/**
 * One-line GPS status in the corner of the flight view: source, fix rate and, for
 * external receivers, fix quality and satellite count. The rate turns amber below 2 Hz
 * and red when no fixes arrive.
 */
const GpsStatus = ({ status, replaying }) => {
    const { hz, source, fixQuality, satellites } = status;
    const label = replaying ? 'NMEA replay' : (SOURCE_LABELS[source] ?? 'GPS');
    const rateColor = hz === 0 ? 'hsl(var(--color-danger))' : hz < 2 ? '#ffb000' : 'hsl(var(--color-success))';
    const parts = [label];
    if (fixQuality) parts.push(FIX_QUALITY_LABELS[fixQuality] ?? `fix ${fixQuality}`);
    if (satellites) parts.push(`${satellites} sat`);

    return (
        <div style={{
            position: 'absolute',
            left: 8,
            bottom: 6,
            zIndex: 60,
            fontSize: '0.75rem',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(0,0,0,0.45)',
            color: 'rgba(255,255,255,0.85)',
            pointerEvents: 'none',
        }}>
            {parts.join(' · ')} · <span style={{ color: rateColor, fontWeight: 'bold' }}>{hz ? `${hz.toFixed(1)} Hz` : 'no fix'}</span>
        </div>
    );
};

export default GpsStatus;
