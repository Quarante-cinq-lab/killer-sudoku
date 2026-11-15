/**
 * Garde-fous de confidentialité (cahier des charges, sections 12 et 12.1) : l'application ne se connecte à
 * rien en dehors de son propre chargement, et la version construite contient bien la politique de
 * sécurité du contenu (CSP).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, CSP } from '../vite.config';

const ROOT = join(import.meta.dirname, '..');

/** Fichiers de l'application (interface, moteur, textes), sans les tests. */
function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === '__tests__' || entry.name === 'public' ? [] : sources(path);
    return /\.(ts|tsx|css|html)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('confidentialité', () => {
  it('aucun appel réseau ni adresse externe dans l’application', () => {
    const forbidden =
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|https?:\/\//;
    const files = ['app', 'engine', 'texts'].flatMap(sources);
    expect(files.length).toBeGreaterThan(20);
    const found = files.filter((file) => forbidden.test(readFileSync(join(ROOT, file), 'utf8')));
    expect(found).toEqual([]);
  });

  it('la version construite contient une CSP stricte', () => {
    const plugin = contentSecurityPolicy();
    expect(plugin.apply).toBe('build');
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = transform(readFileSync(join(ROOT, 'app', 'index.html'), 'utf8'));
    // Si la ligne remplacée change dans index.html, la CSP disparaîtrait sans bruit : ce test le signale.
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    expect(CSP).toContain("default-src 'self'");
    expect(CSP).toContain("connect-src 'self'");
    expect(CSP).toContain("object-src 'none'");
    expect(CSP).not.toMatch(/unsafe|https?:|\*/);
  });
});
