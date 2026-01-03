import React, { useState, useEffect } from 'react';
import config from '../config';

const SummaryDialog = ({ session, onKeep, onReject }) => {
    const [timeLeft, setTimeLeft] = useState(config.summaryAutoCloseSeconds);
    const completion = parseFloat(session.completionPct);
    const isSuccess = completion >= config.completionThreshold;
    const defaultAction = isSuccess ? 'Keep' : 'Reject';

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Execute default action
                    if (isSuccess) {
                        onKeep();
                    } else {
                        onReject();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isSuccess, onKeep, onReject]);

    return (
        <div className="glass-panel" style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            padding: 'var(--spacing-lg)',
            width: '90%',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: `1px solid ${isSuccess ? 'var(--color-success)' : 'var(--color-danger)'}`
        }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Flight Summary</h2>

            <div style={{ marginBottom: 'var(--spacing-md)', textAlign: 'left', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <p><strong>Line ID:</strong> {session.lineId}</p>
                <p><strong>Direction:</strong> {session.direction}</p>
                <p><strong>Duration:</strong> {session.duration.toFixed(1)}s</p>
                <p style={{ color: isSuccess ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    <strong>Completion:</strong> {session.completionPct}%
                </p>
                <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />
                <p><strong>Max X-Track:</strong> {session.stats.maxDistanceToLine.toFixed(1)} m</p>
                <p><strong>Max Alt Diff:</strong> {session.stats.maxAltDiff.toFixed(1)} m</p>
            </div>

            <p style={{ marginBottom: 'var(--spacing-lg)', fontStyle: 'italic', fontSize: '0.8rem', opacity: 0.7 }}>
                Auto-{defaultAction}ing in {timeLeft}s...
            </p>

            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--color-danger)', opacity: isSuccess ? 0.5 : 1 }}
                    onClick={onReject}
                >
                    Reject (Delete)
                </button>
                <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'var(--color-success)', opacity: !isSuccess ? 0.5 : 1 }}
                    onClick={onKeep}
                >
                    Keep (Save)
                </button>
            </div>
        </div>
    );
};

export default SummaryDialog;
