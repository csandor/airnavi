#!/usr/bin/env node
// Assembles public/osm/osm.zip from the tracked MapLibre style (src/osm/liberty-style.json)
// plus the gitignored binary assets in osm-assets/ (fonts, sprites, the PMTiles archive).
// Run after editing the style, or after replacing/regenerating osm-assets/*.pmtiles.
// Remember to bump config.osmPackageVersion so installed clients re-download the package.

import { zip } from 'fflate';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ASSETS_DIR = join(ROOT, 'osm-assets');
const STYLE_PATH = join(ROOT, 'src/osm/liberty-style.json');
const OUTPUT_PATH = join(ROOT, 'public/osm/osm.zip');

function collectFiles(dir, base = dir) {
    const entries = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            entries.push(...collectFiles(full, base));
        } else {
            entries.push(full);
        }
    }
    return entries;
}

const files = {};
for (const path of collectFiles(ASSETS_DIR)) {
    const key = relative(ASSETS_DIR, path).split('\\').join('/'); // Windows path separators
    files[key] = readFileSync(path);
}
files['style.json'] = readFileSync(STYLE_PATH);

console.log(`Zipping ${Object.keys(files).length} files from ${ASSETS_DIR} + ${STYLE_PATH}...`);

zip(files, { level: 6, mem: 8 }, (err, data) => {
    if (err) throw err;
    writeFileSync(OUTPUT_PATH, data);
    console.log(`Wrote ${OUTPUT_PATH} (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
});
