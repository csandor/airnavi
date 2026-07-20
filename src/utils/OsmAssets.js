import { Unzip, UnzipInflate } from 'fflate';
import config from '../config';

// Offline OSM basemap assets (PMTiles archive, MapLibre style, sprites, fonts) are downloaded
// once as a zip from config.osmPackageUrl and unpacked into the Origin Private File System
// (OPFS), so the app can render the basemap fully offline after the first successful download.
// OPFS gives us random-access byte reads on a 200MB+ file without holding it in memory
// (unlike Cache API / IndexedDB blobs), which the pmtiles library needs for range reads.

const OSM_DIR = 'osm';

async function getOsmDir({ create = false } = {}) {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OSM_DIR, { create });
}

async function writeFile(dirHandle, relativePath, stream) {
    const parts = relativePath.split('/');
    const fileName = parts.pop();
    let dir = dirHandle;
    for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await stream.pipeTo(writable);
}

const VERSION_FILE = '.package-version';

// The package is considered installed only if the PMTiles archive is present AND the stored
// version marker matches config.osmPackageVersion — bumping that constant forces a re-download
// (e.g. after fixing the style without needing to reship the 246MB tile archive unnecessarily).
export async function hasOsmAssets() {
    try {
        const dir = await getOsmDir();
        await dir.getFileHandle(config.osmPmtilesFileName);
        const versionHandle = await dir.getFileHandle(VERSION_FILE);
        const installedVersion = await (await versionHandle.getFile()).text();
        return installedVersion === String(config.osmPackageVersion);
    } catch {
        return false;
    }
}

// Downloads config.osmPackageUrl and streams each zip entry directly into OPFS, reporting
// progress (0-1, based on compressed bytes received) via onProgress.
export async function downloadOsmAssets({ onProgress } = {}) {
    const dir = await getOsmDir({ create: true });
    const response = await fetch(config.osmPackageUrl);
    if (!response.ok) throw new Error(`Failed to download OSM package: HTTP ${response.status}`);
    const total = Number(response.headers.get('Content-Length')) || 0;
    let received = 0;
    onProgress?.(0);

    const writes = [];
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (file) => {
        if (file.name.endsWith('/')) return; // directory entry, nothing to write
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        file.ondata = (err, chunk, final) => {
            if (err) { writer.abort(err); return; }
            writer.write(chunk);
            if (final) writer.close();
        };
        writes.push(writeFile(dir, file.name, readable));
        file.start();
    };

    const reader = response.body.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            unzip.push(new Uint8Array(0), true);
            break;
        }
        received += value.byteLength;
        if (total) onProgress?.(received / total);
        unzip.push(value, false);
    }

    await Promise.all(writes);

    const versionHandle = await dir.getFileHandle(VERSION_FILE, { create: true });
    const versionWritable = await versionHandle.createWritable();
    await versionWritable.write(String(config.osmPackageVersion));
    await versionWritable.close();
}

// Ensures the OSM package is present locally, downloading it first if necessary.
export async function ensureOsmAssets({ onProgress } = {}) {
    if (await hasOsmAssets()) return;
    await downloadOsmAssets({ onProgress });
}

// Reads a file already unpacked in OPFS. Returns a File (Blob) supporting lazy .slice() reads,
// suitable for pmtiles' FileSource or for building object URLs.
export async function readOsmAsset(relativePath) {
    const dir = await getOsmDir();
    const parts = relativePath.split('/');
    const fileName = parts.pop();
    let dirHandle = dir;
    for (const part of parts) {
        dirHandle = await dirHandle.getDirectoryHandle(part);
    }
    const fileHandle = await dirHandle.getFileHandle(fileName);
    return fileHandle.getFile();
}
