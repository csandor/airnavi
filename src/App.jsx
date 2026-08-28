import { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { parseKML } from './utils/KMLParser'
import { parseTXT } from './utils/TxtParser'
import { calculateCrossTrackDistance, calculateVerticalDeviation, calculateBearing, calculateDistance, calculateAlongTrackDistance, destinationPoint } from './utils/GeoUtils'
import { classifyQuality, worseQuality } from './utils/QualityUtils'
import { planDubinsPath } from './utils/DubinsUtils'
import { gpsEmulator } from './utils/GPSEmulator'
import { flightLogger } from './utils/FlightLogger'
import { downloadKMZ } from './utils/KMZExporter'
import LineSelector from './components/LineSelector'
import HUD from './components/HUD'
import VisualNav from './components/VisualNav'
import MiniMap from './components/MiniMap'
import LineGauge from './components/LineGauge'
const FullMap = lazy(() => import('./components/FullMap'))
import DistanceDisplay from './components/DistanceDisplay'
import SummaryDialog from './components/SummaryDialog'
import SettingsDialog from './components/SettingsDialog'
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

// KML altitudes are MSL and need geoid undulation to become ellipsoidal;
// TXT altitudes are already ellipsoidal. KML lines have no section concept,
// so they're all tagged into a single implicit section.
const parseFlightFile = (filename, content) => {
    if (/\.txt$/i.test(filename)) {
        return parseTXT(content);
    }
    return applyGeoidUndulation(parseKML(content)).map(l => ({ ...l, section: 1 }));
};

const loadRuntimeSettings = () => {
    const defaults = {
        crosshair: config.crosshair,
        limits: config.limits,
        dubins: config.dubins,
        summaryAutoCloseSeconds: config.summaryAutoCloseSeconds,
    };
    const saved = localStorage.getItem('runtimeSettings');
    if (!saved) return defaults;
    try {
        const parsed = JSON.parse(saved);
        return {
            crosshair: { ...defaults.crosshair, ...parsed.crosshair },
            limits: { ...defaults.limits, ...parsed.limits },
            dubins: { ...defaults.dubins, ...parsed.dubins },
            summaryAutoCloseSeconds: parsed.summaryAutoCloseSeconds ?? defaults.summaryAutoCloseSeconds,
        };
    } catch {
        return defaults;
    }
};

function App() {
    const [completedLines, setCompletedLines] = useState(new Set())
    const [lines, setLines] = useState([])
    const [missionFileName, setMissionFileName] = useState('lines.kml')
    const [currentLine, setCurrentLine] = useState(null)
    const [currentSection, setCurrentSection] = useState(null)
    const [direction, setDirection] = useState('normal')
    const [gpsData, setGpsData] = useState({ lat: 0, lon: 0, alt: 0, speed: 0, heading: 0 })
    const [flightStatus, setFlightStatus] = useState('idle')
    const [simulating, setSimulating] = useState(false)
    const [notification, setNotification] = useState(null) // { message, type }
    const [units, setUnits] = useState('metric'); // 'metric' or 'imperial'
    const [showSummary, setShowSummary] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [runtimeSettings, setRuntimeSettings] = useState(loadRuntimeSettings);
    const [lastSession, setLastSession] = useState(null);
    const [bundledKmlFiles, setBundledKmlFiles] = useState([]);
    const completionLock = useRef(false); // Lock to prevent double logging
    const greenCoverage = useRef(new Set()); // Track meters covered in green
    const chunkQuality = useRef(new Map()); // chunk index -> worst quality ('green'|'yellow'|'red') seen while flying
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
    const [autoZoom, setAutoZoom] = useState(true);
    const lastMapBounds = useRef(null); // Remembers FullMap extents across HUD<->Map switches while auto zoom is off

    // Line Gauge dragging state
    const [showLineGauge, setShowLineGauge] = useState(true);
    const [lineGaugePos, setLineGaugePos] = useState({ bottom: 20, left: 20 });
    const isDraggingGauge = useRef(false);
    const dragStartGauge = useRef({ x: 0, y: 0 });

    // Dubins path planning mode
    const [planningMode, setPlanningMode] = useState(false);
    const [dubinsPath, setDubinsPath] = useState(null);
    const lastDubinsUpdate = useRef(0);
    const resumePlanningOnNextLine = useRef(false);

    const showToast = (message, type = 'info') => {
        setNotification({ message, type });
    };

    const toggleMiniMap = () => {
        setShowMiniMap(prev => !prev);
    };

    const toggleLineGauge = () => {
        setShowLineGauge(prev => !prev);
    };

    const toggleAutoZoom = () => {
        setAutoZoom(prev => !prev);
    };

    const togglePlanningMode = () => {
        resumePlanningOnNextLine.current = false;
        setPlanningMode(prev => {
            const next = !prev;
            if (!next) {
                setDubinsPath(null);
                lastDubinsUpdate.current = 0;
            }
            return next;
        });
    };

    const updateRuntimeSettings = (next) => {
        setRuntimeSettings(next);
        localStorage.setItem('runtimeSettings', JSON.stringify(next));
    };

    const resetRuntimeSettings = () => {
        localStorage.removeItem('runtimeSettings');
        setRuntimeSettings({
            crosshair: config.crosshair,
            limits: config.limits,
            dubins: config.dubins,
            summaryAutoCloseSeconds: config.summaryAutoCloseSeconds,
        });
    };

    // Planning mode only applies to the big map — clear it if the HUD view is shown
    useEffect(() => {
        if (!mapMaximized && planningMode) {
            setPlanningMode(false);
            setDubinsPath(null);
            lastDubinsUpdate.current = 0;
        }
    }, [mapMaximized, planningMode]);

    // Planning mode is unavailable while recording — stop it as soon as flight starts,
    // remembering it was active so it can resume automatically on the next line
    useEffect(() => {
        if (flightStatus === 'flying' && planningMode) {
            resumePlanningOnNextLine.current = true;
            setPlanningMode(false);
            setDubinsPath(null);
            lastDubinsUpdate.current = 0;
        }
    }, [flightStatus, planningMode]);

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
            const savedFileName = localStorage.getItem('customFileName') || 'custom.kml';
            try {
                const parsedLines = parseFlightFile(savedFileName, savedKml);
                setLines(parsedLines);
                setMissionFileName(savedFileName);
                showToast("Loaded Custom Flight File", "success");
                return;
            } catch (e) {
                console.error("Failed to parse saved flight file", e);
                showToast(`Error in Saved File: ${e.message}`, "error");
                localStorage.removeItem('customKml');
                localStorage.removeItem('customFileName');
            }
        }

        // Fallback to default
        fetch(config.kmlFilePath)
            .then(res => res.text())
            .then(text => {
                const parsedLines = applyGeoidUndulation(parseKML(text)).map(l => ({ ...l, section: 1 }))
                setLines(parsedLines)
                setMissionFileName(config.kmlFilePath.split('/').pop())
            })
            .catch(err => console.error("Failed to load KML", err))
    }, [])

    useEffect(() => {
        fetch(`${config.bundledKmlDir}manifest.json`)
            .then(res => res.json())
            .then(files => setBundledKmlFiles(files))
            .catch(err => console.error("Failed to load bundled KML list", err))
    }, [])

    // Sections available in the loaded flight file, sorted ascending.
    const sections = [...new Set(lines.map(l => l.section))].sort((a, b) => a - b);

    // Default to the first section whenever the loaded lines no longer match the current selection.
    useEffect(() => {
        if (sections.length > 0 && !sections.includes(currentSection)) {
            setCurrentSection(sections[0]);
        } else if (sections.length === 0) {
            setCurrentSection(null);
        }
    }, [sections, currentSection])

    const handleSectionSelect = (section) => {
        setCurrentSection(section);
        setCurrentLine(null);
        resetFlightState();
    };

    const handleBundledKmlSelect = (filename) => {
        if (!filename) return;
        fetch(`${config.bundledKmlDir}${filename}`)
            .then(res => res.text())
            .then(content => {
                const parsedLines = parseFlightFile(filename, content);
                setLines(parsedLines);
                setMissionFileName(filename);
                localStorage.setItem('customKml', content);
                localStorage.setItem('customFileName', filename);
                setCurrentLine(null);
                setCurrentSection(null);
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
                const parsedLines = parseFlightFile(file.name, content);
                setLines(parsedLines);
                setMissionFileName(file.name);
                localStorage.setItem('customKml', content);
                localStorage.setItem('customFileName', file.name);
                setCurrentLine(null);
                setCurrentSection(null);
                resetFlightState();
                showToast("Sucessfully Imported Flight File", "success");
            } catch (err) {
                showToast(`Error: ${err.message}`, "error");
                console.error(err);
            }
        };
        reader.readAsText(file);
    };

    // Resets flight progress on the currently loaded mission (completed lines, flight
    // logs, in-progress recording) without unloading the mission itself — as if it had
    // just been loaded for the first time.
    const resetMission = () => {
        if (simulating) {
            gpsEmulator.stopSimulation();
            setSimulating(false);
        }
        setCurrentLine(null);
        resetFlightState();
        flightLogger.clearHistory();
        setCompletedLines(new Set());
        setCurrentSection(sections.length > 0 ? sections[0] : null);
        setShowSummary(false);
        setLastSession(null);
        showToast("Mission Reset", "success");
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

    // Global mouse and touch handlers for Line Gauge dragging
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDraggingGauge.current) {
                const deltaX = e.clientX - dragStartGauge.current.x;
                const deltaY = dragStartGauge.current.y - e.clientY;

                setLineGaugePos(prev => ({
                    left: prev.left + deltaX,
                    bottom: prev.bottom + deltaY
                }));

                dragStartGauge.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleTouchMove = (e) => {
            if (isDraggingGauge.current && e.touches.length > 0) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - dragStartGauge.current.x;
                const deltaY = dragStartGauge.current.y - touch.clientY;

                setLineGaugePos(prev => ({
                    left: prev.left + deltaX,
                    bottom: prev.bottom + deltaY
                }));

                dragStartGauge.current = { x: touch.clientX, y: touch.clientY };
                e.preventDefault();
            }
        };

        const handleMouseUp = () => {
            isDraggingGauge.current = false;
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
        chunkQuality.current.clear();
        prevAlongTrack.current = null;
    };

    const handleLineSelect = (line) => {
        // If already flying a line, finish it first
        if (flightStatus === 'flying' && currentLine) {
            finishFlight();
        }

        setCurrentLine(line);
        if (line.section !== currentSection) {
            setCurrentSection(line.section);
        }
        resetFlightState();

        // Force an immediate Dubins replan for the newly selected line
        if (planningMode) {
            lastDubinsUpdate.current = 0;
        } else if (resumePlanningOnNextLine.current) {
            // Planning was switched off automatically when recording started —
            // resume it for the newly selected line without requiring another button press
            setPlanningMode(true);
            lastDubinsUpdate.current = 0;
        }
        resumePlanningOnNextLine.current = false;
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
            next.delete(`${currentSection}-${seq}`);
            return next;
        });

        // Optionally auto-select it if no line is currently selected
        const line = lines.find(l => l.section === currentSection && l.seq === seq);
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
        flightLogger.endFlight(currentLine.seq, completionPct, direction, currentLine.section);
        const session = flightLogger.getLastSession();
        setLastSession(session);
        setShowSummary(true);
        completionLock.current = false;
    }

    const advanceToNextLine = () => {
        if (!currentLine) return;
        const nextSeq = currentLine.seq + 1;
        const nextLine = lines.find(l => l.section === currentLine.section && l.seq >= nextSeq && !completedLines.has(`${l.section}-${l.seq}`));
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
            next.add(`${currentLine.section}-${seqToAdd}`);
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

            const postEnd = {
                lat: end.lat + (end.lat - start.lat) * config.simulation.preStartDistanceFactor,
                lon: end.lon + (end.lon - start.lon) * config.simulation.preStartDistanceFactor,
                alt: end.alt
            };

            gpsEmulator.startSimulation(preStart, postEnd, config.simulation.speedKnots, (pos) => {
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
        const nearEndpoint = distToStart <= runtimeSettings.limits.start_radius || distToEnd <= runtimeSettings.limits.start_radius;

        // Only allow auto-start near the start of the line, not the end (e.g. overshooting
        // past the endpoint in simulation shouldn't immediately re-trigger recording).
        const totalLen = calculateDistance(start.lat, start.lon, end.lat, end.lon) * 1000;
        const alongTrack = calculateAlongTrackDistance(gpsData, start, end);
        if (alongTrack >= totalLen) return;

        if (nearEndpoint &&
            Math.abs(crossTrackDist) <= runtimeSettings.limits.green &&
            Math.abs(altDiff) <= runtimeSettings.limits.vertical_green &&
            Math.abs(headingDiff) <= runtimeSettings.limits.heading_green) {
            resetFlightState();
            setFlightStatus('flying');
            flightLogger.startFlight();
            showToast("Recording Started", "success");
        }
    }, [gpsData, flightStatus, currentLine, direction, runtimeSettings.limits]);

    // Dubins path recompute (throttled) while in planning mode
    useEffect(() => {
        if (!planningMode || !currentLine || gpsData.lat === 0) return;
        const now = Date.now();
        if (now - lastDubinsUpdate.current < runtimeSettings.dubins.updateIntervalSeconds * 1000) return;
        lastDubinsUpdate.current = now;

        const start = direction === 'normal' ? currentLine.start : currentLine.end;
        const end = direction === 'normal' ? currentLine.end : currentLine.start;
        const lineBearing = calculateBearing(start.lat, start.lon, end.lat, end.lon);
        const target = destinationPoint(start.lat, start.lon, (lineBearing + 180) % 360, runtimeSettings.dubins.approachDistance);
        const path = planDubinsPath(
            { lat: gpsData.lat, lon: gpsData.lon, heading: gpsData.heading },
            { lat: target.lat, lon: target.lon, heading: lineBearing },
            runtimeSettings.dubins.minRadius
        );
        if (path) {
            path.points = [...path.points, { lat: start.lat, lon: start.lon }];
        }
        setDubinsPath(path);
    }, [planningMode, gpsData, currentLine, direction, runtimeSettings.dubins]);

    // Auto-exit planning mode once on-line with green heading
    useEffect(() => {
        if (!planningMode || !currentLine || gpsData.lat === 0) return;

        const start = direction === 'normal' ? currentLine.start : currentLine.end;
        const end = direction === 'normal' ? currentLine.end : currentLine.start;
        const crossTrackDist = calculateCrossTrackDistance(gpsData, start, end);
        const lineBearing = calculateBearing(start.lat, start.lon, end.lat, end.lon);
        let headingDiff = gpsData.heading - lineBearing;
        while (headingDiff < -180) headingDiff += 360;
        while (headingDiff > 180) headingDiff -= 360;

        if (Math.abs(crossTrackDist) <= runtimeSettings.limits.green && Math.abs(headingDiff) <= runtimeSettings.limits.heading_green) {
            setPlanningMode(false);
            setDubinsPath(null);
        }
    }, [planningMode, gpsData, currentLine, direction, runtimeSettings.limits]);

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
        if (Math.abs(crossTrackDist) <= runtimeSettings.limits.green) {
            if (prevAlongTrack.current !== null) {
                const startRange = Math.min(prevAlongTrack.current, currentAlongTrack);
                const endRange = Math.max(prevAlongTrack.current, currentAlongTrack);
                for (let m = Math.floor(startRange); m <= Math.floor(endRange); m++) {
                    greenCoverage.current.add(m);
                }
            }
        }

        // Update per-chunk quality (worst quality ever seen wins) for map track coloring
        if (prevAlongTrack.current !== null) {
            const quality = classifyQuality(crossTrackDist, altDiff, runtimeSettings.limits);
            const segLen = config.qualitySegmentLength;
            const startChunk = Math.floor(Math.min(prevAlongTrack.current, currentAlongTrack) / segLen);
            const endChunk = Math.floor(Math.max(prevAlongTrack.current, currentAlongTrack) / segLen);
            for (let c = startChunk; c <= endChunk; c++) {
                chunkQuality.current.set(c, worseQuality(chunkQuality.current.get(c), quality));
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
    }, [gpsData, flightStatus, currentLine, direction, runtimeSettings.limits]);

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

    const sectionLines = lines.filter(l => l.section === currentSection);
    const availableLines = sectionLines.filter(l => !completedLines.has(`${l.section}-${l.seq}`));

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
                    missionFileName={missionFileName}
                    lines={availableLines}
                    currentLine={currentLine}
                    onLineSelect={handleLineSelect}
                    direction={direction}
                    onDirectionToggle={toggleDirection}
                    completedLines={sectionLines.filter(l => completedLines.has(`${l.section}-${l.seq}`))}
                    onLineRestore={handleLineRestore}
                    // Section Props
                    sections={sections}
                    currentSection={currentSection}
                    onSectionSelect={handleSectionSelect}
                    // Flight Control Props
                    flightStatus={flightStatus}
                    onToggleFlight={toggleFlight}
                    // Menu Props
                    simulating={simulating}
                    onToggleSimulation={toggleSimulation}
                    onDownloadCSV={() => flightLogger.downloadCSV(missionFileName)}
                    onDownloadKMZ={() => downloadKMZ(flightLogger.history, missionFileName)}
                    onKmlImport={handleKmlImport}
                    onResetMission={resetMission}
                    onOpenSettings={() => setShowSettings(true)}
                    bundledKmlFiles={bundledKmlFiles}
                    onBundledKmlSelect={handleBundledKmlSelect}
                    // Map View Props
                    mapMaximized={mapMaximized}
                    onToggleMapMaximized={() => setMapMaximized(prev => !prev)}
                    // Planning Mode Props
                    planningMode={planningMode}
                    onTogglePlanningMode={togglePlanningMode}
                />
            </div>

            {showSummary && lastSession && (
                <SummaryDialog
                    session={lastSession}
                    onKeep={handleKeep}
                    onReject={handleReject}
                    autoCloseSeconds={runtimeSettings.summaryAutoCloseSeconds}
                />
            )}

            {showSettings && (
                <SettingsDialog
                    settings={runtimeSettings}
                    onSave={updateRuntimeSettings}
                    onReset={resetRuntimeSettings}
                    onClose={() => setShowSettings(false)}
                    units={units}
                    onToggleUnits={() => setUnits(u => u === 'metric' ? 'imperial' : 'metric')}
                    showMiniMap={showMiniMap}
                    onToggleMiniMap={toggleMiniMap}
                    showLineGauge={showLineGauge}
                    onToggleLineGauge={toggleLineGauge}
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
                        <Suspense fallback={null}>
                            <FullMap
                                lines={lines}
                                completedLines={completedLines}
                                currentLine={currentLine}
                                gpsData={gpsData}
                                direction={direction}
                                onLineSelect={handleLineSelect}
                                dubinsPath={dubinsPath}
                                autoZoom={autoZoom}
                                onToggleAutoZoom={toggleAutoZoom}
                                initialBounds={lastMapBounds.current}
                                onBoundsChange={(bounds) => { lastMapBounds.current = bounds; }}
                                flightStatus={flightStatus}
                                chunkQuality={Object.fromEntries(chunkQuality.current)}
                                qualitySegmentLength={config.qualitySegmentLength}
                            />
                        </Suspense>
                        {currentLine && (
                            <DistanceDisplay
                                {...renderHudData}
                                units={units}
                                limits={runtimeSettings.limits}
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
                            limits={runtimeSettings.limits}
                            crosshair={runtimeSettings.crosshair}
                            onLayout={({ hudCenterX, canvasWidth, compassRadius }) => {
                                setHudHorizontalOffset(hudCenterX - canvasWidth / 2);
                                setHudRadius(compassRadius);
                            }}
                        />
                        <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%' }}>
                            <HUD
                                {...renderHudData}
                                units={units}
                                limits={runtimeSettings.limits}
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
                                    flightStatus={flightStatus}
                                    chunkQuality={Object.fromEntries(chunkQuality.current)}
                                    qualitySegmentLength={config.qualitySegmentLength}
                                />
                            </div>
                        )}

                        {/* Line Gauge Overlay */}
                        {showLineGauge && currentLine && (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: `${lineGaugePos.bottom}px`,
                                    left: `${lineGaugePos.left}px`,
                                    width: '40px',
                                    height: `${hudRadius * 2}px`,
                                    zIndex: 20,
                                    cursor: isDraggingGauge.current ? 'grabbing' : 'grab',
                                    userSelect: 'none',
                                    touchAction: 'none'
                                }}
                                onMouseDown={(e) => {
                                    isDraggingGauge.current = true;
                                    dragStartGauge.current = { x: e.clientX, y: e.clientY };
                                    e.preventDefault();
                                }}
                                onTouchStart={(e) => {
                                    if (e.touches.length > 0) {
                                        isDraggingGauge.current = true;
                                        const touch = e.touches[0];
                                        dragStartGauge.current = { x: touch.clientX, y: touch.clientY };
                                        e.preventDefault();
                                    }
                                }}
                            >
                                <LineGauge
                                    currentLine={currentLine}
                                    direction={direction}
                                    gpsData={gpsData}
                                    onClose={toggleLineGauge}
                                    flightStatus={flightStatus}
                                    chunkQuality={Object.fromEntries(chunkQuality.current)}
                                    qualitySegmentLength={config.qualitySegmentLength}
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
