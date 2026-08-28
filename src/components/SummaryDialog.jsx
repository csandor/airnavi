import React, { useState, useEffect, useRef } from 'react';
import config from '../config';

const SummaryDialog = ({ session, onKeep, onReject, autoCloseSeconds = config.summaryAutoCloseSeconds }) => {
    const [timeLeft, setTimeLeft] = useState(autoCloseSeconds);
    const completion = parseFloat(session.completionPct);
    const isSuccess = completion >= config.completionThreshold;
    const defaultAction = isSuccess ? 'Keep' : 'Reject';

    // Use refs so the interval closure always calls the latest callbacks
    // without restarting the timer when parent re-renders pass new function references
    const onKeepRef = useRef(onKeep);
    const onRejectRef = useRef(onReject);
    useEffect(() => { onKeepRef.current = onKeep; }, [onKeep]);
    useEffect(() => { onRejectRef.current = onReject; }, [onReject]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (isSuccess) onKeepRef.current(); else onRejectRef.current();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSuccess, autoCloseSeconds]); // intentionally omit callbacks — stabilised via refs above

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
            border: `1px solid ${isSuccess ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))'}`,
            background: isSuccess
                ? 'linear-gradient(rgba(0, 200, 0, 0.25), rgba(0, 200, 0, 0.25)), hsl(var(--color-bg-secondary))'
                : 'linear-gradient(rgba(200, 0, 0, 0.25), rgba(200, 0, 0, 0.25)), hsl(var(--color-bg-secondary))',
            backdropFilter: 'none',
        }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Flight Summary</h2>

            <div style={{ marginBottom: 'var(--spacing-md)', textAlign: 'left', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <p><strong>Line ID:</strong> {session.lineId}</p>
                <p><strong>Direction:</strong> {session.direction}</p>
                <p><strong>Duration:</strong> {session.duration.toFixed(1)}s</p>
                <p style={{ color: isSuccess ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))' }}>
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
                    style={{ flex: 1, background: 'hsl(var(--color-danger))', opacity: isSuccess ? 0.5 : 1 }}
                    onClick={onReject}
                >
                    Reject (Delete)
                </button>
                <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'hsl(var(--color-success))', opacity: !isSuccess ? 0.5 : 1 }}
                    onClick={onKeep}
                >
                    Keep (Save)
                </button>
            </div>
        </div>
    );
};

export default SummaryDialog;
