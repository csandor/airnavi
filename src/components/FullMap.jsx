import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol, PMTiles, FileSource } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { calculateAlongTrackDistance } from '../utils/GeoUtils';
import { QUALITY_COLORS } from '../utils/QualityUtils';
import config from '../config';
import { readOsmAsset, ensureOsmAssets } from '../utils/OsmAssets';

const DEFAULT_PATH_COLOR = 'rgba(255, 200, 0, 0.6)';

const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

// Serves sprite/glyph assets unpacked into OPFS (see src/utils/OsmAssets.js) to MapLibre.
// For type: 'json' requests (the sprite JSON), MapLibre expects `data` to already be the
// parsed object rather than raw bytes — unlike arrayBuffer/image requests, it does not parse
// the response itself for custom protocols the way it does for plain fetch().
maplibregl.addProtocol('osm-asset', async (params) => {
    const relativePath = decodeURIComponent(params.url.replace('osm-asset://', ''));
    const file = await readOsmAsset(relativePath);
    if (params.type === 'json') return { data: JSON.parse(await file.text()) };
    return { data: await file.arrayBuffer() };
});

// Loads the MapLibre style unpacked into OPFS and points its vector source at a PMTiles
// instance backed by the local OPFS file (random-access reads, no network, no full-file load).
const loadOsmStyle = async ({ onProgress } = {}) => {
    await ensureOsmAssets({ onProgress });

    const styleFile = await readOsmAsset(config.osmStyleFileName);
    const style = JSON.parse(await styleFile.text());

    const pmtilesFile = await readOsmAsset(config.osmPmtilesFileName);
    pmtilesProtocol.add(new PMTiles(new FileSource(pmtilesFile)));
    style.sources.openmaptiles.url = `pmtiles://${config.osmPmtilesFileName}`;

    return style;
};

const lineKey = (line) => `${line.section}-${line.seq}`;

const lineToGeoJSON = (line) => ({
    type: 'Feature',
    properties: { key: lineKey(line), seq: line.seq, section: line.section },
    geometry: {
        type: 'LineString',
        coordinates: [[line.start.lon, line.start.lat], [line.end.lon, line.end.lat]]
    }
});

const lineToLabelGeoJSON = (line, completed = false) => ({
    type: 'Feature',
    properties: { key: lineKey(line), seq: line.seq, section: line.section, label: lineKey(line), completed },
    geometry: {
        type: 'Point',
        coordinates: [(line.start.lon + line.end.lon) / 2, (line.start.lat + line.end.lat) / 2]
    }
});

