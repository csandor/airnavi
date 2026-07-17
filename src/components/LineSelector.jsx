import React from 'react';
import HamburgerMenu from './HamburgerMenu';
import { version } from '../../package.json';

const LineSelector = ({
    lines,
    currentLine,
    onLineSelect,
    direction,
    onDirectionToggle,
    completedLines = [],
    onLineRestore,
    // Section Props
    sections = [],
    currentSection,
    onSectionSelect,
    // Flight Control Props
    flightStatus,
    onToggleFlight,
    // Menu Props
    simulating,
    onToggleSimulation,
    onDownloadCSV,
    onDownloadKMZ,
    onKmlImport,
    onReset,
    onOpenSettings,
    hasCustomKml,
    bundledKmlFiles,
    onBundledKmlSelect,
    // MiniMap Props
    showMiniMap,
    onToggleMiniMap,
    // Map View Props
    mapMaximized,
    onToggleMapMaximized,
    // Planning Mode Props
    planningMode,
    onTogglePlanningMode
}) => {
    const isFlying = flightStatus === 'flying';

    return (
        <>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'hsl(var(--color-text-secondary))', marginBottom: 'var(--spacing-xs)' }}>
                AirNavi v{version}
            </div>

            <div className="glass-panel" style={{
                padding: 'var(--spacing-md)',
                display: 'flex',
                gap: 'var(--spacing-md)',
                alignItems: 'center',
                marginBottom: 'var(--spacing-md)',
                zIndex: 10
            }}>
                {sections.length > 1 && (
                    <div style={{ flex: 1 }}>
                        <label style={{
                            display: 'block',
                            fontSize: '0.8em',
                            color: 'hsl(var(--color-text-secondary))',
                            marginBottom: 'var(--spacing-xs)'
                        }}>
                            Select Section
                        </label>
                        <select
                            value={currentSection ?? ''}
                            onChange={(e) => onSectionSelect(parseInt(e.target.value, 10))}
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
                            {sections.map(section => (
                                <option key={section} value={section}>
                                    Section {section}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div style={{ flex: 1 }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.8em',
                        color: 'hsl(var(--color-text-secondary))',
                        marginBottom: 'var(--spacing-xs)'
                    }}>
                        Select Flight Line
                    </label>
                    <select
                        value={currentLine ? currentLine.seq : ''}
                        onChange={(e) => {
                            const seq = parseInt(e.target.value);
                            const line = lines.find(l => l.seq === seq);
                            onLineSelect(line);
                        }}
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
                        <option value="">-- Select Line --</option>
                        {lines.map(line => (
                            <option key={line.seq} value={line.seq}>
                                Line {line.seq}
                            </option>
                        ))}
                    </select>
                </div>

                {completedLines.length > 0 && (
                <div style={{ flex: 1 }}>
                    <label style={{
                        display: 'block',
                        fontSize: '0.8em',
                        color: 'hsl(var(--color-text-secondary))',
                        marginBottom: 'var(--spacing-xs)'
                    }}>
                        Restore Completed
                    </label>
                    <select
                        value=""
                        onChange={(e) => {
                            const seq = parseInt(e.target.value);
                            onLineRestore(seq);
                        }}
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
                        <option value="">-- Completed --</option>
                        {completedLines.map(line => (
                            <option key={line.seq} value={line.seq}>
                                {sections.length > 1 ? `Section ${line.section} - Line ${line.seq}` : `Line ${line.seq}`}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-md)' }}>
                <div>
                    <label style={{
                        display: 'block',
                        fontSize: '0.8em',
                        color: 'hsl(var(--color-text-secondary))',
                        marginBottom: 'var(--spacing-xs)'
                    }}>
                        Direction
                    </label>
                    <button
                        className="btn-primary"
                        onClick={onDirectionToggle}
                        disabled={isFlying}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-sm)',
                            opacity: isFlying ? 0.5 : 1,
                            cursor: isFlying ? 'not-allowed' : 'pointer'
                        }}
                        title={isFlying ? "Stop recording to change direction" : ""}
                    >
                        {direction === 'normal' ? 'Start → End' : 'End → Start'}
                    </button>
                </div>

                {/* Flight Control Button (Play/Stop) */}
                {currentLine && (
                    <button
                        className="btn-primary"
                        onClick={onToggleFlight}
                        style={{
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isFlying ? 'hsl(var(--color-danger))' : 'rgba(255, 255, 255, 0.1)',
                            border: isFlying ? 'none' : '1px solid hsl(var(--color-success))',
                            color: isFlying ? 'white' : 'hsl(var(--color-success))'
                        }}
                        title={isFlying ? "Stop Recording" : "Start Flying"}
                    >
                        {isFlying ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="1" />
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>
                )}

                {/* Map View Toggle Button (Map/Compass) */}
                <button
                    className="btn-primary"
                    onClick={onToggleMapMaximized}
                    style={{
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white'
                    }}
                    title={mapMaximized ? "Show HUD" : "Show Map"}
                >
                    {mapMaximized ? (
                        // Compass icon
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                        </svg>
                    ) : (
                        // Map icon
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                            <line x1="8" y1="2" x2="8" y2="18" />
                            <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                    )}
                </button>

                {/* Planning Mode Toggle Button (only active in big map mode) */}
                {currentLine && (
                    <button
                        className="btn-primary"
                        onClick={onTogglePlanningMode}
                        disabled={!mapMaximized || isFlying}
                        style={{
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: planningMode ? 'hsl(var(--color-danger))' : 'rgba(255, 255, 255, 0.1)',
                            border: planningMode ? 'none' : '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            opacity: (mapMaximized && !isFlying) ? 1 : 0.5,
                            cursor: (mapMaximized && !isFlying) ? 'pointer' : 'not-allowed'
                        }}
                        title={isFlying ? "Stop recording to plan a route" : (!mapMaximized ? "Switch to map view to plan a route" : (planningMode ? "Stop Planning" : "Plan Route to Line"))}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 20l-5.5-2.5V4L9 6.5m0 13.5l6-3m-6 3V6.5m6 10.5l5.5 2.5V6l-5.5-2.5m0 13.5V3.5" />
                        </svg>
                    </button>
                )}

                <HamburgerMenu
                    simulating={simulating}
                    onToggleSimulation={onToggleSimulation}
                    onDownloadCSV={onDownloadCSV}
                    onDownloadKMZ={onDownloadKMZ}
                    onKmlImport={onKmlImport}
                    onReset={onReset}
                    onOpenSettings={onOpenSettings}
                    hasCustomKml={hasCustomKml}
                    bundledKmlFiles={bundledKmlFiles}
                    onBundledKmlSelect={onBundledKmlSelect}
                    showMiniMap={showMiniMap}
                    onToggleMiniMap={onToggleMiniMap}
                />
            </div>
            </div>
        </>
    );
};

export default LineSelector;
