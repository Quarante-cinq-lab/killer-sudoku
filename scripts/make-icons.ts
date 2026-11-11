/**
 * Fabrique l'icône de l'application et les écrans de démarrage de l'iPad, sans aucune bibliothèque :
 * le dessin est fait de rectangles, rendu avec lissage (16 échantillons par pixel), puis enregistré en PNG
 * grâce à la compression intégrée à Node.
 * Usage : npm run icons   (fichiers écrits dans app/public/)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

type RGB = [number, number, number];
/** Rectangle dans un carré de 100 × 100 unités. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: RGB;
}

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const BACKGROUND = hex('#4b3f80');
const PANEL = hex('#ffffff');
const THIN = hex('#c9c7d3');
const CAGE = hex('#5b4ba8');
const INK = hex('#2b2560');
const SPLASH_BG = hex('#f7f6fb');

const GLYPHS: Record<string, string[]> = {
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};

/** Un caractère en « pixels » carrés de côté `px`. */
function glyph(char: string, x: number, y: number, px: number, color: RGB): Rect[] {
  return GLYPHS[char].flatMap((row, r) =>
    [...row].flatMap((c, col) =>
      c === '#' ? [{ x: x + col * px, y: y + r * px, w: px, h: px, color }] : [],
    ),
  );
}

/** Le dessin de l'icône ; `scale` réduit le motif autour du centre (version « maskable »). */
function iconShapes(scale: number): Rect[] {
  const s = (v: number): number => 50 + (v - 50) * scale;
  const rect = (x: number, y: number, w: number, h: number, color: RGB): Rect => ({
    x: s(x),
    y: s(y),
    w: w * scale,
    h: h * scale,
    color,
  });
  const shapes: Rect[] = [rect(14, 14, 72, 72, PANEL)];
  for (const p of [38, 62]) {
    shapes.push(rect(p - 0.6, 14, 1.2, 72, THIN), rect(14, p - 0.6, 72, 1.2, THIN));
  }
  // Cage en L (3 cases) tracée en retrait, comme dans le jeu.
  const t = 2.2;
  const [a, b, c, d] = [17, 35, 59, 59];
  shapes.push(
    rect(a, a, d - a, t, CAGE), // haut
    rect(d - t, a, t, b - a + t, CAGE), // droite de la case du haut
    rect(b, b, d - b, t, CAGE), // marche
    rect(b, b, t, c - b, CAGE), // droite de la case du bas
    rect(a, c - t, b - a + t, t, CAGE), // bas
    rect(a, a, t, c - a, CAGE), // gauche
  );
  for (const [i, ch] of ['4', '5'].entries()) {
    for (const g of glyph(ch, 19.5 + i * 11.4, 19.5, 1.9, INK))
      shapes.push(rect(g.x, g.y, g.w, g.h, g.color));
  }
  for (const g of glyph('9', 43.5, 40.5, 2.6, INK)) shapes.push(rect(g.x, g.y, g.w, g.h, g.color));
  return shapes;
}

/** Rendu d'un motif carré de `size` pixels (fond compris). */
function render(size: number, shapes: readonly Rect[], background: RGB): Uint8Array {
  const out = new Uint8Array(size * size * 3);
  const N = 4;
  const unit = size / 100;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const x = (px + (sx + 0.5) / N) / unit;
          const y = (py + (sy + 0.5) / N) / unit;
          let color = background;
          for (const shape of shapes) {
            if (x >= shape.x && x < shape.x + shape.w && y >= shape.y && y < shape.y + shape.h)
              color = shape.color;
          }
          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const i = (py * size + px) * 3;
      out[i] = Math.round(r / (N * N));
      out[i + 1] = Math.round(g / (N * N));
      out[i + 2] = Math.round(b / (N * N));
    }
  }
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encode une image RVB en PNG. */
function png(width: number, height: number, rgb: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, couleurs RVB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // pas de filtre
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}

/** Écran de démarrage : fond de l'application et icône au centre. */
function splash(width: number, height: number, iconSize: number): Buffer {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) rgb.set(SPLASH_BG, i * 3);
  const icon = render(iconSize, iconShapes(1), BACKGROUND);
  const left = Math.floor((width - iconSize) / 2);
  const top = Math.floor((height - iconSize) / 2);
  for (let y = 0; y < iconSize; y++) {
    rgb.set(icon.subarray(y * iconSize * 3, (y + 1) * iconSize * 3), ((top + y) * width + left) * 3);
  }
  return png(width, height, rgb);
}

/** Même dessin en SVG (icône de l'onglet). */
function svg(): string {
  const toHex = (c: RGB): string => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const rects = iconShapes(1)
    .map(
      (r) =>
        `<rect x="${+r.x.toFixed(2)}" y="${+r.y.toFixed(2)}" width="${+r.w.toFixed(2)}" height="${+r.h.toFixed(2)}" fill="${toHex(r.color)}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="${toHex(BACKGROUND)}"/>${rects}</svg>\n`;
}

const outDir = fileURLToPath(new URL('../app/public/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const icon = (size: number, scale = 1): Buffer =>
  png(size, size, render(size, iconShapes(scale), BACKGROUND));
const files: Record<string, Buffer | string> = {
  'icon-192.png': icon(192),
  'icon-512.png': icon(512),
  'icon-maskable-512.png': icon(512, 0.78),
  'apple-touch-icon.png': icon(180),
  'favicon.svg': svg(),
  // iPad Air 5 : 820 × 1180 points, écran « Retina » ×2.
  'splash-1640x2360.png': splash(1640, 2360, 360),
  'splash-2360x1640.png': splash(2360, 1640, 360),
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(outDir + name, content);
  console.log(`${name} (${Math.round(content.length / 1024)} Ko)`);
}
