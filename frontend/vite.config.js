import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import typescript from '@rollup/plugin-typescript'

export default defineConfig({
  plugins: [
    react(),
    typescript({
      tsconfig: './tsconfig.json',
      include: ['src/**/*'],
      compilerOptions: {
        // The plugin emits JS for bundling, which conflicts with this
        // tsconfig's editor-only noEmit/allowImportingTsExtensions pairing.
        allowImportingTsExtensions: false,
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
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
          } else if (fileName === 'index.html') {
            htmlAsset = assetInfo;
          }
        }

        if (htmlAsset && cssToInline.length > 0) {
          let newHtml = htmlAsset.source;
          for (const cssFile of cssToInline) {
            newHtml = newHtml.replace(
              new RegExp(`<link[^>]*?href="[./]*?${cssFile.fileName}"[^>]*?>`),
              ''
            );
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
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    minify: 'esbuild',
    assetsInlineLimit: 4096,
    target: 'es2020',
  },
});