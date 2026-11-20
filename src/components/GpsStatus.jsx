import React from 'react';
import { FIX_QUALITY_LABELS } from '../utils/GpsSources';
import CornerLabel from './CornerLabel';

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
        <CornerLabel side="left">
            {parts.join(' · ')} · <span style={{ color: rateColor, fontWeight: 'bold' }}>{hz ? `${hz.toFixed(1)} Hz` : 'no fix'}</span>
        </CornerLabel>
    );
};

export default GpsStatus;
