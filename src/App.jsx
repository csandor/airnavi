import { useState, useEffect, useRef } from 'react'
import { parseKML } from './utils/KMLParser'
import { calculateCrossTrackDistance, calculateVerticalDeviation, calculateBearing, calculateDistance, calculateAlongTrackDistance } from './utils/GeoUtils'
import { gpsEmulator } from './utils/GPSEmulator'
import { flightLogger } from './utils/FlightLogger'
import { downloadKMZ } from './utils/KMZExporter'
import LineSelector from './components/LineSelector'
import HUD from './components/HUD'
import VisualNav from './components/VisualNav'
import MiniMap from './components/MiniMap'
import FullMap from './components/FullMap'
import DistanceDisplay from './components/DistanceDisplay'
import SummaryDialog from './components/SummaryDialog'
import Toast from './components/Toast'
import config from './config'
import './App.css'

const applyGeoidUndulation = (lines) => {
    const u = config.geoidUndulation;
    if (!u) return lines;
    return lines.map(l => ({
        ...l,
        start: { ...l.start, alt: l.start.alt + u },
        end:   { ...l.end,   alt: l.end.alt   + u },
    }));
};

function App() {
    const [completedLines, setCompletedLines] = useState(new Set())
    const [lines, setLines] = useState([])
    const [currentLine, setCurrentLine] = useState(null)
    const [direction, setDirection] = useState('normal')
    const [gpsData, setGpsData] = useState({ lat: 0, lon: 0, alt: 0, speed: 0, heading: 0 })
    const [flightStatus, setFlightStatus] = useState('idle')
    const [simulating, setSimulating] = useState(false)
    const [notification, setNotification] = useState(null) // { message, type }
    const [units, setUnits] = useState('metric'); // 'metric' or 'imperial'
    const [showSummary, setShowSummary] = useState(false);
    const [lastSession, setLastSession] = useState(null);
    const [bundledKmlFiles, setBundledKmlFiles] = useState([]);
    const completionLock = useRef(false); // Lock to prevent double logging
    const greenCoverage = useRef(new Set()); // Track meters covered in green
    const prevAlongTrack = useRef(null); // Track previous position for delta

    // HUD halo offset — updated by VisualNav when layout is computed
    const [hudHorizontalOffset, setHudHorizontalOffset] = useState(184);
    const [hudRadius, setHudRadius] = useState(120);

    // MiniMap dragging state
    const [miniMapPos, setMiniMapPos] = useState({ bottom: 20, right: 20 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const [showMiniMap, setShowMiniMap] = useState(true);
    const [mapMaximized, setMapMaximized] = useState(false);

    const showToast = (message, type = 'info') => {
        setNotification({ message, type });
    };

    const toggleMiniMap = () => {
        setShowMiniMap(prev => !prev);
    };

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                console.log('PWA Service Worker Ready:', registration);
            });
        }
    }, []);

    useEffect(() => {
        // Try local storage first
        const savedKml = localStorage.getItem('customKml');
        if (savedKml) {
            try {
                const parsedLines = parseKML(savedKml);
                setLines(parsedLines);
                showToast("Loaded Custom KML", "success");
                return;
            } catch (e) {
                console.error("Failed to parse saved KML", e);
                showToast(`Error in Saved KML: ${e.message}`, "error");
                localStorage.removeItem('customKml');
            }
        }

        // Fallback to default
        fetch(config.kmlFilePath)
            .then(res => res.text())
            .then(text => {
                const parsedLines = applyGeoidUndulation(parseKML(text))
                setLines(parsedLines)
            })
            .catch(err => console.error("Failed to load KML", err))
    }, [])

    useEffect(() => {
        fetch(`${config.bundledKmlDir}manifest.json`)
            .then(res => res.json())
            .then(files => setBundledKmlFiles(files))
            .catch(err => console.error("Failed to load bundled KML list", err))
    }, [])

    const handleBundledKmlSelect = (filename) => {
        if (!filename) return;
        fetch(`${config.bundledKmlDir}${filename}`)
            .then(res => res.text())
            .then(content => {
                const parsedLines = applyGeoidUndulation(parseKML(content));
                setLines(parsedLines);
                localStorage.setItem('customKml', content);
                setCurrentLine(null);
                resetFlightState();
                showToast(`Loaded ${filename}`, "success");
            })
            .catch(err => {
                showToast(`Error: ${err.message}`, "error");
                console.error(err);
            });
    };

    const handleKmlImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            try {
                const parsedLines = applyGeoidUndulation(parseKML(content));
                setLines(parsedLines);
                localStorage.setItem('customKml', content);
                setCurrentLine(null);
                resetFlightState();
                showToast("Sucessfully Imported KML", "success");
            } catch (err) {
                showToast(`Error: ${err.message}`, "error");
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    const clearCustomKml = () => {
        localStorage.removeItem('customKml');
        window.location.reload();
    };

    useEffect(() => {
        if (simulating) return;
        const handlePos = (pos) => {
            const data = {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                alt: pos.coords.altitude || 0,
                speed: pos.coords.speed || 0,
                heading: pos.coords.heading || 0
            };
            setGpsData(data);
        };
        const watchId = navigator.geolocation.watchPosition(handlePos, (err) => console.warn(err), {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000
        });
        return () => navigator.geolocation.clearWatch(watchId);
    }, [simulating]);

    // Global mouse and touch handlers for MiniMap dragging
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging.current) {
                const deltaX = e.clientX - dragStart.current.x;
                const deltaY = dragStart.current.y - e.clientY;

                setMiniMapPos(prev => ({
                    right: prev.right - deltaX,
                    bottom: prev.bottom + deltaY
                }));

                dragStart.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleTouchMove = (e) => {
            if (isDragging.current && e.touches.length > 0) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - dragStart.current.x;
                const deltaY = dragStart.current.y - touch.clientY;

                setMiniMapPos(prev => ({
                    right: prev.right - deltaX,
                    bottom: prev.bottom + deltaY
                }));

                dragStart.current = { x: touch.clientX, y: touch.clientY };
                e.preventDefault();
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleMouseUp);
        };
    }, []);


    const resetFlightState = () => {
        setFlightStatus('idle');
        flightLogger.reset();
        completionLock.current = false;
        greenCoverage.current.clear();
        prevAlongTrack.current = null;
    };

    const handleLineSelect = (line) => {
        // If already flying a line, finish it first
        if (flightStatus === 'flying' && currentLine) {
            finishFlight();
        }

        setCurrentLine(line);
        resetFlightState();
    }

    const toggleDirection = () => {
        setDirection(prev => prev === 'normal' ? 'reverse' : 'normal');
        resetFlightState();
        if (flightStatus === 'flying') {
            flightLogger.startFlight(); // Restart logger for new direction
        }
    }

    const handleLineRestore = (seq) => {
        setCompletedLines(prev => {
            const next = new Set(prev);
            next.delete(seq);
            return next;
        });

        // Optionally auto-select it if no line is currently selected
        const line = lines.find(l => l.seq === seq);
        if (line) {
            showToast(`Restored Line ${seq}`, "success");
            if (!currentLine) {
                setCurrentLine(line);
                resetFlightState();
                showToast(`Restored and Selected Line ${seq}`, "success");
            }
        }
    }

    const finishFlight = () => {
        if (!currentLine || flightStatus === 'idle') return;

        // Stop Sim if running
        if (simulating) {
            gpsEmulator.stopSimulation();
            setSimulating(false);
        }

        // Calculate final stats
        const start = direction === 'normal' ? currentLine.start : currentLine.end;
        const end = direction === 'normal' ? currentLine.end : currentLine.start;
        const totalLen = calculateDistance(start.lat, start.lon, end.lat, end.lon) * 1000;
        const alongTrack = calculateAlongTrackDistance(gpsData, start, end);

        // Completion: Green Coverage / Total Length
        const completionPct = Math.min(100, (greenCoverage.current.size / totalLen) * 100);

        setFlightStatus('idle'); // Stop "flying" status immediately

        // Log flight
        flightLogger.endFlight(currentLine.seq, completionPct, direction);
        const session = flightLogger.getLastSession();
        setLastSession(session);
        setShowSummary(true);
        completionLock.current = false;
    }

    const advanceToNextLine = () => {
        if (!currentLine) return;
        const nextSeq = currentLine.seq + 1;
        const nextLine = lines.find(l => l.seq >= nextSeq && !completedLines.has(l.seq));
        if (nextLine) {
            handleLineSelect(nextLine);
            showToast(`Switched to Line ${nextLine.seq}`, "success");
        }
    };

    const handleKeep = () => {
        setShowSummary(false);
        const seqToAdd = currentLine.seq;
        setCompletedLines(prev => {
            const next = new Set(prev);
            next.add(seqToAdd);
            return next;
        });
        showToast(`Line ${seqToAdd} Saved.`, "success");

        setTimeout(advanceToNextLine, 1000);
    };

    const handleReject = () => {
        flightLogger.deleteLastSession();
        setShowSummary(false);
        showToast(`Flight Rejected. Log deleted.`, "error");

        setTimeout(advanceToNextLine, 1000);
    };

    const toggleSimulation = () => {
        if (simulating) {
            gpsEmulator.stopSimulation();
            setSimulating(false);
        } else {
            if (!currentLine) return;
            setSimulating(true);

            const start = direction === 'normal' ? currentLine.start : currentLine.end;
            const end = direction === 'normal' ? currentLine.end : currentLine.start;

            const preStart = {
                lat: start.lat - (end.lat - start.lat) * config.simulation.preStartDistanceFactor,
                lon: start.lon - (end.lon - start.lon) * config.simulation.preStartDistanceFactor,
                alt: start.alt
            };

            gpsEmulator.startSimulation(preStart, end, config.simulation.speedKnots, (pos) => {
                setGpsData(pos);
            });
        }
    }

    const toggleFlight = () => {
        if (!currentLine) return;

        if (flightStatus === 'flying') {
            finishFlight();
        } else {
            resetFlightState();
            setFlightStatus('flying');
            flightLogger.startFlight();
            showToast("Recording Started", "success");
        }
    };

    // Auto-start recording when within green limits on all axes
    useEffect(() => {
        if (!currentLine || gpsData.lat === 0 || flightStatus !== 'idle') return;

        const start = direction === 'normal' ? currentLine.start : currentLine.end;
        const end = direction === 'normal' ? currentLine.end : currentLine.start;
        const crossTrackDist = calculateCrossTrackDistance(gpsData, start, end);
        const altDiff = calculateVerticalDeviation(gpsData, start, end);
        const lineBearing = calculateBearing(start.lat, start.lon, end.lat, end.lon);
        let headingDiff = gpsData.heading - lineBearing;
        while (headingDiff < -180) headingDiff += 360;
        while (headingDiff > 180) headingDiff -= 360;

        const distToStart = calculateDistance(gpsData.lat, gpsData.lon, start.lat, start.lon) * 1000;
        const distToEnd = calculateDistance(gpsData.lat, gpsData.lon, end.lat, end.lon) * 1000;
        const nearEndpoint = distToStart <= config.limits.start_radius || distToEnd <= config.limits.start_radius;

        if (nearEndpoint &&
            Math.abs(crossTrackDist) <= config.limits.green &&
            Math.abs(altDiff) <= config.limits.vertical_green &&
            Math.abs(headingDiff) <= config.limits.heading_green) {
            resetFlightState();
            setFlightStatus('flying');
            flightLogger.startFlight();
            showToast("Recording Started", "success");
        }
    }, [gpsData, flightStatus, currentLine, direction]);

    // Logic Loop via Effect
    useEffect(() => {
        if (!currentLine || gpsData.lat === 0 || flightStatus !== 'flying') return;

        const start = direction === 'normal' ? currentLine.start : currentLine.end;
        const end = direction === 'normal' ? currentLine.end : currentLine.start;
        const totalLen = calculateDistance(start.lat, start.lon, end.lat, end.lon) * 1000;
        const alongTrack = calculateAlongTrackDistance(gpsData, start, end);
        const crossTrackDist = calculateCrossTrackDistance(gpsData, start, end);
        const altDiff = calculateVerticalDeviation(gpsData, start, end);

        const currentHudData = {
            distanceToStart: 0,
            crossTrackDist: crossTrackDist,
            altDiff: altDiff,
            speed: gpsData.speed,
            heading: gpsData.heading,
            headingDiff: 0,
            distLabel: "Dist Start"
        };

        // Distance Logic
        if (alongTrack > 0 && alongTrack < totalLen) {
            currentHudData.distanceToStart = totalLen - alongTrack;
            currentHudData.distLabel = "Dist End";
        } else {
            currentHudData.distanceToStart = calculateDistance(gpsData.lat, gpsData.lon, start.lat, start.lon) * 1000;
        }

        // Heading Diff
        const lineBearing = calculateBearing(start.lat, start.lon, end.lat, end.lon);
        let headingDiff = gpsData.heading - lineBearing;
        while (headingDiff < -180) headingDiff += 360;
        while (headingDiff > 180) headingDiff -= 360;
        currentHudData.headingDiff = headingDiff;

        // Update Coverage
        const currentAlongTrack = alongTrack;
        if (Math.abs(crossTrackDist) <= config.limits.green) {
            if (prevAlongTrack.current !== null) {
                const startRange = Math.min(prevAlongTrack.current, currentAlongTrack);
                const endRange = Math.max(prevAlongTrack.current, currentAlongTrack);
                for (let m = Math.floor(startRange); m <= Math.floor(endRange); m++) {
                    greenCoverage.current.add(m);
                }
            }
        }

        // Update Logger
        flightLogger.updateStats(currentHudData);
        flightLogger.recordPoint({ ...gpsData, alt: gpsData.alt - config.geoidUndulation });

        // Check Completion (Crossing Endpoint Plane - 100% Progress)
        // Transition Requirement: Must have been before the plane (prevAlongTrack < totalLen)
        // and now at or past it (alongTrack >= totalLen).
        if (prevAlongTrack.current !== null &&
            prevAlongTrack.current < totalLen &&
            alongTrack >= totalLen &&
            flightStatus !== 'completed' &&
            !completionLock.current) {
            completionLock.current = true;
            finishFlight();
        }

        prevAlongTrack.current = alongTrack;
    }, [gpsData, flightStatus, currentLine, direction]);

    // Calculate HUD Data for Render (Visual only)
    let renderHudData = {
        distanceToStart: 0,
        crossTrackDist: 0,
        altDiff: 0,
        speed: gpsData.speed,
        heading: gpsData.heading,
        distLabel: "Dist Start",
        headingDiff: 0
    };

    if (currentLine && gpsData.lat !== 0) {
        const start = direction === 'normal' ? currentLine.start : currentLine.end;
        const end = direction === 'normal' ? currentLine.end : currentLine.start;
        const totalLen = calculateDistance(start.lat, start.lon, end.lat, end.lon) * 1000;
        const alongTrack = calculateAlongTrackDistance(gpsData, start, end);

        renderHudData.crossTrackDist = calculateCrossTrackDistance(gpsData, start, end);
        renderHudData.altDiff = calculateVerticalDeviation(gpsData, start, end);

        if (alongTrack > 0 && alongTrack < totalLen) {
            renderHudData.distanceToStart = totalLen - alongTrack;
            renderHudData.distLabel = "Dist End";
        } else {
            renderHudData.distanceToStart = calculateDistance(gpsData.lat, gpsData.lon, start.lat, start.lon) * 1000;
        }

        const lineBearing = calculateBearing(start.lat, start.lon, end.lat, end.lon);
        let headingDiff = gpsData.heading - lineBearing;
        while (headingDiff < -180) headingDiff += 360;
        while (headingDiff > 180) headingDiff -= 360;
        renderHudData.headingDiff = headingDiff;
        renderHudData.targetHeading = lineBearing;
    }

    const availableLines = lines.filter(l => !completedLines.has(l.seq));

    return (
        <div className="app-container" style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {notification && (
                <div className="toast-container">
                    <Toast
                        message={notification.message}
                        type={notification.type}
                        duration={config.notificationDurationSeconds * 1000}
                        onClose={() => setNotification(null)}
                    />
                </div>
            )}
            <div style={{ position: 'relative', zIndex: 90 }}>
                <LineSelector
                    lines={availableLines}
                    currentLine={currentLine}
                    onLineSelect={handleLineSelect}
                    direction={direction}
                    onDirectionToggle={toggleDirection}
                    completedLines={lines.filter(l => completedLines.has(l.seq))}
                    onLineRestore={handleLineRestore}
                    // Flight Control Props
                    flightStatus={flightStatus}
                    onToggleFlight={toggleFlight}
                    // Menu Props
                    simulating={simulating}
                    onToggleSimulation={toggleSimulation}
                    units={units}
                    onToggleUnits={() => setUnits(u => u === 'metric' ? 'imperial' : 'metric')}
                    onDownloadCSV={() => flightLogger.downloadCSV()}
                    onDownloadKMZ={() => downloadKMZ(flightLogger.history)}
                    onKmlImport={handleKmlImport}
                    onReset={clearCustomKml}
                    hasCustomKml={!!localStorage.getItem('customKml')}
                    bundledKmlFiles={bundledKmlFiles}
                    onBundledKmlSelect={handleBundledKmlSelect}
                    // MiniMap Props
                    showMiniMap={showMiniMap}
                    onToggleMiniMap={toggleMiniMap}
                    // Map View Props
                    mapMaximized={mapMaximized}
                    onToggleMapMaximized={() => setMapMaximized(prev => !prev)}
                />
            </div>

            {showSummary && lastSession && (
                <SummaryDialog
                    session={lastSession}
                    onKeep={handleKeep}
                    onReject={handleReject}
                />
            )}

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(to bottom, #1a2a3a 0%, #161b22 100%)' }}>
                {!currentLine && !mapMaximized && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', opacity: 0.5, zIndex: 50 }}>
                        <p>Select a flight line to begin navigation.</p>
                    </div>
                )}

                {mapMaximized && (
                    <>
                        <FullMap
                            lines={lines}
                            currentLine={currentLine}
                            gpsData={gpsData}
                            direction={direction}
                            onLineSelect={handleLineSelect}
                        />
                        {currentLine && (
                            <DistanceDisplay
                                {...renderHudData}
                                units={units}
                                style={{ zIndex: 30 }}
                            />
                        )}
                    </>
                )}

                {currentLine && !mapMaximized && (
                    <>
                        <VisualNav
                            crossTrackDist={renderHudData.crossTrackDist}
                            altDiff={renderHudData.altDiff}
                            heading={gpsData.heading}
                            targetHeading={renderHudData.targetHeading}
                            limits={config.limits}
                            onLayout={({ hudCenterX, canvasWidth, compassRadius }) => {
                                setHudHorizontalOffset(hudCenterX - canvasWidth / 2);
                                setHudRadius(compassRadius);
                            }}
                        />
                        <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%' }}>
                            <HUD
                                {...renderHudData}
                                units={units}
                                horizontalOffset={hudHorizontalOffset}
                                radius={hudRadius}
                            />
                        </div>

                        {/* MiniMap Overlay */}
                        {showMiniMap && (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: `${miniMapPos.bottom}px`,
                                    right: `${miniMapPos.right}px`,
                                    width: '200px',
                                    height: '200px',
                                    zIndex: 20,
                                    cursor: isDragging.current ? 'grabbing' : 'grab',
                                    userSelect: 'none',
                                    touchAction: 'none'
                                }}
                                onMouseDown={(e) => {
                                    isDragging.current = true;
                                    dragStart.current = { x: e.clientX, y: e.clientY };
                                    e.preventDefault();
                                }}
                                onTouchStart={(e) => {
                                    if (e.touches.length > 0) {
                                        isDragging.current = true;
                                        const touch = e.touches[0];
                                        dragStart.current = { x: touch.clientX, y: touch.clientY };
                                        e.preventDefault();
                                    }
                                }}
                            >
                                <MiniMap
                                    currentLine={currentLine}
                                    gpsData={gpsData}
                                    direction={direction}
                                    onClose={toggleMiniMap}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default App
