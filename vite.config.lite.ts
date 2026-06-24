import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function stripHeavyAssets(): Plugin {
  return {
    name: 'strip-heavy-assets',
    apply: 'build',
    async closeBundle() {
      const xiaolaiDir = resolve('dist-lite', 'fonts', 'Xiaolai')
      if (existsSync(xiaolaiDir)) {
        const { rm } = await import('node:fs/promises')
        await rm(xiaolaiDir, { recursive: true }).catch(() => {})
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    stripHeavyAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['assets/**/*.{js,css}', '*.{ico,js}'],
        globIgnores: [
          '**/excalidraw-*',
          '**/locales/**',
          'chunk-reload-guard.js',
          '**/flowchart-elk-*',
          '**/subset-*',
          '**/sequenceDiagram-*',
          '**/ganttDiagram-*',
          '**/c4Diagram-*',
          '**/createText-*',
          '**/cytoscape-*',
          '**/leaflet-*',
          '**/katex-*',
          '**/WhiteboardEditor-*',
          '**/search.worker-*',
          '**/SettingsPanel-*',
          '**/IOCStatsView-*',
          '**/TimelineView-*',
          '**/ChatView-*',
        ],
        navigateFallback: null,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /^.*\/api\/.*/, handler: 'NetworkOnly' },
          { urlPattern: /^.*\/ws.*/, handler: 'NetworkOnly' },
          {
            urlPattern: /\/locales\/[^/]+\/[^/]+\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'i18n-locales', expiration: { maxEntries: 600, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /\/assets\/.*\.(js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'lazy-chunks', expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
  define: {
    'import.meta.env.VITE_EDITION': JSON.stringify('lite'),
  },
  base: './',
  worker: { format: 'es' },
  build: {
    outDir: 'dist-lite',
    rollupOptions: {
      output: {
        manualChunks: {
          excalidraw: ['@excalidraw/excalidraw'],
          cytoscape: ['cytoscape', 'cytoscape-cose-bilkent'],
          leaflet: ['leaflet', 'react-leaflet'],
          markdown: ['marked', 'dompurify'],
          compression: ['pako'],
        },
      },
    },
  },
})
