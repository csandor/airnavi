import { useEffect, useRef } from 'react';

// Keeps the screen from sleeping while the app is open, using the Screen Wake Lock API.
// The OS releases the lock whenever the tab loses visibility (e.g. screen manually turned
// off, app backgrounded), so it must be re-requested on every visibilitychange back to visible.
export const useWakeLock = () => {
    const lockRef = useRef(null);

    useEffect(() => {
        if (!('wakeLock' in navigator)) return;

        const acquire = async () => {
            try {
                lockRef.current = await navigator.wakeLock.request('screen');
            } catch {
                // Lock request can fail (e.g. low battery, not visible) — nothing to do,
                // it will be retried on the next visibilitychange.
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') acquire();
        };

        acquire();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            lockRef.current?.release();
        };
    }, []);
};
