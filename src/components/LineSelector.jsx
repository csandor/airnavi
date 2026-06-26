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
    // Flight Control Props
    flightStatus,
    onToggleFlight,
    // Menu Props
    simulating,
    onToggleSimulation,
    units,
    onToggleUnits,
    onDownloadCSV,
    onDownloadKMZ,
    onKmlImport,
    onReset,
    hasCustomKml,
    // MiniMap Props
    showMiniMap,
    onToggleMiniMap
}) => {
    console.log("LineSelector Props:", { linesCount: lines.length, completedCount: completedLines.length });
    const isFlying = flightStatus === 'flying';

    return (
        <div className="glass-panel" style={{
            padding: 'var(--spacing-md)',
            display: 'flex',
            gap: 'var(--spacing-md)',
            alignItems: 'center',
            marginBottom: 'var(--spacing-md)',
            zIndex: 10
        }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                AirNavi v{version}
            </div>

            <div style={{ flex: 1 }}>
                <label style={{
                    display: 'block',
                    fontSize: '0.8em',
                    color: 'var(--color-text-secondary)',
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
                        color: 'var(--color-text-secondary)',
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
                            border: '1px solid var(--color-success)',
                            background: 'rgba(0,0,0,0.3)',
                            color: 'var(--color-success)',
                            fontSize: '1em'
                        }}
                    >
                        <option value="">-- Completed --</option>
                        {completedLines.map(line => (
                            <option key={line.seq} value={line.seq}>
                                Line {line.seq}
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
                        color: 'var(--color-text-secondary)',
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
                            background: isFlying ? 'var(--color-danger)' : 'rgba(255, 255, 255, 0.1)',
                            border: isFlying ? 'none' : '1px solid var(--color-success)',
                            color: isFlying ? 'white' : 'var(--color-success)'
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

                <HamburgerMenu
                    simulating={simulating}
                    onToggleSimulation={onToggleSimulation}
                    units={units}
                    onToggleUnits={onToggleUnits}
                    onDownloadCSV={onDownloadCSV}
                    onDownloadKMZ={onDownloadKMZ}
                    onKmlImport={onKmlImport}
                    onReset={onReset}
                    hasCustomKml={hasCustomKml}
                    showMiniMap={showMiniMap}
                    onToggleMiniMap={onToggleMiniMap}
                />
            </div>
        </div>
    );
};

export default LineSelector;
