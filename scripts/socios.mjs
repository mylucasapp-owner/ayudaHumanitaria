#!/usr/bin/env node
/**
 * Llaves para organizaciones que aportan datos por la API.
 *
 * La API de lectura ya permitía que otros usaran estos datos. Esto es la otra
 * mitad: que puedan traer los suyos. Sin ella, "centro de intercambio" es solo
 * una forma elegante de decir "nuestra base de datos".
 *
 * Se guarda el hash de la llave, nunca la llave. Se muestra una sola vez, al
 * crearla: si se pierde, se revoca y se hace otra. Guardarla en claro en la base
 * significaría que una filtración de esa colección reparte permisos de escritura.
 *
 *   node scripts/socios.mjs listar
 *   node scripts/socios.mjs crear "Cruz Roja Valle" contacto@cruzroja.org
 *   node scripts/socios.mjs revocar "Cruz Roja Valle"
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

const PROJECT = "ayuda-humanitaria-89e72";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function token() {
  try {
    return execFileSync("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8",
    }).trim();
  } catch {
    console.error("No hay sesión de gcloud. Ejecuta:  gcloud auth login");
    process.exit(1);
  }
}

async function pedir(url, opciones = {}) {
  const res = await fetch(url, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(opciones.headers ?? {}),
    },
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(cuerpo?.error?.message ?? String(res.status));
  return cuerpo;
}

async function listar() {
  const d = await pedir(`${FS}/partners`);
  const docs = d.documents ?? [];
  if (docs.length === 0) {
    console.log("No hay organizaciones aliadas todavía.");
    return;
  }
  console.log(`${docs.length} organización(es):\n`);
  for (const doc of docs) {
    const f = doc.fields ?? {};
    const activa = f.active?.booleanValue;
    console.log(
      `  ${f.name?.stringValue ?? "(sin nombre)"}${activa ? "" : "  · REVOCADA"}` +
        `\n     ${f.contact?.stringValue ?? ""}\n`,
    );
  }
}

async function crear(nombre, contacto) {
  if (!nombre) {
    console.error('Uso: node scripts/socios.mjs crear "Nombre" contacto@org.org');
    process.exit(1);
  }
  // Larga de verdad: esta llave publica datos que la gente usa para caminar
  // hasta un sitio, así que adivinarla no puede estar al alcance de nadie.
  const llave = `ah_${randomBytes(24).toString("base64url")}`;
  const hash = createHash("sha256").update(llave).digest("hex");
  const id = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);

  await pedir(`${FS}/partners/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        name: { stringValue: nombre },
        contact: { stringValue: contacto ?? "" },
        keyHash: { stringValue: hash },
        active: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });

  console.log(
    `\nOrganización dada de alta: ${nombre}\n` +
      `\n  Llave:  ${llave}\n` +
      "\n  Se muestra UNA sola vez: solo guardamos su hash. Si se pierde, se" +
      "\n  revoca esta y se crea otra." +
      "\n\n  Que la usen así:\n" +
      `\n    curl -X POST https://ayudahumanitaria.info/api/aportarPunto \\` +
      `\n      -H "Authorization: Bearer ${llave}" \\` +
      '\n      -H "Content-Type: application/json" \\' +
      '\n      -d \'{"tipo":"albergue","nombre":"Coliseo","direccion":"Cra 52, Cali",' +
      '"lat":3.42,"lng":-76.54,"telefono":"3001234567"}\'' +
      "\n\n  Lo que aporten sale como SIN CONFIRMAR y con su nombre. Es lo honesto:" +
      "\n  nadie de acá se paró en esa puerta.\n",
  );
}

async function revocar(nombre) {
  if (!nombre) {
    console.error('Uso: node scripts/socios.mjs revocar "Nombre"');
    process.exit(1);
  }
  const id = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  await pedir(`${FS}/partners/${id}?updateMask.fieldPaths=active`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { active: { booleanValue: false } } }),
  });
  // No se borra: los puntos que aportó siguen llevando su nombre, y saber
  // quién los trajo importa aunque la relación se haya terminado.
  console.log(
    `Llave revocada para ${nombre}. Lo que ya aportó sigue publicado y con su nombre.`,
  );
}

const [accion, ...args] = process.argv.slice(2);
try {
  if (accion === "listar") await listar();
  else if (accion === "crear") await crear(args[0], args[1]);
  else if (accion === "revocar") await revocar(args[0]);
  else {
    console.log(
      "Acciones:\n" +
        "  listar\n" +
        '  crear "Nombre" contacto@org.org\n' +
        '  revocar "Nombre"',
    );
  }
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}
