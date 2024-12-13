import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node12',
  splitting: false,
  sourcemap: true,
  clean: true,
})