const FullMap = ({ lines, completedLines, currentLine, gpsData, direction, onLineSelect, dubinsPath, autoZoom = true, onToggleAutoZoom, initialBounds, onBoundsChange, flightStatus, chunkQuality, qualitySegmentLength = 10 }) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(null);
    const [downloadError, setDownloadError] = useState(null);
    const autoZoomRef = useRef(autoZoom);
    useEffect(() => { autoZoomRef.current = autoZoom; }, [autoZoom]);

    // Init map once
    useEffect(() => {
        let cancelled = false;
        let map = null;
        let cleanup = () => {};

        loadOsmStyle({ onProgress: (p) => !cancelled && setDownloadProgress(p) }).then(style => {
            if (cancelled) return;
            setDownloadProgress(null);
            map = new maplibregl.Map({
                container: containerRef.current,
                style,
                attributionControl: { compact: true }
            });
            mapRef.current = map;

            map.on('load', () => {
                if (initialBounds) {
                    map.fitBounds(initialBounds, { animate: false });
                }
                map.addSource('all-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'all-lines-layer',
                    type: 'line',
                    source: 'all-lines',
                    paint: { 'line-color': '#00e5ff', 'line-width': 4, 'line-opacity': 0.9 }
                });

                map.addSource('completed-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'completed-lines-layer',
                    type: 'line',
                    source: 'completed-lines',
                    paint: { 'line-color': '#888888', 'line-width': 4, 'line-opacity': 0.7 }
                });

                map.addSource('line-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'line-labels-layer',
                    type: 'symbol',
                    source: 'line-labels',
                    layout: {
                        'text-field': ['get', 'label'],
                        'text-size': 16,
                        'text-font': ['Noto Sans Bold'],
                        'text-allow-overlap': true
                    },
                    paint: {
                        'text-color': ['case', ['get', 'completed'], '#aaaaaa', '#ffffff'],
                        'text-halo-color': '#000000',
                        'text-halo-width': 2
                    }
                });

                map.addSource('current-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'current-line-halo-layer',
                    type: 'line',
                    source: 'current-line',
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#000000', 'line-width': 10, 'line-opacity': 0.5 }
                });
                map.addLayer({
                    id: 'current-line-layer',
                    type: 'line',
                    source: 'current-line',
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#ff00c8', 'line-width': 6 }
                });

                map.addSource('endpoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'endpoints-layer',
                    type: 'circle',
                    source: 'endpoints',
                    paint: {
                        'circle-radius': 6,
                        'circle-color': ['get', 'color'],
                        'circle-stroke-color': '#000',
                        'circle-stroke-width': 1
                    }
                });

                map.addSource('path', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'path-layer',
                    type: 'line',
                    source: 'path',
                    paint: { 'line-color': ['coalesce', ['get', 'color'], DEFAULT_PATH_COLOR], 'line-width': 3 }
                });

                map.addSource('aircraft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'aircraft-layer',
                    type: 'circle',
                    source: 'aircraft',
                    paint: {
                        'circle-radius': 7,
                        'circle-color': '#00ccff',
                        'circle-stroke-color': '#000',
                        'circle-stroke-width': 1
                    }
                });

                map.addSource('dubins-path', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                map.addLayer({
                    id: 'dubins-path-halo-layer',
                    type: 'line',
                    source: 'dubins-path',
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#000000', 'line-width': 9, 'line-opacity': 0.5 }
                });
                map.addLayer({
                    id: 'dubins-path-layer',
                    type: 'line',
                    source: 'dubins-path',
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#ffaa00', 'line-width': 5, 'line-dasharray': [3, 3] }
                });

                setLoaded(true);
            });

            cleanup = () => {
                if (!autoZoomRef.current && onBoundsChange) {
                    const b = map.getBounds();
                    onBoundsChange([[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]]);
                }
                map.remove();
                mapRef.current = null;
            };
        }).catch(err => {
            if (!cancelled) setDownloadError(err.message || String(err));
        });

        return () => {
            cancelled = true;
            cleanup();
        };
    }, []);

    // Resize map when container size changes (e.g. on maximize)
    useEffect(() => {
        if (!mapRef.current) return;
        const ro = new ResizeObserver(() => mapRef.current && mapRef.current.resize());
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Draw all lines with number labels — completed lines render grey and separately from active ones
    useEffect(() => {
        if (!loaded || !mapRef.current) return;
        const map = mapRef.current;
        const activeLines = (lines || []).filter(l => !completedLines || !completedLines.has(l.seq));
        const doneLines = (lines || []).filter(l => completedLines && completedLines.has(l.seq));

        map.getSource('all-lines').setData({ type: 'FeatureCollection', features: activeLines.map(lineToGeoJSON) });
        map.getSource('completed-lines').setData({ type: 'FeatureCollection', features: doneLines.map(lineToGeoJSON) });
        map.getSource('line-labels').setData({
            type: 'FeatureCollection',
            features: [
                ...activeLines.map(l => lineToLabelGeoJSON(l, false)),
                ...doneLines.map(l => lineToLabelGeoJSON(l, true))
            ]
        });
    }, [loaded, lines, completedLines]);

    // Tap-to-select: click a line (or its label) to select it — completed lines are not selectable.
    // Queries a small box around the tap point rather than the exact pixel, since the rendered
    // lines are only a few px wide and hard to hit precisely on a touchscreen.
    useEffect(() => {
        if (!loaded || !mapRef.current || !onLineSelect) return;
        const map = mapRef.current;
        const layerIds = ['all-lines-layer', 'line-labels-layer', 'current-line-layer'];
        const HIT_RADIUS = 12; // px

        const hitBox = (point) => [
            [point.x - HIT_RADIUS, point.y - HIT_RADIUS],
            [point.x + HIT_RADIUS, point.y + HIT_RADIUS]
        ];

        const handleClick = (e) => {
            const features = map.queryRenderedFeatures(hitBox(e.point), { layers: layerIds });
            if (!features.length) return;
            const { seq, section } = features[0].properties;
            if (completedLines && completedLines.has(seq)) return;
            const line = (lines || []).find(l => l.seq === seq && l.section === section);
            if (line) onLineSelect(line);
        };

        const handleMove = (e) => {
            const features = map.queryRenderedFeatures(hitBox(e.point), { layers: layerIds });
            const selectable = features.length && !(completedLines && completedLines.has(features[0].properties.seq));
            map.getCanvas().style.cursor = selectable ? 'pointer' : '';
        };

        map.on('click', handleClick);
        map.on('mousemove', handleMove);

        return () => {
            map.off('click', handleClick);
            map.off('mousemove', handleMove);
        };
    }, [loaded, lines, completedLines, onLineSelect]);

    // Draw current line (highlighted), endpoints, path history, aircraft, and fit bounds
    // using the same bounds + 20% padding strategy as MiniMap.
    const pathRef = useRef([]);
    useEffect(() => {
        pathRef.current = [];
    }, [currentLine]);

    useEffect(() => {
        if (!loaded || !mapRef.current || !gpsData || gpsData.lat === 0) return;
        const prev = pathRef.current[pathRef.current.length - 1];
        if (!prev || Math.hypot(prev.lat - gpsData.lat, prev.lon - gpsData.lon) > 0.00003) {
            pathRef.current = [...pathRef.current, { lat: gpsData.lat, lon: gpsData.lon }];
        }
    }, [loaded, gpsData]);

    useEffect(() => {
        const map = mapRef.current;
        if (!loaded || !map) return;

        if (!currentLine) {
            map.getSource('current-line').setData({ type: 'FeatureCollection', features: [] });
            map.getSource('endpoints').setData({ type: 'FeatureCollection', features: [] });
            map.getSource('path').setData({ type: 'FeatureCollection', features: [] });
            map.getSource('aircraft').setData({ type: 'FeatureCollection', features: [] });

            if (autoZoom && lines && lines.length > 0) {
                let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
                lines.forEach(l => {
                    [l.start, l.end].forEach(p => {
                        minLat = Math.min(minLat, p.lat);
                        maxLat = Math.max(maxLat, p.lat);
                        minLon = Math.min(minLon, p.lon);
                        maxLon = Math.max(maxLon, p.lon);
                    });
                });
                const latRange = maxLat - minLat || 0.01;
                const lonRange = maxLon - minLon || 0.01;
                const paddingLat = latRange * 0.2;
                const paddingLon = lonRange * 0.2;
                map.fitBounds(
                    [[minLon - paddingLon, minLat - paddingLat], [maxLon + paddingLon, maxLat + paddingLat]],
                    { animate: false }
                );
            }
            return;
        }

        const start = direction === 'normal' ? currentLine.start : currentLine.end;
        const end = direction === 'normal' ? currentLine.end : currentLine.start;

        map.getSource('current-line').setData({ type: 'FeatureCollection', features: [lineToGeoJSON({ start, end, seq: currentLine.seq, section: currentLine.section })] });

        map.getSource('endpoints').setData({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: { color: '#00ff00' }, geometry: { type: 'Point', coordinates: [start.lon, start.lat] } },
                { type: 'Feature', properties: { color: '#ff0000' }, geometry: { type: 'Point', coordinates: [end.lon, end.lat] } }
            ]
        });

        const path = pathRef.current;
        let pathFeatures = [];
        if (path.length > 1) {
            if (flightStatus === 'flying' && chunkQuality) {
                // While recording, render one short segment per consecutive point pair,
                // colored by the worst quality recorded for the chunk it falls in.
                pathFeatures = [];
                for (let i = 1; i < path.length; i++) {
                    const prevPoint = path[i - 1];
                    const point = path[i];
                    const alongTrack = calculateAlongTrackDistance(point, start, end);
                    const chunk = Math.floor(alongTrack / qualitySegmentLength);
                    const quality = chunkQuality[chunk];
                    pathFeatures.push({
                        type: 'Feature',
                        properties: { color: quality ? QUALITY_COLORS[quality] : DEFAULT_PATH_COLOR },
                        geometry: { type: 'LineString', coordinates: [[prevPoint.lon, prevPoint.lat], [point.lon, point.lat]] }
                    });
                }
            } else {
                pathFeatures = [{
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: path.map(p => [p.lon, p.lat]) }
                }];
            }
        }
        map.getSource('path').setData({ type: 'FeatureCollection', features: pathFeatures });

        const hasAircraft = gpsData && gpsData.lat !== 0;
        map.getSource('aircraft').setData({
            type: 'FeatureCollection',
            features: hasAircraft ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [gpsData.lon, gpsData.lat] } }] : []
        });

        // Bounds: start, end, and aircraft position, padded 20% — same strategy as MiniMap.
        let minLat = Math.min(start.lat, end.lat);
        let maxLat = Math.max(start.lat, end.lat);
        let minLon = Math.min(start.lon, end.lon);
        let maxLon = Math.max(start.lon, end.lon);

        if (hasAircraft) {
            minLat = Math.min(minLat, gpsData.lat);
            maxLat = Math.max(maxLat, gpsData.lat);
            minLon = Math.min(minLon, gpsData.lon);
            maxLon = Math.max(maxLon, gpsData.lon);
        }

        if (!autoZoom) return;

        const latRange = maxLat - minLat || 0.01;
        const lonRange = maxLon - minLon || 0.01;
        const paddingLat = latRange * 0.2;
        const paddingLon = lonRange * 0.2;

        map.fitBounds(
            [[minLon - paddingLon, minLat - paddingLat], [maxLon + paddingLon, maxLat + paddingLat]],
            { animate: false }
        );
    }, [loaded, currentLine, gpsData, direction, lines, autoZoom, flightStatus, chunkQuality, qualitySegmentLength]);

    // Draw the planned Dubins path (planning mode overlay)
    useEffect(() => {
        const map = mapRef.current;
        if (!loaded || !map) return;
        const points = dubinsPath && dubinsPath.points;
        map.getSource('dubins-path').setData({
            type: 'FeatureCollection',
            features: points && points.length > 1 ? [{
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: points.map(p => [p.lon, p.lat]) }
            }] : []
        });
    }, [loaded, dubinsPath]);

    return (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            {(downloadProgress !== null || downloadError) && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 40,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        padding: '20px',
                        textAlign: 'center',
                        background: 'rgba(22, 27, 34, 0.92)',
                        color: 'white'
                    }}
                >
                    {downloadError ? (
                        <div>Failed to load offline map data: {downloadError}</div>
                    ) : (
                        <>
                            <div>Downloading offline map data… {Math.round(downloadProgress * 100)}%</div>
                            <div style={{ width: '70%', maxWidth: '260px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.round(downloadProgress * 100)}%`, height: '100%', background: '#00e5ff' }} />
                            </div>
                        </>
                    )}
                </div>
            )}
            <label
                style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    zIndex: 30,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    background: 'rgba(26, 42, 58, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'white',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
            >
                <input
                    type="checkbox"
                    checked={autoZoom}
                    onChange={onToggleAutoZoom}
                    style={{ margin: 0 }}
                />
                Auto Zoom
            </label>
        </div>
    );
};

export default FullMap;
