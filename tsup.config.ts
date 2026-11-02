import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/server/index.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist/server',
  clean: true,
  sourcemap: true,
})
