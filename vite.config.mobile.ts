import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function stripHeavyAssets(): Plugin {
  return {
    name: 'strip-heavy-assets',
    apply: 'build',
    async closeBundle() {
      const xiaolaiDir = resolve('dist-mobile', 'fonts', 'Xiaolai')
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
  ],
  define: {
    'import.meta.env.VITE_EDITION': JSON.stringify('mobile'),
  },
  base: './',
  worker: { format: 'es' },
  build: {
    outDir: 'dist-mobile',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@excalidraw/') || id.includes('/mermaid/') || id.includes('/elkjs/')) {
            return 'excalidraw';
          }
          if (id.includes('/cytoscape/') || id.includes('/cytoscape-cose-bilkent/')) {
            return 'cytoscape';
          }
          if (id.includes('/marked/') || id.includes('/dompurify/')) {
            return 'markdown';
          }
          if (id.includes('/pako/')) {
            return 'compression';
          }
          // Single shared vendor chunk for React and everything that is NOT a lazy heavy
          // lib carved out above. Splitting React away from its dependents (react-leaflet,
          // router, i18next, etc. — react-leaflet was in a separate 'leaflet' chunk here)
          // creates cross-chunk import cycles that break module init order and freeze the
          // app on the loading screen. Matches the fix already applied in vite.config.ts.
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },
})
