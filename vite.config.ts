import { defineConfig } from 'vite';

// L'application (la PWA) vit dans app/ ; le moteur est importé depuis engine/.
export default defineConfig({
  root: 'app',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
