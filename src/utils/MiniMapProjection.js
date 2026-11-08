// Web Mercator view fitting for the minimap. Using the same projection as MapLibre (which
// renders the OSM basemap underneath) keeps the canvas overlay and the map aligned exactly,
// and gives an undistorted (uniform-scale) picture even without a basemap.

const EARTH_CIRCUMFERENCE_M = 40075016.686;
const MAPLIBRE_TILE_SIZE = 512; // world width in px at zoom 0

const mercX = (lon) => (lon + 180) / 360;
const mercY = (lat) => {
    const s = Math.sin(lat * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const lonFromMercX = (x) => x * 360 - 180;
const latFromMercY = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;

/**
 * Fits `points` ({lat, lon}) into a width x height pixel box with `padding` (fraction of
 * the span on each side), never zooming in further than `minSpanMeters` across.
 * @returns {{toX: (lon:number)=>number, toY: (lat:number)=>number, view: {lon:number, lat:number, zoom:number}}}
 */
export const fitMercatorView = (points, width, height, { padding = 0.2, minSpanMeters = 500 } = {}) => {
    const xs = points.map(p => mercX(p.lon));
    const ys = points.map(p => mercY(p.lat));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const centerLat = latFromMercY(cy);

    // Mercator units are stretched by 1/cos(lat); convert the minimum span accordingly.
    const minSpan = minSpanMeters / (EARTH_CIRCUMFERENCE_M * Math.cos(centerLat * Math.PI / 180));
    const spanX = Math.max(maxX - minX, minSpan) * (1 + 2 * padding);
    const spanY = Math.max(maxY - minY, minSpan) * (1 + 2 * padding);
    const scale = Math.min(width / spanX, height / spanY); // px per Mercator unit

    return {
        toX: (lon) => (mercX(lon) - cx) * scale + width / 2,
        toY: (lat) => (mercY(lat) - cy) * scale + height / 2,
        view: { lon: lonFromMercX(cx), lat: centerLat, zoom: Math.log2(scale / MAPLIBRE_TILE_SIZE) },
    };
};
