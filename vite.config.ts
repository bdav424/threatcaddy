import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
// fs/promises imported dynamically in stripHeavyAssets to avoid top-level await
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Post-build: remove Excalidraw CJK font (Xiaolai = 16MB) from dist.
 * Chinese text rendering in whiteboards requires this font, but it's
 * too large to include in every deploy. Non-English locale files stay
 * in dist/ — they're lazy-loaded by i18next and only fetched when the
 * user switches language.
 */
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
      if (ctx.server) return html // skip in dev
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
    try {
      decoded = decodeURIComponent(pathname)
    } catch {
      return null
    }

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
        if (req.method === 'HEAD') {
          res.end()
          return
        }
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
        // Only precache the critical-path assets needed for first render.
        // Heavy lazy-loaded chunks (mermaid, cytoscape, leaflet, katex, etc.)
        // are cached at runtime on first use via runtimeCaching below.
        globPatterns: ['assets/**/*.{js,css}', '*.{ico,js}'],
        globIgnores: [
          '**/excalidraw-*',           // Whiteboard editor (1.1MB)
          '**/locales/**',             // i18n locale files (cached separately)
          'chunk-reload-guard.js',
          '**/flowchart-elk-*',        // Mermaid flowchart-elk (1.4MB)
          '**/subset-*',              // Mermaid shared subset (1.7MB)
          '**/sequenceDiagram-*',      // Mermaid sequence (82KB)
          '**/ganttDiagram-*',         // Mermaid gantt (59KB)
          '**/c4Diagram-*',            // Mermaid C4 (67KB)
          '**/createText-*',           // Mermaid text (59KB)
          '**/cytoscape-*',            // Graph library (507KB)
          '**/leaflet-*',             // Map library (163KB)
          '**/katex-*',               // Math rendering (255KB)
          '**/WhiteboardEditor-*',     // Whiteboard CSS (142KB)
          '**/search.worker-*',        // Search web worker (260KB)
          '**/SettingsPanel-*',        // Settings (lazy, 195KB)
          '**/IOCStatsView-*',         // IOC stats (lazy, 85KB)
          '**/TimelineView-*',         // Timeline (lazy, 73KB)
          '**/ChatView-*',             // Chat (lazy, 68KB)
        ],
        navigateFallback: null,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^.*\/api\/.*/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^.*\/ws.*/,
            handler: 'NetworkOnly',
          },
          {
            // Cache locale JSON files after first fetch
            urlPattern: /\/locales\/[^/]+\/[^/]+\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'i18n-locales',
              expiration: {
                maxEntries: 600,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            // Cache lazy-loaded JS/CSS chunks on first use — StaleWhileRevalidate
            // serves from cache instantly on repeat visits while fetching updates
            urlPattern: /\/assets\/.*\.(js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lazy-chunks',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
        ],
      },
    }),
  ],
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Excalidraw whiteboard + its transitive deps (mermaid-to-excalidraw, mermaid, elkjs).
          // Mermaid's own dynamic imports (flowchart-elk, subset-shared, etc.) still create
          // separate chunks — this prevents mermaid's static base from landing in index.
          if (id.includes('@excalidraw/') || id.includes('/mermaid/') || id.includes('/elkjs/')) {
            return 'excalidraw';
          }
          // Cytoscape graph library + cose-bilkent layout plugin.
          if (id.includes('/cytoscape/') || id.includes('/cytoscape-cose-bilkent/')) {
            return 'cytoscape';
          }
          // Markdown rendering utilities.
          if (id.includes('/marked/') || id.includes('/dompurify/')) {
            return 'markdown';
          }
          // Compression (pako — used for standalone locale bundles and backup crypto).
          if (id.includes('/pako/')) {
            return 'compression';
          }
          // Single shared vendor chunk for React and everything that is NOT a lazy heavy
          // lib carved out above (excalidraw/mermaid/elkjs, cytoscape, markdown, pako).
          // Splitting React away from its dependents (react-leaflet, router, i18next,
          // etc.) creates cross-chunk import cycles that break module init order and
          // froze production on the loading screen. Keeping the eager vendor graph in one
          // chunk is the robust fix: no cycle can straddle a chunk boundary.
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },
})
