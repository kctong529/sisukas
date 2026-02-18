import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import ViteYaml from '@modyfi/vite-plugin-yaml';
import fs from 'fs'
import path from 'path'

const keyPath = path.resolve('./localhost-key.pem')
const certPath = path.resolve('./localhost.pem')
const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath)

export default defineConfig(({ mode }) => ({
  base: "/",
  plugins: [
    svelte(),
    ViteYaml(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
        ignoreURLParametersMatching: [/.*/],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/health(\.json)?$/,
          /^\/version\.json$/,
          /^\/robots\.txt$/,
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-assets',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Sisukas',
        short_name: 'Sisukas',
        start_url: '/',
        display: 'standalone'
      }
    })
  ],
  test: {
    environment: 'jsdom',
  },
  server: mode === 'development' ? {
    ...(hasCerts ? {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    } : {}),
    port: 5173
  } : undefined
}))