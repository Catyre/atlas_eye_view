import { defineConfig } from 'vite'
import inject from "@rollup/plugin-inject";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
      inject({   // => that should be first under plugins array
        $: 'jquery',
        jQuery: 'jquery',
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Galactic Hub Cartography',
          short_name: 'Hub Map',
          description: 'Interactive 3D navigation and telemetry data for the Galactic Hub.',
          theme_color: '#050510',
          background_color: '#050510',
          display: 'standalone',
          orientation: 'portrait',
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
        }
      })
  ],
  server: {
  allowedHosts: ['atlas-eye-view.ngrok.app'],
}
})
