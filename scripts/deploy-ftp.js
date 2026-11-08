// Uploads dist/ to the viamap FTP host (https://new.viamap.hu/airnavi/). Run via `npm run deploy`
// (which builds first).
//
// Connection settings come from env vars FTP_HOST / FTP_USER / FTP_PASSWORD / FTP_REMOTE_PATH /
// FTP_SECURE, falling back to the gitignored .vscode/ftp-sync.json used by the VS Code
// ftp-sync extension, so credentials never live in the repo.
//
// The ~250 MB offline basemap package (osm/osm.zip) is only re-uploaded when its size differs
// from the remote copy. Nothing on the server is deleted; old hashed files in assets/ stay
// behind (harmless, never referenced by the new index.html).
import { Client } from 'basic-ftp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const LARGE_UNCHANGED_CHECK = new Set(['osm/osm.zip']);

const loadSettings = () => {
    let file = {};
    const vscodeConfig = path.join(root, '.vscode', 'ftp-sync.json');
    if (fs.existsSync(vscodeConfig)) file = JSON.parse(fs.readFileSync(vscodeConfig, 'utf8'));
    const settings = {
        host: process.env.FTP_HOST || file.host,
        user: process.env.FTP_USER || file.username,
        password: process.env.FTP_PASSWORD || file.password,
        port: Number(process.env.FTP_PORT || file.port || 21),
        secure: process.env.FTP_SECURE ? process.env.FTP_SECURE === 'true' : Boolean(file.secure),
        remotePath: (process.env.FTP_REMOTE_PATH || file.remotePath || '').replace(/^\.\//, ''),
    };
    const missing = ['host', 'user', 'password', 'remotePath'].filter(k => !settings[k]);
    if (missing.length) {
        throw new Error(`Missing FTP settings: ${missing.join(', ')} (set FTP_* env vars or .vscode/ftp-sync.json)`);
    }
    return settings;
};

const listFiles = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(path.join(dir, entry.name), rel) : [rel];
});

const main = async () => {
    if (!fs.existsSync(path.join(distDir, 'index.html'))) throw new Error('dist/ is empty; run npm run build first');
    const settings = loadSettings();
    const files = listFiles(distDir);
    // index.html last, so a half-finished upload never points at assets that aren't there yet
    files.sort((a, b) => (a === 'index.html') - (b === 'index.html') || a.localeCompare(b));

    const client = new Client(60_000);
    try {
        await client.access({ host: settings.host, port: settings.port, user: settings.user, password: settings.password, secure: settings.secure });
        const base = `/${settings.remotePath.replace(/^\/|\/$/g, '')}`;
        console.log(`Uploading ${files.length} files to ${settings.host}:${base}`);

        for (const rel of files) {
            const local = path.join(distDir, rel);
            const remote = `${base}/${rel}`;
            if (LARGE_UNCHANGED_CHECK.has(rel)) {
                const localSize = fs.statSync(local).size;
                const remoteSize = await client.size(remote).catch(() => -1);
                if (remoteSize === localSize) {
                    console.log(`  skip ${rel} (unchanged size)`);
                    continue;
                }
            }
            await client.ensureDir(path.posix.dirname(remote));
            await client.uploadFrom(local, path.posix.basename(remote));
            console.log(`  ${rel}`);
        }
        console.log('Deploy complete.');
    } finally {
        client.close();
    }
};

main().catch(err => {
    console.error(`Deploy failed: ${err.message}`);
    process.exit(1);
});
