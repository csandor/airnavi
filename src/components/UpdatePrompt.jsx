import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Registers the service worker and offers a new version once it has been downloaded.
 * Never reloads on its own: the banner is hidden while flying, and reloading is always
 * the pilot's tap, because completed lines and the flight log live only in memory.
 */
const UpdatePrompt = ({ flying, hasUnsavedWork }) => {
    const [dismissed, setDismissed] = useState(false);
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            if (!registration) return;
            // Installed PWAs can stay open for days; look for a new version periodically
            // and whenever the app comes back to the foreground.
            const check = () => {
                if (navigator.onLine && !registration.installing) registration.update().catch(() => {});
            };
            setInterval(check, CHECK_INTERVAL_MS);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') check();
            });
        },
        onRegisterError(error) {
            console.warn('Service worker registration failed', error);
        },
    });

    // A newer download (or the next check) brings a dismissed banner back
    useEffect(() => { if (needRefresh) setDismissed(false); }, [needRefresh]);

    if (!needRefresh || flying || dismissed) return null;

    return (
        <div className="toast-container">
            <div className="toast update-prompt" role="alert">
                <div>A new version of AirNavi is ready.</div>
                {hasUnsavedWork && (
                    <div className="update-prompt-warning">
                        Reloading clears completed lines and the flight log. Export them first.
                    </div>
                )}
                <div className="update-prompt-actions">
                    <button className="btn-primary" onClick={() => updateServiceWorker(true)}>Reload</button>
                    <button className="update-prompt-later" onClick={() => setDismissed(true)}>Later</button>
                </div>
            </div>
        </div>
    );
};

export default UpdatePrompt;
