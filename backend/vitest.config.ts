import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

export default defineConfig({
  test: {
    testTimeout: 30000,
    maxConcurrency: 1,
    maxWorkers: 1,
  },
})