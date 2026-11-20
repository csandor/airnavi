import React from 'react';

/**
 * Small one-line label pinned to a bottom corner of the flight view (GPS status on the
 * left, app version and mission on the right). Never takes taps; truncates rather than
 * wrapping so the two corners can't collide.
 */
const CornerLabel = ({ side = 'left', children }) => (
    <div style={{
        position: 'absolute',
        [side]: 8,
        bottom: 6,
        zIndex: 60,
        maxWidth: '48%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: '0.75rem',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(0,0,0,0.45)',
        color: 'rgba(255,255,255,0.85)',
        pointerEvents: 'none',
    }}>
        {children}
    </div>
);

export default CornerLabel;
