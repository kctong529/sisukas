import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import ViteYaml from '@modyfi/vite-plugin-yaml';
import fs from 'fs'
import path from 'path'

const keyPath = path.resolve('./localhost-key.pem')
const certPath = path.resolve('./localhost.pem')

export default defineConfig(({ mode }) => ({
  plugins: [
    svelte(),
    ViteYaml()
  ],
  test: {
    environment: 'jsdom',
  },
  server: mode === 'development' ? {
    https: {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    },
    port: 5173
  } : undefined
}))