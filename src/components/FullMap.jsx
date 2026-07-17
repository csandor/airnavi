import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { calculateAlongTrackDistance } from '../utils/GeoUtils';
import { QUALITY_COLORS } from '../utils/QualityUtils';

const DEFAULT_PATH_COLOR = 'rgba(255, 200, 0, 0.6)';

const OSM_STYLE = {
    version: 8,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
        osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
        }
    },
    layers: [
        { id: 'osm', type: 'raster', source: 'osm' }
    ]
};

const lineToGeoJSON = (line) => ({
    type: 'Feature',
    properties: { seq: line.seq },
    geometry: {
        type: 'LineString',
        coordinates: [[line.start.lon, line.start.lat], [line.end.lon, line.end.lat]]
    }
});

const lineToLabelGeoJSON = (line, completed = false) => ({
    type: 'Feature',
    properties: { seq: line.seq, label: String(line.seq), completed },
    geometry: {
        type: 'Point',
        coordinates: [(line.start.lon + line.end.lon) / 2, (line.start.lat + line.end.lat) / 2]
    }
});

const FullMap = ({ lines, completedLines, currentLine, gpsData, direction, onLineSelect, dubinsPath, autoZoom = true, onToggleAutoZoom, flightStatus, chunkQuality, qualitySegmentLength = 10 }) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const [loaded, setLoaded] = useState(false);

    // Init map once
    useEffect(() => {
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: OSM_STYLE,
            attributionControl: { compact: true }
        });
        mapRef.current = map;

        map.on('load', () => {
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
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
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

        return () => {
            map.remove();
            mapRef.current = null;
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

    // Tap-to-select: click a line (or its label) to select it — completed lines are not selectable
    useEffect(() => {
        if (!loaded || !mapRef.current || !onLineSelect) return;
        const map = mapRef.current;
        const layerIds = ['all-lines-layer', 'line-labels-layer', 'current-line-layer'];

        const handleClick = (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: layerIds });
            if (!features.length) return;
            const seq = features[0].properties.seq;
            if (completedLines && completedLines.has(seq)) return;
            const line = (lines || []).find(l => l.seq === seq);
            if (line) onLineSelect(line);
        };

        const handleMove = (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: layerIds });
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

        map.getSource('current-line').setData({ type: 'FeatureCollection', features: [lineToGeoJSON({ start, end, seq: currentLine.seq })] });

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
