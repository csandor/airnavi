import React, { useRef, useEffect, useState } from 'react';
import { maplibregl, loadOsmStyle } from '../utils/OsmStyle';
import 'maplibre-gl/dist/maplibre-gl.css';

// Non-interactive OSM basemap shown under the minimap's canvas. Lazy-loaded (MapLibre is
// heavy) and only rendered from the offline package already in OPFS: if the package isn't
// installed it renders nothing and never starts the download (that's FullMap's job).
// `view` = { lon, lat, zoom } computed by MiniMap from its Web Mercator projection, so the
// canvas overlay and the map line up exactly.
const MiniMapBasemap = ({ view, onReady }) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadOsmStyle({ download: false }).then(style => {
            if (cancelled || !style) return;
            const map = new maplibregl.Map({
                container: containerRef.current,
                style,
                interactive: false,
                attributionControl: false, // MiniMap prints a compact credit itself
                fadeDuration: 0,
            });
            mapRef.current = map;
            map.on('load', () => {
                if (cancelled) return;
                setReady(true);
                onReady?.(true);
            });
        }).catch(err => console.warn('Minimap basemap unavailable', err));
        return () => {
            cancelled = true;
            mapRef.current?.remove();
            mapRef.current = null;
            onReady?.(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map || !view) return;
        map.resize();
        map.jumpTo({ center: [view.lon, view.lat], zoom: view.zoom });
    }, [ready, view]);

    return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
};

export default MiniMapBasemap;
