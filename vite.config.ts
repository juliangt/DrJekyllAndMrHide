import { defineConfig } from 'vite';

// base './' para que el build funcione bajo el subpath de GitHub Pages.
// La config de tests vive en vitest.config.ts.
export default defineConfig({
  base: './',
});
