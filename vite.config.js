import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Generates public/kml/manifest.json listing bundled sample KML files,
// so the app can offer them in the KML picker without a hardcoded list.
function kmlManifestPlugin() {
    const kmlDir = path.resolve(__dirname, 'public/kml')
    const manifestPath = path.join(kmlDir, 'manifest.json')

    const writeManifest = () => {
        const files = fs.readdirSync(kmlDir)
            .filter(f => f.toLowerCase().endsWith('.kml'))
            .sort()
        fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2))
    }

    return {
        name: 'kml-manifest',
        buildStart() {
            writeManifest()
        },
        configureServer(server) {
            writeManifest()
            server.watcher.add(kmlDir)
            server.watcher.on('all', (_event, file) => {
                if (file.startsWith(kmlDir) && file.endsWith('.kml')) writeManifest()
            })
        }
    }
}

// https://vite.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        kmlManifestPlugin(),
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'inline',
            includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'lines.kml', 'vite.svg', 'kml/*.kml', 'kml/manifest.json'],
            manifest: {
                name: 'AirNavi - Flight Navigator',
                short_name: 'AirNavi',
                description: 'Offline Flight Navigation Assistant',
                start_url: '.',
                display: 'standalone',
                background_color: '#161b22',
                theme_color: '#1a2a3a',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,kml,json}'],
                cleanupOutdatedCaches: true
            }
        })
    ],
})
