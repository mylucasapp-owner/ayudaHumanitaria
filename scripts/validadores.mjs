#!/usr/bin/env node
/**
 * Acreditación de coordinadores en terreno.
 *
 * Ser validador es tener un documento en `validators/{uid}`. Ningún cliente
 * puede crearlo: por eso este script escribe con credencial de administrador,
 * tomada de la sesión de gcloud. No hay ninguna llave de servicio en el
 * repositorio, que es un archivo que no conviene tener dando vueltas.
 *
 *   node scripts/validadores.mjs listar
 *   node scripts/validadores.mjs crear "Defensa Civil Comuna 3" Cali correo@ong.org
 *   node scripts/validadores.mjs crear "Bomberos Quibdó" Chocó correo@x.org --con-clave
 *   node scripts/validadores.mjs revocar correo@ong.org
 *
 * Por defecto se le envía al coordinador un correo para que ponga su propia
 * contraseña: así ninguna clave viaja por WhatsApp ni queda en un chat. Con
 * `--con-clave` se genera una y se imprime, para quien no tenga acceso a correo
 * —que en zona de desastre es un caso real.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const PROJECT = "ayuda-humanitaria-89e72";

function env(nombre) {
  const archivo = new URL("../.env.local", import.meta.url);
  const linea = readFileSync(archivo, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${nombre}=`));
  if (!linea) throw new Error(`Falta ${nombre} en .env.local`);
  return linea.slice(nombre.length + 1).trim();
}

const API_KEY = env("NEXT_PUBLIC_FIREBASE_API_KEY");
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function tokenAdmin() {
  try {
    return execFileSync("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8",
    }).trim();
  } catch {
    console.error(
      "No hay sesión de gcloud. Ejecuta:  gcloud auth login\n" +
        "Debe ser la cuenta dueña del proyecto en Firebase.",
    );
    process.exit(1);
  }
}

async function pedir(url, opciones = {}) {
  const res = await fetch(url, opciones);
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = cuerpo?.error?.message ?? res.status;
    throw new Error(String(detalle));
  }
  return cuerpo;
}

async function listar() {
  const token = tokenAdmin();
  const datos = await pedir(`${FS}/validators`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const docs = datos.documents ?? [];
  if (docs.length === 0) {
    console.log(
      "No hay validadores acreditados.\n" +
        "Sin al menos uno, nadie verifica reportes ni descarta los falsos.",
    );
    return;
  }
  console.log(`${docs.length} validador(es) acreditado(s):\n`);
  for (const d of docs) {
    const uid = d.name.split("/").pop();
    const f = d.fields ?? {};
    console.log(
      `  ${f.name?.stringValue ?? "(sin nombre)"}` +
        `  ·  zona: ${f.zone?.stringValue ?? "(sin zona)"}` +
        `\n     uid: ${uid}` +
        (f.contactEmail?.stringValue ? `  ·  ${f.contactEmail.stringValue}` : "") +
        "\n",
    );
  }
}

/** Busca el uid de una cuenta ya existente por su correo. */
async function uidPorCorreo(correo) {
  const token = tokenAdmin();
  const r = await pedir(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-goog-user-project": PROJECT,
      },
      body: JSON.stringify({ email: [correo] }),
    },
  ).catch(() => ({}));
  return r?.users?.[0]?.localId ?? null;
}

async function crear(nombre, zona, correo, conClave) {
  if (!nombre || !zona || !correo) {
    console.error(
      'Uso: node scripts/validadores.mjs crear "Nombre" "Zona" correo@ong.org [--con-clave]',
    );
    process.exit(1);
  }

  // Contraseña larga y aleatoria. Si se envía correo de restablecimiento, esta
  // no la usa nadie: existe solo porque la cuenta necesita nacer con una.
  const clave = randomBytes(12).toString("base64url");

  let uid = await uidPorCorreo(correo);
  if (uid) {
    console.log(`La cuenta ${correo} ya existía. Se reutiliza (uid ${uid}).`);
  } else {
    const alta = await pedir(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: correo, password: clave, returnSecureToken: true }),
      },
    );
    uid = alta.localId;
    console.log(`Cuenta creada para ${correo}`);
  }

  const token = tokenAdmin();
  await pedir(`${FS}/validators/${uid}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        name: { stringValue: nombre },
        zone: { stringValue: zona },
        contactEmail: { stringValue: correo },
        accreditedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });

  console.log(`\nAcreditado: ${nombre} · zona ${zona}`);

  if (conClave) {
    console.log(
      `\n  Correo:     ${correo}` +
        `\n  Contraseña: ${clave}` +
        "\n\n  Entrégala en persona o por un canal privado. No la pegues en un" +
        "\n  grupo de WhatsApp: cualquiera del grupo podría descartar reportes.",
    );
  } else {
    await pedir(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: "PASSWORD_RESET", email: correo }),
      },
    );
    console.log(
      `\n  Se envió a ${correo} un correo para que defina su contraseña.` +
        "\n  Así ninguna clave pasa por tus manos ni queda en un chat." +
        "\n  Si no le llega, revisa spam o repite con --con-clave.",
    );
  }

  console.log(
    "\n  Dile que entre a https://ayuda-humanitaria-89e72.web.app/validador/",
  );
}

async function revocar(correo) {
  if (!correo) {
    console.error("Uso: node scripts/validadores.mjs revocar correo@ong.org");
    process.exit(1);
  }
  const uid = await uidPorCorreo(correo);
  if (!uid) {
    console.error(`No existe una cuenta con el correo ${correo}`);
    process.exit(1);
  }
  const token = tokenAdmin();
  await pedir(`${FS}/validators/${uid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // La cuenta sigue existiendo pero ya no puede verificar, descartar ni
  // bloquear: sin el documento no es validador para las reglas.
  console.log(`Acreditación revocada para ${correo}. La cuenta queda sin poderes.`);
}

const [accion, ...resto] = process.argv.slice(2);
const conClave = resto.includes("--con-clave");
const args = resto.filter((a) => a !== "--con-clave");

try {
  if (accion === "listar") await listar();
  else if (accion === "crear") await crear(args[0], args[1], args[2], conClave);
  else if (accion === "revocar") await revocar(args[0]);
  else {
    console.log(
      "Acciones:\n" +
        "  listar\n" +
        '  crear "Nombre" "Zona" correo@ong.org [--con-clave]\n' +
        "  revocar correo@ong.org",
    );
  }
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}
