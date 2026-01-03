import React from 'react';

const LineSelector = ({
    lines,
    currentLine,
    onLineSelect,
    direction,
    onDirectionToggle,
    completedLines = [],
    onLineRestore
}) => {
    console.log("LineSelector Props:", { linesCount: lines.length, completedCount: completedLines.length });
    return (
        <div className="glass-panel" style={{
            padding: 'var(--spacing-md)',
            display: 'flex',
            gap: 'var(--spacing-md)',
            alignItems: 'center',
            marginBottom: 'var(--spacing-md)',
            zIndex: 10
        }}>
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
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)'
                    }}
                >
                    {direction === 'normal' ? 'Start → End' : 'End → Start'}
                </button>
            </div>
        </div>
    );
};

export default LineSelector;
