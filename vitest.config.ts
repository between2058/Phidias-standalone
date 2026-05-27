import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: [
      'src/__tests__/**/*.test.ts',
      'src/lib/**/*.test.ts',
      'src/components/**/*.test.tsx',
    ],
    environmentMatchGlobs: [
      ['src/components/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
