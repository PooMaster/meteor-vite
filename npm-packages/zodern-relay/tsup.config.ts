import { defineConfig } from 'tsup';

export default defineConfig({
    target: 'es2022',
    outDir: 'dist',
    entry: ['src/Plugin.ts'],
    format: ['cjs', 'esm'],
    skipNodeModulesBundle: true,
})