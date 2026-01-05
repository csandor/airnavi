import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'inline',
            includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'lines.kml', 'vite.svg'],
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
                globPatterns: ['**/*.{js,css,html,ico,png,svg,kml}'],
                cleanupOutdatedCaches: true
            }
        })
    ],
})
