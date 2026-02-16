import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Standalone build that produces a self-contained ES module
 * registering <animated-flow> as a custom element.
 * Includes the Svelte runtime — no peer dependency needed.
 */
export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: { customElement: true },
    }),
  ],
  build: {
    lib: {
      entry: 'src/lib/element.ts',
      formats: ['es'],
      fileName: 'element',
    },
    outDir: 'dist',
    emptyDir: false,
  },
});
