import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

function stripHeavyAssets(): Plugin {
  return {
    name: 'strip-heavy-assets',
    apply: 'build',
    async closeBundle() {
      const xiaolaiDir = resolve('dist', 'fonts', 'Xiaolai')
      if (existsSync(xiaolaiDir)) {
        const { rm } = await import('node:fs/promises')
        await rm(xiaolaiDir, { recursive: true }).catch(() => {})
      }
    },
  }
}

function cloudflareAnalytics(): Plugin {
  return {
    name: 'cloudflare-analytics',
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html
      return html.replace(
        '</body>',
        `<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "beb9b5eaaaaf4808a367502ada8fd179"}'></script><!-- End Cloudflare Web Analytics -->\n</body>`
      )
    },
  }
}

function serveStandaloneBundle(): Plugin {
  const standaloneDir = resolve('dist-single')
  const indexPath = resolve(standaloneDir, 'index.html')

  const contentType = (fileName: string) => {
    if (fileName.endsWith('.html')) return 'text/html; charset=utf-8'
    if (fileName.endsWith('.js')) return 'text/javascript; charset=utf-8'
    return 'application/octet-stream'
  }

  const resolveStandaloneFile = (rawUrl: string | undefined) => {
    const pathname = (rawUrl || '').split('?')[0]
    if (pathname === '/threatcaddy-standalone.html') return indexPath
    let decoded: string
    try { decoded = decodeURIComponent(pathname) } catch { return null }
    const fileName = decoded.startsWith('/') ? decoded.slice(1) : decoded
    if (!fileName || fileName.includes('/') || fileName.includes('\\')) return null
    if (!fileName.endsWith('.js')) return null
    return resolve(standaloneDir, fileName)
  }

  return {
    name: 'serve-standalone-bundle',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method && req.method !== 'GET' && req.method !== 'HEAD') return next()
        const filePath = resolveStandaloneFile(req.url)
        if (!filePath) return next()
        const isStandaloneIndex = filePath === indexPath
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          if (!isStandaloneIndex) return next()
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end('Standalone bundle not built yet. Run <code>pnpm build:single</code>, then reload this URL.')
          return
        }
        res.statusCode = 200
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Content-Type', contentType(filePath))
        if (req.method === 'HEAD') { res.end(); return }
        res.end(readFileSync(filePath))
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    serveStandaloneBundle(),
    cloudflareAnalytics(),
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
    'import.meta.env.VITE_EDITION': JSON.stringify('pro'),
  },
  base: './',
  worker: { format: 'es' },
  build: {
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
