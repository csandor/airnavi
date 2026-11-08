import React, { useState } from 'react';
import { resolveGpsAltitudeDatum } from '../utils/AltitudeDatum';

const DATUM_LABELS = { ellipsoidal: 'Ellipsoidal (WGS-84)', msl: 'Sea level (MSL)' };

const FIELD_GROUPS = [
    {
        key: 'limits',
        title: 'Flight Line Quality',
        fields: [
            { key: 'green', label: 'Cross-Track Green (m)', hint: 'Within this cross-track error -> Green Halo & completes line' },
            { key: 'yellow', label: 'Cross-Track Yellow (m)', hint: 'Within this -> Yellow Halo. Above -> Red' },
            { key: 'vertical_green', label: 'Vertical Green (m)', hint: 'Within this altitude error -> Green' },
            { key: 'vertical_yellow', label: 'Vertical Yellow (m)', hint: 'Within this -> Yellow. Above -> Red' },
            { key: 'heading_green', label: 'Heading Green (deg)', hint: 'Within this heading error -> auto-start recording' },
            { key: 'heading_yellow', label: 'Heading Yellow (deg)', hint: 'Within this -> Yellow. Above -> Red' },
            { key: 'start_radius', label: 'Line Autostart Distance (m)', hint: 'Must be within this distance of start or end point to auto-start recording' },
            { key: 'speed_green', label: 'Speed Green (kts)', hint: 'Below this speed -> Green Speed' },
            { key: 'speed_yellow', label: 'Speed Yellow (kts)', hint: 'Below this speed -> Yellow Speed. Above -> Red' },
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

const MISSION_TOLERANCE_LABELS = {
    green: 'cross-track green', yellow: 'cross-track yellow',
    vertical_green: 'vertical green', vertical_yellow: 'vertical yellow',
    heading_green: 'heading green', heading_yellow: 'heading yellow',
};

const SettingsDialog = ({ settings, missionTolerances, onSave, onReset, onClose, units, onToggleUnits, showMiniMap, onToggleMiniMap, showLineGauge, onToggleLineGauge }) => {
    const [form, setForm] = useState(() => ({
        ...toFormStrings({ limits: settings.limits, dubins: settings.dubins }),
        summaryAutoCloseSeconds: String(settings.summaryAutoCloseSeconds),
        gpsAltitudeDatum: settings.gpsAltitudeDatum,
        useMissionTolerances: settings.useMissionTolerances,
    }));
    const missionOverrides = form.useMissionTolerances && missionTolerances ? missionTolerances : {};

    const handleChange = (groupKey, fieldKey, rawValue) => {
        setForm(prev => ({
            ...prev,
            [groupKey]: { ...prev[groupKey], [fieldKey]: rawValue }
        }));
    };

    const handleTopLevelChange = (fieldKey, rawValue) => {
        setForm(prev => ({ ...prev, [fieldKey]: rawValue }));
    };

    const handleSave = () => {
        const parsed = Object.fromEntries(
            FIELD_GROUPS.map(({ key: groupKey }) => [
                groupKey,
                Object.fromEntries(Object.entries(form[groupKey]).map(([fieldKey, rawValue]) => {
                    const value = parseFloat(rawValue);
                    return [fieldKey, Number.isNaN(value) ? settings[groupKey][fieldKey] : value];
                }))
            ])
        );
        const summaryAutoCloseSeconds = parseFloat(form.summaryAutoCloseSeconds);
        parsed.summaryAutoCloseSeconds = Number.isNaN(summaryAutoCloseSeconds) ? settings.summaryAutoCloseSeconds : summaryAutoCloseSeconds;
        parsed.gpsAltitudeDatum = form.gpsAltitudeDatum;
        parsed.useMissionTolerances = form.useMissionTolerances;
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
                <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-sm)', color: 'hsl(var(--color-text-secondary))' }}>
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

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-sm)', color: 'hsl(var(--color-text-secondary))' }}>
                    MiniMap
                </h3>
                <button
                    className="btn-primary"
                    onClick={onToggleMiniMap}
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                >
                    {showMiniMap ? 'Shown' : 'Hidden'}
                </button>
            </div>

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-sm)', color: 'hsl(var(--color-text-secondary))' }}>
                    Line Gauge
                </h3>
                <button
                    className="btn-primary"
                    onClick={onToggleLineGauge}
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                >
                    {showLineGauge ? 'Shown' : 'Hidden'}
                </button>
            </div>


            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-sm)', color: 'hsl(var(--color-text-secondary))' }}>
                    GPS Altitude
                </h3>
                <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }} title="Which datum this device reports GPS altitude in. Sea-level readings get the geoid undulation added so they match the ellipsoidal line altitudes.">
                    Device altitude datum
                </label>
                <select
                    value={form.gpsAltitudeDatum}
                    onChange={(e) => handleTopLevelChange('gpsAltitudeDatum', e.target.value)}
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-sm)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        fontSize: '1em'
                    }}
                >
                    <option value="auto">Auto (this device: {DATUM_LABELS[resolveGpsAltitudeDatum('auto')]})</option>
                    <option value="ellipsoidal">{DATUM_LABELS.ellipsoidal}</option>
                    <option value="msl">{DATUM_LABELS.msl}</option>
                </select>
            </div>

            {FIELD_GROUPS.map(group => (
                <div key={group.key} style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-sm)', color: 'hsl(var(--color-text-secondary))' }}>
                        {group.title}
                    </h3>
                    {group.key === 'limits' && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <button
                                className="btn-primary"
                                onClick={() => handleTopLevelChange('useMissionTolerances', !form.useMissionTolerances)}
                                title="Mission TXT files may declare the planner's tolerances in their header. When on, those replace the green/yellow fields below for that section."
                                style={{
                                    width: '100%',
                                    padding: 'var(--spacing-sm)',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                Mission file tolerances: {form.useMissionTolerances ? 'Used' : 'Ignored'}
                            </button>
                            <div style={{ fontSize: '0.75em', marginTop: '4px', color: 'hsl(var(--color-text-secondary))' }}>
                                {!form.useMissionTolerances
                                    ? 'The values below apply to every mission.'
                                    : missionTolerances
                                        ? `Current section's file sets: ${Object.entries(missionTolerances).map(([k, v]) => `${MISSION_TOLERANCE_LABELS[k]} ${v}`).join(', ')}. Those fields below are ignored.`
                                        : 'The current mission declares no tolerances, so the values below apply.'}
                            </div>
                        </div>
                    )}
                    {group.fields.map(field => (
                        <div key={field.key} style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }} title={field.hint}>
                                {field.label}
                            </label>
                            <input
                                type="number"
                                value={form[group.key][field.key]}
                                onChange={(e) => handleChange(group.key, field.key, e.target.value)}
                                disabled={group.key === 'limits' && field.key in missionOverrides}
                                style={{
                                    opacity: group.key === 'limits' && field.key in missionOverrides ? 0.4 : 1,
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

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--spacing-sm)', color: 'hsl(var(--color-text-secondary))' }}>
                    Flight Summary
                </h3>
                <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <label style={{ display: 'block', fontSize: '0.8em', marginBottom: '2px' }} title="Seconds before the flight summary dialog auto-accepts or auto-rejects">
                        Auto-Close Delay (s)
                    </label>
                    <input
                        type="number"
                        value={form.summaryAutoCloseSeconds}
                        onChange={(e) => handleTopLevelChange('summaryAutoCloseSeconds', e.target.value)}
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
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'hsl(var(--color-danger))' }}
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
                    style={{ flex: 1, background: 'hsl(var(--color-success))' }}
                    onClick={handleSave}
                >
                    Save
                </button>
            </div>
        </div>
    );
};

export default SettingsDialog;
