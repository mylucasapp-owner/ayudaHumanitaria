/**
 * Genera los íconos PWA sin dependencias: el logo es una cruz blanca sobre
 * negro, la misma marca que usa la app. Ejecutar solo si se cambia el diseño:
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Dibuja la cruz y devuelve el buffer RGBA de `size`×`size`. */
function draw(size, { padding = 0, border = false }) {
  const px = Buffer.alloc(size * size * 4);
  const inner = size * (1 - padding * 2);
  const offset = size * padding;

  // Brazos de la cruz: 22% de grosor sobre el área útil.
  const arm = inner * 0.22;
  const span = inner * 0.62;
  const cx = size / 2;
  const cy = size / 2;

  const borderW = border ? Math.max(2, size * 0.035) : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inH = Math.abs(x - cx) <= span / 2 && Math.abs(y - cy) <= arm / 2;
      const inV = Math.abs(y - cy) <= span / 2 && Math.abs(x - cx) <= arm / 2;
      const onBorder =
        border &&
        (x < offset + borderW ||
          y < offset + borderW ||
          x >= size - offset - borderW ||
          y >= size - offset - borderW) &&
        x >= offset &&
        y >= offset &&
        x < size - offset &&
        y < size - offset;

      const white = inH || inV || onBorder;
      px[i] = white ? 255 : 0;
      px[i + 1] = white ? 255 : 0;
      px[i + 2] = white ? 255 : 0;
      px[i + 3] = 255;
    }
  }
  return px;
}

function png(size, rgba) {
  // Formato PNG: cada fila va precedida por su byte de filtro (0 = sin filtro).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

mkdirSync(OUT, { recursive: true });

const files = [
  ["icon-192.png", 192, { border: true }],
  ["icon-512.png", 512, { border: true }],
  // Maskable: Android recorta hasta un 20% de cada borde.
  ["icon-maskable-512.png", 512, { padding: 0.14 }],
  ["apple-touch-icon.png", 180, { border: true }],
];

for (const [name, size, opts] of files) {
  writeFileSync(join(OUT, name), png(size, draw(size, opts)));
  console.log("escrito", name);
}
