#!/usr/bin/env node
/**
 * Fallos del cliente, agrupados.
 *
 * Sin esto no hay forma de enterarse de que la app se rompió para alguien. Con
 * difusión masiva importa más que nunca: quien falla no escribe a soporte, se
 * va. Conviene mirarlo a diario mientras entre gente nueva.
 *
 *   node scripts/diagnosticos.mjs            # últimas 24 horas
 *   node scripts/diagnosticos.mjs 72         # últimas 72 horas
 *   node scripts/diagnosticos.mjs 24 --pilas # con la pila de cada fallo
 */
import { execFileSync } from "node:child_process";

const PROJECT = "ayuda-humanitaria-89e72";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function tokenAdmin() {
  try {
    return execFileSync("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8",
    }).trim();
  } catch {
    console.error("No hay sesión de gcloud. Ejecuta:  gcloud auth login");
    process.exit(1);
  }
}

/** "Mozilla/5.0 (Linux; Android 11; SM-A125M)..." -> "Android 11". */
function navegador(agente) {
  const m =
    /Android [\d.]+/.exec(agente) ||
    /iPhone OS [\d_]+/.exec(agente) ||
    /Mac OS X [\d_]+/.exec(agente) ||
    /Windows NT [\d.]+/.exec(agente);
  const so = m ? m[0].replace(/_/g, ".") : "desconocido";
  const nav = /Chrome\/(\d+)/.exec(agente)
    ? `Chrome ${/Chrome\/(\d+)/.exec(agente)[1]}`
    : /Firefox\/(\d+)/.exec(agente)
      ? `Firefox ${/Firefox\/(\d+)/.exec(agente)[1]}`
      : /Version\/([\d.]+).*Safari/.exec(agente)
        ? `Safari ${/Version\/([\d.]+).*Safari/.exec(agente)[1]}`
        : "";
  return `${so}${nav ? " · " + nav : ""}`;
}

const horas = Number(process.argv[2]) || 24;
const conPilas = process.argv.includes("--pilas");
const desde = new Date(Date.now() - horas * 3600 * 1000).toISOString();

const res = await fetch(`${FS}:runQuery`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tokenAdmin()}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: "diagnostics" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "at" },
          op: "GREATER_THAN",
          value: { timestampValue: desde },
        },
      },
      orderBy: [{ field: { fieldPath: "at" }, direction: "DESCENDING" }],
      limit: 500,
    },
  }),
});

const cuerpo = await res.json();
if (!res.ok) {
  console.error("Error:", cuerpo?.error?.message ?? res.status);
  process.exit(1);
}

const filas = cuerpo
  .filter((r) => r.document)
  .map((r) => {
    const f = r.document.fields;
    const g = (k) => f[k]?.stringValue ?? "";
    return {
      origen: g("origen"),
      mensaje: g("mensaje"),
      pila: g("pila"),
      ruta: g("ruta"),
      agente: navegador(g("agente")),
      enLinea: f.enLinea?.booleanValue ?? true,
      at: f.at?.timestampValue ?? "",
    };
  });

if (filas.length === 0) {
  console.log(`Sin fallos registrados en las últimas ${horas} horas.`);
  process.exit(0);
}

// Se agrupa por mensaje: veinte personas con el mismo fallo son un problema,
// no veinte. Lo que importa es a cuánta gente le pasó y dónde.
const grupos = new Map();
for (const f of filas) {
  const clave = `${f.origen} :: ${f.mensaje}`;
  const g = grupos.get(clave) ?? {
    ...f,
    veces: 0,
    rutas: new Set(),
    agentes: new Set(),
    sinLinea: 0,
  };
  g.veces += 1;
  g.rutas.add(f.ruta || "/");
  g.agentes.add(f.agente);
  if (!f.enLinea) g.sinLinea += 1;
  grupos.set(clave, g);
}

const orden = [...grupos.values()].sort((a, b) => b.veces - a.veces);
console.log(
  `${filas.length} fallo(s) en ${horas} h · ${orden.length} distinto(s)\n`,
);

for (const g of orden) {
  console.log(`  ${g.veces}×  ${g.origen}`);
  console.log(`      ${g.mensaje}`);
  console.log(`      en: ${[...g.rutas].join(", ")}`);
  console.log(`      dispositivos: ${[...g.agentes].slice(0, 4).join(" | ")}`);
  if (g.sinLinea > 0) {
    console.log(
      `      ${g.sinLinea} ocurrieron sin conexión (puede ser normal)`,
    );
  }
  if (conPilas && g.pila) {
    console.log(
      g.pila
        .split("\n")
        .slice(0, 6)
        .map((l) => `        ${l.trim()}`)
        .join("\n"),
    );
  }
  console.log();
}
