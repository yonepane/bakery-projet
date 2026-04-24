import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Keep the app installable and let the service worker refresh itself when
      // a new build is deployed.
      registerType: 'autoUpdate',
      workbox: {
        // Never let the PWA offline shell swallow real API requests.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'BakeryOS',
        short_name: 'BakeryOS',
        description: 'Modern Bakery Management System',
        theme_color: '#ffffff',
        icons: []
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        // During local development, Vite forwards API traffic to FastAPI.
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
