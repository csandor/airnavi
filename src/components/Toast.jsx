import React, { useEffect, useRef, useState } from 'react';

const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
    const [isClosing, setIsClosing] = useState(false);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsClosing(true);
            setTimeout(() => onCloseRef.current(), 300);
        }, duration);

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration]); // intentionally omit onClose — stabilised via ref above

    return (
        <div className={`toast ${type} ${isClosing ? 'toast-out' : ''}`}>
            {message}
            <span className="toast-close" onClick={onClose} aria-label="Close">×</span>
        </div>
    );
};

export default Toast;
