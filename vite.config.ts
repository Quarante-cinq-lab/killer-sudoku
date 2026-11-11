import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

/**
 * Politique de sécurité du contenu (cahier des charges, section 12.1) : l'application ne peut charger des
 * fichiers et se connecter qu'à sa propre adresse. Ajoutée seulement à la version construite, car le
 * serveur de développement a besoin de scripts « en ligne » pour recharger la page à chaque modification.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    ),
});

// L'application (la PWA) vit dans app/ ; le moteur est importé depuis engine/.
export default defineConfig({
  root: 'app',
  base: './',
  // Numéro de version affiché sur l'accueil.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    contentSecurityPolicy(),
    VitePWA({
      // La nouvelle version est téléchargée en arrière-plan ; elle s'applique au lancement suivant.
      registerType: 'prompt',
      injectRegister: 'script', // fichier externe : compatible avec la politique de sécurité
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'splash-*.png', 'robots.txt'],
      manifest: {
        name: 'Killer Sudoku',
        short_name: 'Killer Sudoku',
        description: 'Killer sudoku personnel, hors ligne.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f6fb',
        theme_color: '#f7f6fb',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout est gardé en copie locale : l'application fonctionne entièrement en mode avion.
        globPatterns: ['**/*.{js,css,html,png,svg,txt,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
