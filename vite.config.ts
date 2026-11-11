import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// L'application (la PWA) vit dans app/ ; le moteur est importé depuis engine/.
export default defineConfig({
  root: 'app',
  plugins: [react()],
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
