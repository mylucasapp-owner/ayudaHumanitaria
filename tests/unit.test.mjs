/**
 * Lógica pura: no necesita emuladores ni red. Son los cálculos que el usuario
 * lee en pantalla y las tablas que, si quedan incompletas, rompen la interfaz
 * en silencio.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { distanceKm, formatDistance, formatAgo, formatCountdown } from "../lib/geo.ts";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_HINT,
  CATEGORY_GLYPH,
  STATUS_LABEL,
  FLAG_REASONS,
  FLAG_LABEL,
  isClaimExpired,
  CLAIM_TTL_MS,
  CLAIM_LIMIT_PER_WINDOW,
} from "../lib/types.ts";

test("distanceKm coincide con distancias conocidas", () => {
  // Santiago ↔ Valparaíso: ~100 km en línea recta.
  const santiago = { lat: -33.4489, lng: -70.6693 };
  const valparaiso = { lat: -33.0472, lng: -71.6127 };
  const d = distanceKm(santiago, valparaiso);
  assert.ok(d > 95 && d < 105, `esperaba ~100 km, dio ${d}`);
});

test("distanceKm es cero para el mismo punto", () => {
  const p = { lat: -33.45, lng: -70.66 };
  assert.equal(distanceKm(p, p), 0);
});

test("distanceKm es simétrica", () => {
  const a = { lat: 10, lng: 20 };
  const b = { lat: -40, lng: 100 };
  assert.equal(distanceKm(a, b).toFixed(6), distanceKm(b, a).toFixed(6));
});

test("distanceKm cruza el antimeridiano sin dar la vuelta al mundo", () => {
  // Dos puntos separados por 2° de longitud, uno a cada lado del meridiano 180.
  const a = { lat: 0, lng: 179 };
  const b = { lat: 0, lng: -179 };
  const d = distanceKm(a, b);
  assert.ok(d < 250, `esperaba ~222 km, dio ${d}`);
});

test("formatDistance cambia de unidad en los umbrales correctos", () => {
  assert.equal(formatDistance(0.42), "420 m");
  assert.equal(formatDistance(0.999), "999 m");
  assert.equal(formatDistance(1), "1.0 km");
  assert.equal(formatDistance(9.94), "9.9 km");
  assert.equal(formatDistance(10), "10 km");
  assert.equal(formatDistance(42.4), "42 km");
});

test("formatDistance no muestra '0 m' para distancias diminutas", () => {
  // Un pin a 30 cm debe leerse como algo, no como cero.
  assert.equal(formatDistance(0), "0 m");
  assert.equal(formatDistance(0.03), "30 m");
});

test("formatAgo describe el paso del tiempo en escalas útiles", () => {
  const now = Date.now();
  assert.equal(formatAgo(null), "recién");
  assert.equal(formatAgo(now), "recién");
  assert.equal(formatAgo(now - 30 * 1000), "recién");
  assert.equal(formatAgo(now - 5 * 60 * 1000), "hace 5 min");
  assert.equal(formatAgo(now - 3 * 3600 * 1000), "hace 3 h");
  assert.equal(formatAgo(now - 50 * 3600 * 1000), "hace 2 d");
});

test("formatAgo no produce tiempos negativos con relojes adelantados", () => {
  // Un teléfono con la hora adelantada no debe mostrar 'hace -4 min'.
  assert.equal(formatAgo(Date.now() + 10 * 60 * 1000), "recién");
});

test("formatCountdown nunca baja de cero", () => {
  assert.equal(formatCountdown(Date.now() - 60_000), "0 min");
  assert.match(formatCountdown(Date.now() + 90 * 60 * 1000), /^1 h (29|30) min$/);
  assert.match(formatCountdown(Date.now() + 10 * 60 * 1000), /^\d+ min$/);
});

test("isClaimExpired distingue vigente de vencido", () => {
  const base = { id: "x", claim: null };
  assert.equal(isClaimExpired(base), false);
  assert.equal(
    isClaimExpired({ ...base, claim: { expiresAt: Date.now() + 60_000 } }),
    false,
  );
  assert.equal(
    isClaimExpired({ ...base, claim: { expiresAt: Date.now() - 1 } }),
    true,
  );
});

test("toda categoría tiene rótulo, ejemplo y glifo", () => {
  for (const c of CATEGORIES) {
    assert.ok(CATEGORY_LABEL[c], `falta rótulo de ${c}`);
    assert.ok(CATEGORY_HINT[c], `falta ejemplo de ${c}`);
    assert.ok(CATEGORY_GLYPH[c], `falta glifo de ${c}`);
    assert.equal(CATEGORY_GLYPH[c].length, 1, `el glifo de ${c} debe ser un carácter`);
  }
});

test("todo estado tiene rótulo legible", () => {
  for (const s of ["abierta", "comprometida", "entregada", "resuelta", "falsa"]) {
    assert.ok(STATUS_LABEL[s], `falta rótulo del estado ${s}`);
  }
});

test("todo motivo de denuncia tiene rótulo", () => {
  for (const r of FLAG_REASONS) {
    assert.ok(FLAG_LABEL[r], `falta rótulo del motivo ${r}`);
  }
});

test("los motivos de denuncia coinciden con los que aceptan las reglas", async () => {
  // Si alguien agrega un motivo en el código y olvida las reglas, la denuncia
  // falla en producción con un permission-denied incomprensible.
  const { readFile } = await import("node:fs/promises");
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  for (const r of FLAG_REASONS) {
    assert.ok(rules.includes(`'${r}'`), `el motivo ${r} no está en firestore.rules`);
  }
});

test("las categorías coinciden con las que aceptan las reglas", async () => {
  const { readFile } = await import("node:fs/promises");
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  for (const c of CATEGORIES) {
    assert.ok(rules.includes(`'${c}'`), `la categoría ${c} no está en firestore.rules`);
  }
});

test("el tope de cupo del cliente coincide con el de las reglas", async () => {
  const { readFile } = await import("node:fs/promises");
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.ok(
    rules.includes(`windowCount <= ${CLAIM_LIMIT_PER_WINDOW}`),
    "el tope de las reglas no coincide con CLAIM_LIMIT_PER_WINDOW",
  );
});

test("el compromiso dura menos que el techo que imponen las reglas", () => {
  // Las reglas aceptan hasta 12 h; el cliente pide 3 h.
  assert.ok(CLAIM_TTL_MS < 12 * 3600 * 1000);
});
