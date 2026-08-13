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
 * Para una cuenta nueva imprime un enlace de un solo uso para que el
 * coordinador defina su propia contraseña: así ninguna clave permanente viaja
 * por un chat. Con `--con-clave` se genera una contraseña, para quien no pueda
 * abrir enlaces. Si la cuenta ya existía no se toca su contraseña; `--nueva-clave`
 * fuerza el enlace para quien la olvidó.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const PROJECT = "ayuda-humanitaria-89e72";
const APP_URL = "https://ayuda-humanitaria-89e72.web.app";

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

async function crear(nombre, zona, correo, conClave, nuevaClave) {
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
  const existia = !!uid;
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

  // Reacreditar a alguien que ya tenía cuenta no debe tocarle la contraseña.
  // Restituir un rol es una operación normal —se revocó por error, la persona
  // volvió al terreno— y mandarle un enlace nuevo le diría que la suya dejó de
  // servir, que es falso. Con --nueva-clave se pide el enlace a propósito.
  if (existia && !conClave && !nuevaClave) {
    console.log(
      "\n  Su contraseña de siempre sigue sirviendo; no hay nada que enviarle." +
        "\n  Si la olvidó, repite el comando con --nueva-clave.",
    );
  } else if (conClave) {
    console.log(
      `\n  Correo:     ${correo}` +
        `\n  Contraseña: ${clave}` +
        "\n\n  Entrégala en persona o por un canal privado. No la pegues en un" +
        "\n  grupo de WhatsApp: cualquiera del grupo podría descartar reportes.",
    );
  } else {
    // El enlace se arma aquí en vez de dejar que Firebase envíe el suyo.
    //
    // El correo automático apunta a una página alojada por Firebase que exige
    // recibir la llave del proyecto en la URL, y en proyectos configurados por
    // API esa llave llega vacía: el coordinador ve "The selected page mode is
    // invalid" y se queda afuera. Además esa página está en inglés.
    //
    // Nuestra página trae la llave incorporada, así que el enlace solo necesita
    // el código. Es de un solo uso y caduca: entregarlo por WhatsApp es mucho
    // más seguro que entregar una contraseña, que dura para siempre.
    const token = tokenAdmin();
    const { oobLink } = await pedir(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:sendOobCode`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-goog-user-project": PROJECT,
        },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: correo,
          returnOobLink: true,
        }),
      },
    );
    const codigo = new URL(oobLink).searchParams.get("oobCode");
    console.log(
      "\n  Envíale este enlace para que defina su propia contraseña:\n" +
        `\n  ${APP_URL}/clave/?mode=resetPassword&oobCode=${codigo}\n` +
        "\n  Es de un solo uso y caduca. Ninguna contraseña pasa por tus manos.",
    );
  }

  console.log(`\n  Después entrará por ${APP_URL}/validador/`);
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
const nuevaClave = resto.includes("--nueva-clave");
const args = resto.filter((a) => !a.startsWith("--"));

try {
  if (accion === "listar") await listar();
  else if (accion === "crear") await crear(args[0], args[1], args[2], conClave, nuevaClave);
  else if (accion === "revocar") await revocar(args[0]);
  else {
    console.log(
      "Acciones:\n" +
        "  listar\n" +
        '  crear "Nombre" "Zona" correo@ong.org [--con-clave|--nueva-clave]\n' +
        "  revocar correo@ong.org",
    );
  }
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}
