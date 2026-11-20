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
     
    }, [isSuccess, autoCloseSeconds]); // intentionally omit callbacks — stabilised via refs above

    // Compact strip pinned to the top edge (over the line selector) so the instrument
    // row and numeric panel stay visible while lining up for the next line.
    const color = isSuccess ? 'hsl(var(--color-success))' : 'hsl(var(--color-danger))';
    return (
        <div className="glass-panel" style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '6px 10px',
            width: 'calc(100% - 16px)',
            maxWidth: '720px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            fontSize: '0.85rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            border: `1px solid ${color}`,
            background: isSuccess
                ? 'linear-gradient(rgba(0, 200, 0, 0.25), rgba(0, 200, 0, 0.25)), hsl(var(--color-bg-secondary))'
                : 'linear-gradient(rgba(200, 0, 0, 0.25), rgba(200, 0, 0, 0.25)), hsl(var(--color-bg-secondary))',
            backdropFilter: 'none',
        }}>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                <div>
                    <strong>Line {session.lineId}</strong>{' '}
                    <span style={{ color, fontWeight: 'bold' }}>{session.completionPct}%</span>
                    <span style={{ opacity: 0.7 }}> · {session.duration.toFixed(0)}s · {session.direction}</span>
                </div>
                <div style={{ opacity: 0.8 }}>
                    Max X-Track {session.stats.maxDistanceToLine.toFixed(1)} m · Max Alt {session.stats.maxAltDiff.toFixed(1)} m
                    <span style={{ fontStyle: 'italic', opacity: 0.7 }}> · auto-{defaultAction.toLowerCase()} in {timeLeft}s</span>
                </div>
            </div>
            <button
                className="btn-primary"
                style={{ padding: '6px 12px', background: 'hsl(var(--color-danger))', opacity: isSuccess ? 0.5 : 1 }}
                onClick={onReject}
            >
                Reject
            </button>
            <button
                className="btn-primary"
                style={{ padding: '6px 12px', background: 'hsl(var(--color-success))', opacity: !isSuccess ? 0.5 : 1 }}
                onClick={onKeep}
            >
                Keep
            </button>
        </div>
    );
};

export default SummaryDialog;
