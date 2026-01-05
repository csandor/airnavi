import { useState, useEffect, useRef } from 'react'
import { parseKML } from './utils/KMLParser'
import { calculateCrossTrackDistance, calculateVerticalDeviation, calculateBearing, calculateDistance, calculateAlongTrackDistance } from './utils/GeoUtils'
import { gpsEmulator } from './utils/GPSEmulator'
import { flightLogger } from './utils/FlightLogger'
import LineSelector from './components/LineSelector'
import HUD from './components/HUD'
import VisualNav from './components/VisualNav'
import MiniMap from './components/MiniMap'
import SummaryDialog from './components/SummaryDialog'
import config from './config'
import './App.css'

function App() {
    const [completedLines, setCompletedLines] = useState(new Set())
    const [lines, setLines] = useState([])
    const [currentLine, setCurrentLine] = useState(null)
    const [direction, setDirection] = useState('normal')
    const [gpsData, setGpsData] = useState({ lat: 0, lon: 0, alt: 0, speed: 0, heading: 0 })
    const [flightStatus, setFlightStatus] = useState('idle')
    const [simulating, setSimulating] = useState(false)
    const [notification, setNotification] = useState(null)
    const [units, setUnits] = useState('metric'); // 'metric' or 'imperial'
    const [showSummary, setShowSummary] = useState(false);
    const [lastSession, setLastSession] = useState(null);
    const completionLock = useRef(false); // Lock to prevent double logging
    const greenCoverage = useRef(new Set()); // Track meters covered in green
    const prevAlongTrack = useRef(null); // Track previous position for delta

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
                setNotification("Loaded Custom KML");
                return;
            } catch (e) {
                console.error("Failed to parse saved KML", e);
                localStorage.removeItem('customKml');
            }
        }

        // Fallback to default
        fetch(config.kmlFilePath)
            .then(res => res.text())
            .then(text => {
                const parsedLines = parseKML(text)
                setLines(parsedLines)
            })
            .catch(err => console.error("Failed to load KML", err))
    }, [])

    const handleKmlImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            try {
                const parsedLines = parseKML(content);
                setLines(parsedLines);
                localStorage.setItem('customKml', content);
                setCurrentLine(null);
                resetFlightState();
                setNotification("Sucessfully Imported KML");
            } catch (err) {
                setNotification("Error: Invalid KML file");
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

    const resetFlightState = () => {
        setFlightStatus('idle');
        flightLogger.reset();
        completionLock.current = false;
        greenCoverage.current.clear();
        prevAlongTrack.current = null;
    };

    const handleLineSelect = (line) => {
        setCurrentLine(line);
        resetFlightState();
    }

    const toggleDirection = () => {
        setDirection(prev => prev === 'normal' ? 'reverse' : 'normal');
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
            setNotification(`Restored Line ${seq}`);
            if (!currentLine) {
                setCurrentLine(line);
                resetFlightState();
                setNotification(`Restored and Selected Line ${seq}`);
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

    const handleKeep = () => {
        setShowSummary(false);
        setCompletedLines(prev => new Set(prev).add(currentLine.seq));
        setNotification(`Line ${currentLine.seq} Saved.`);

        // Auto-advance logic
        setTimeout(() => {
            const nextSeq = currentLine.seq + 1;
            const nextLine = lines.find(l => l.seq >= nextSeq && !completedLines.has(l.seq));
            if (nextLine) {
                setCurrentLine(nextLine);
                resetFlightState();
                setNotification(`Switched to Line ${nextLine.seq}`);
            }
        }, 1000);
    };

    const handleReject = () => {
        flightLogger.deleteLastSession();
        setShowSummary(false);
        setNotification(`Flight Rejected. Log deleted.`);
        resetFlightState();
    };

    const toggleSimulation = () => {
        if (simulating) {
            finishFlight();
        } else {
            if (!currentLine) return;
            resetFlightState(); // Ensure clean start
            setSimulating(true);
            setFlightStatus('flying');
            flightLogger.startFlight();

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
        prevAlongTrack.current = currentAlongTrack;

        // Update Logger
        flightLogger.updateStats(currentHudData);

        // Check Completion
        if (alongTrack > totalLen * 0.95 && flightStatus !== 'completed' && !completionLock.current) {
            completionLock.current = true;
            finishFlight(true);
        }

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
    }

    const availableLines = lines.filter(l => !completedLines.has(l.seq));

    return (
        <div className="app-container" style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {notification && (
                <div className="glass-panel" style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '10px 20px',
                    zIndex: 100,
                    color: 'var(--color-success)',
                    fontWeight: 'bold'
                }}>
                    {notification}
                </div>
            )}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, position: 'relative' }}>
                <h1 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    AirNavi
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                        {flightStatus === 'flying' ? '● REC' : ''}
                    </span>
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        className="btn-primary"
                        style={{ fontSize: '0.8rem', background: simulating ? 'var(--color-danger)' : 'var(--color-success)' }}
                        onClick={toggleSimulation}
                    >
                        {simulating ? 'Stop Sim' : 'Simulate Flight'}
                    </button>
                    <button
                        className="btn-primary"
                        style={{ fontSize: '0.8rem', background: 'transparent', border: '1px solid currentColor' }}
                        onClick={() => setUnits(u => u === 'metric' ? 'imperial' : 'metric')}
                    >
                        {units === 'metric' ? 'MET' : 'IMP'}
                    </button>
                    <button
                        className="btn-primary"
                        style={{ fontSize: '0.8rem', background: 'var(--color-primary)' }}
                        onClick={() => flightLogger.downloadCSV()}
                    >
                        📥 CSV
                    </button>
                    <label className="btn-primary" style={{ fontSize: '0.8rem', background: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        📂 Load KML
                        <input type="file" accept=".kml" onChange={handleKmlImport} style={{ display: 'none' }} />
                    </label>
                    {localStorage.getItem('customKml') && (
                        <button
                            className="btn-primary"
                            style={{ fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}
                            onClick={clearCustomKml}
                        >
                            Reset
                        </button>
                    )}
                </div>
            </header>

            <div style={{ position: 'relative', zIndex: 90 }}>
                <LineSelector
                    lines={availableLines}
                    currentLine={currentLine}
                    onLineSelect={handleLineSelect}
                    direction={direction}
                    onDirectionToggle={toggleDirection}
                    completedLines={lines.filter(l => completedLines.has(l.seq))}
                    onLineRestore={handleLineRestore}
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
                {!currentLine && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', opacity: 0.5, zIndex: 50 }}>
                        <p>Select a flight line to begin navigation.</p>
                    </div>
                )}

                {currentLine && (
                    <>
                        <VisualNav
                            crossTrackDist={renderHudData.crossTrackDist}
                            altDiff={renderHudData.altDiff}
                            heading={gpsData.heading}
                        />
                        <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%' }}>
                            <HUD
                                {...renderHudData}
                                targetHeading={0} // needs calc
                                units={units}
                            />
                        </div>

                        {/* MiniMap Overlay */}
                        <div style={{
                            position: 'absolute',
                            bottom: '20px',
                            right: '20px',
                            width: '200px',
                            height: '200px',
                            zIndex: 20
                        }}>
                            <MiniMap
                                currentLine={currentLine}
                                gpsData={gpsData}
                                direction={direction}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default App
