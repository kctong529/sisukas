import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'

// Prefer the dedicated test environment over previously exported shell values.
dotenv.config({ path: '.env.test', override: true })

export default defineConfig({
  test: {
    testTimeout: 30000,
    maxConcurrency: 1,
    maxWorkers: 1,
  },
})