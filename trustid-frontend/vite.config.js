import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/rd-api': {
        target: 'https://api.prd.realitydefender.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rd-api/, '')
      },
      '/sightengine-api': {
        target: 'https://api.sightengine.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sightengine-api/, '')
      }
    }
  }
})
