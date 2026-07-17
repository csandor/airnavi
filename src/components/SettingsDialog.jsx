import React, { useState } from 'react';

const FIELD_GROUPS = [
    {
        key: 'crosshair',
        title: 'Crosshair',
        fields: [
            { key: 'maxCrossTrack', label: 'Max Cross-Track (m)', hint: 'Horizontal distance at which the crosshair reaches max screen offset' },
            { key: 'maxAltDiff', label: 'Max Alt Diff (m)', hint: 'Vertical distance at which the crosshair reaches max screen offset' },
        ]
    },
    {
        key: 'limits',
        title: 'Flight Line Quality',
        fields: [
            { key: 'green', label: 'Cross-Track Green (m)', hint: 'Within this cross-track error -> Green Halo & completes line' },
            { key: 'yellow', label: 'Cross-Track Yellow (m)', hint: 'Within this -> Yellow Halo. Above -> Red' },
            { key: 'vertical_green', label: 'Vertical Green (m)', hint: 'Within this altitude error -> Green' },
            { key: 'vertical_yellow', label: 'Vertical Yellow (m)', hint: 'Within this -> Yellow. Above -> Red' },
            { key: 'heading_green', label: 'Heading Green (deg)', hint: 'Within this heading error -> auto-start recording' },
            { key: 'start_radius', label: 'Line Autostart Distance (m)', hint: 'Must be within this distance of start or end point to auto-start recording' },
        ]
    },
    {
        key: 'dubins',
        title: 'Path Planning',
        fields: [
            { key: 'minRadius', label: 'Min Turn Radius (m)', hint: 'Minimum turn radius for the planned path' },
            { key: 'approachDistance', label: 'Approach Distance (m)', hint: 'Distance before the line start where heading must already be aligned' },
            { key: 'updateIntervalSeconds', label: 'Update Interval (s)', hint: 'Minimum seconds between path recomputes' },
        ]
    }
];

// Form fields are edited as raw strings (so a partial value like "" or "-" isn't
// clobbered mid-edit) and only parsed into numbers on save.
const toFormStrings = (settings) => Object.fromEntries(
    Object.entries(settings).map(([groupKey, group]) => [
        groupKey,
        Object.fromEntries(Object.entries(group).map(([fieldKey, value]) => [fieldKey, String(value)]))
    ])
);

const SettingsDialog = ({ settings, onSave, onReset, onClose, units, onToggleUnits }) => {
    const [form, setForm] = useState(() => toFormStrings(settings));

    const handleChange = (groupKey, fieldKey, rawValue) => {
        setForm(prev => ({
            ...prev,
            [groupKey]: { ...prev[groupKey], [fieldKey]: rawValue }
        }));
    };

    const handleSave = () => {
        const parsed = Object.fromEntries(
            Object.entries(form).map(([groupKey, group]) => [
                groupKey,
                Object.fromEntries(Object.entries(group).map(([fieldKey, rawValue]) => {
                    const value = parseFloat(rawValue);
                    return [fieldKey, Number.isNaN(value) ? settings[groupKey][fieldKey] : value];
                }))
            ])
        );
        onSave(parsed);
        onClose();
    };

    const handleReset = () => {
        onReset();
        onClose();
    };

    return (
        <div className="glass-panel" style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            padding: 'var(--spacing-lg)',
            width: '90%',
            maxWidth: '420px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'hsl(var(--color-bg-secondary))',
            backdropFilter: 'none',
        }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Settings</h2>

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
                    Units
                </h3>
                <button
                    className="btn-primary"
                    onClick={onToggleUnits}
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                >
                    {units === 'metric' ? 'Metric' : 'Imperial'}
                </button>
            </div>

            {FIELD_GROUPS.map(group => (
                <div key={group.key} style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-sm)', color: 'var(--color-text-secondary)' }}>
                        {group.title}
                    </h3>
                    {group.fields.map(field => (
                        <div key={field.key} style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }} title={field.hint}>
                                {field.label}
                            </label>
                            <input
                                type="number"
                                value={form[group.key][field.key]}
                                onChange={(e) => handleChange(group.key, field.key, e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: 'var(--spacing-sm)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(0,0,0,0.3)',
                                    color: 'white',
                                    fontSize: '1em'
                                }}
                            />
                        </div>
                    ))}
                </div>
            ))}

            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--color-danger)' }}
                    onClick={handleReset}
                >
                    Reset to Defaults
                </button>
                <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--color-success)' }}
                    onClick={handleSave}
                >
                    Save
                </button>
            </div>
        </div>
    );
};

export default SettingsDialog;
