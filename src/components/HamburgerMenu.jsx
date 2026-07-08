import React, { useState, useRef, useEffect } from 'react';

const HamburgerMenu = ({
    simulating,
    onToggleSimulation,
    units,
    onToggleUnits,
    onDownloadCSV,
    onDownloadKMZ,
    onKmlImport,
    onReset,
    hasCustomKml,
    bundledKmlFiles = [],
    onBundledKmlSelect,
    showMiniMap,
    onToggleMiniMap
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showKmlSubmenu, setShowKmlSubmenu] = useState(false);
    const menuRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
        setShowKmlSubmenu(false);
    };

    const handleAction = (action) => {
        action();
        setIsOpen(false);
    };

    return (
        <div className="hamburger-menu" ref={menuRef} style={{ position: 'relative' }}>
            <button
                className="btn-primary"
                onClick={toggleMenu}
                style={{
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
                aria-label="Menu"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: '#1a2a3a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    padding: '8px',
                    minWidth: '180px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: 'calc(100vh - 80px)',
                    overflowY: 'auto'
                }}>
                    <MenuButton
                        onClick={() => handleAction(onToggleSimulation)}
                        label={simulating ? '⏹ Stop Sim' : '▶ Simulate Flight'}
                        color={simulating ? 'var(--color-danger)' : 'var(--color-success)'}
                    />
                    <MenuButton
                        onClick={() => handleAction(onToggleUnits)}
                        label={`📏 Units: ${units === 'metric' ? 'MET' : 'IMP'}`}
                    />
                    <MenuButton
                        onClick={() => handleAction(onDownloadCSV)}
                        label="📥 Export CSV"
                    />
                    <MenuButton
                        onClick={() => handleAction(onDownloadKMZ)}
                        label="📥 Export KMZ"
                    />

                    <div style={{ position: 'relative' }}>
                        <MenuButton
                            label="📂 Load KML"
                            component="label"
                        >
                            <input
                                type="file"
                                accept=".kml"
                                onChange={(e) => {
                                    onKmlImport(e);
                                    setIsOpen(false);
                                }}
                                style={{ display: 'none' }}
                            />
                        </MenuButton>
                    </div>

                    {bundledKmlFiles.length > 0 && (
                        <div style={{ position: 'relative' }}>
                            <MenuButton
                                onClick={() => setShowKmlSubmenu(prev => !prev)}
                                label={`🗂 Sample KMLs ${showKmlSubmenu ? '▾' : '▸'}`}
                            />
                            {showKmlSubmenu && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    paddingLeft: '12px',
                                    marginTop: '2px',
                                    borderLeft: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    {bundledKmlFiles.map(filename => (
                                        <MenuButton
                                            key={filename}
                                            onClick={() => handleAction(() => onBundledKmlSelect(filename))}
                                            label={filename.replace(/\.kml$/i, '')}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <MenuButton
                        onClick={() => handleAction(onToggleMiniMap)}
                        label={showMiniMap ? '✓ MiniMap' : 'MiniMap'}
                    />

                    {hasCustomKml && (
                        <MenuButton
                            onClick={() => handleAction(onReset)}
                            label="🔄 Reset KML"
                            color="var(--color-danger)"
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const MenuButton = ({ onClick, label, color, component: Component = 'button', children }) => (
    <Component
        onClick={onClick}
        style={{
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            color: color || 'white',
            textAlign: 'left',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            display: 'block',
            width: '100%',
            transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
    >
        {label}
        {children}
    </Component>
);

export default HamburgerMenu;
