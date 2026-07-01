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
