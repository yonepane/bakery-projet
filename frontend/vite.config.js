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
    }),
    {
      name: 'inline-css',
      enforce: 'post',
      generateBundle(options, bundle) {
        let cssToInline = [];
        let htmlAsset = null;

        for (const [fileName, assetInfo] of Object.entries(bundle)) {
          if (fileName.endsWith('.css')) {
            cssToInline.push(assetInfo);
            // Optionally, we can remove the CSS file from the bundle so it's not emitted:
            // delete bundle[fileName];
          } else if (fileName === 'index.html') {
            htmlAsset = assetInfo;
          }
        }

        if (htmlAsset && cssToInline.length > 0) {
          let newHtml = htmlAsset.source;
          for (const cssFile of cssToInline) {
            // Remove the link tag
            newHtml = newHtml.replace(
              new RegExp(`<link[^>]*?href="[./]*?${cssFile.fileName}"[^>]*?>`),
              ''
            );
            // Inject the style tag right before </head>
            newHtml = newHtml.replace(
              '</head>',
              `<style>${cssFile.source}</style></head>`
            );
          }
          htmlAsset.source = newHtml;
        }
      }
    }
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // During local development, Vite forwards API traffic to FastAPI.
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    // Use esbuild minifier (faster, good tree-shaking).
    minify: 'esbuild',
    // Inline small assets to save round-trips.
    assetsInlineLimit: 4096,
  }
});
