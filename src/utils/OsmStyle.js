import maplibregl from 'maplibre-gl';
import { Protocol, PMTiles, FileSource } from 'pmtiles';
import config from '../config';
import { readOsmAsset, ensureOsmAssets, hasOsmAssets } from './OsmAssets';

// MapLibre plumbing for the offline OSM basemap, shared by FullMap and the minimap's
// basemap. Imports maplibre-gl, so only lazy-loaded components should import this module
// (it would otherwise pull MapLibre into the main bundle).

const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

// Serves sprite/glyph assets unpacked into OPFS (see OsmAssets.js) to MapLibre.
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
// With download: false it never fetches the package and resolves to null when it isn't
// installed yet (the minimap must not trigger a 246 MB download on its own).
export const loadOsmStyle = async ({ onProgress, download = true } = {}) => {
    if (download) {
        await ensureOsmAssets({ onProgress });
    } else if (!(await hasOsmAssets())) {
        return null;
    }

    const styleFile = await readOsmAsset(config.osmStyleFileName);
    const style = JSON.parse(await styleFile.text());

    const pmtilesFile = await readOsmAsset(config.osmPmtilesFileName);
    pmtilesProtocol.add(new PMTiles(new FileSource(pmtilesFile)));
    style.sources.openmaptiles.url = `pmtiles://${config.osmPmtilesFileName}`;

    return style;
};

export { maplibregl };
