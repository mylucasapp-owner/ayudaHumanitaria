#!/usr/bin/env node
/**
 * Trae ofertas de ayuda publicadas por otra plataforma.
 *
 * Es la mitad que faltaba del intercambio: la API abierta ya permitía que otros
 * tomaran estos datos, pero no consumíamos los suyos. Cada dato que alguien
 * teclea dos veces es tiempo robado a la emergencia.
 *
 * QUÉ ENTRA Y QUÉ NO. Entran las ofertas: lo que alguien pone a disposición
 * —transporte gratis, apoyo psicológico, alojamiento—. No entran las búsquedas
 * de personas, aunque vengan en la misma lista: una búsqueda es una necesidad,
 * no una oferta, y meterla aquí la mostraría como si alguien estuviera
 * ofreciendo a esa persona. Se listan aparte para decidirlas a mano.
 *
 * NO SE IMPORTA NADA MARCADO COMO FRAUDE. Si el socio marca ALERTA_FRAUDE, esa
 * advertencia es lo más valioso de su lista y respetarla es lo mínimo.
 *
 * TODO QUEDA CON SU PROCEDENCIA. Republicar sin decir de dónde viene convierte
 * un intercambio en una apropiación, y le quita a quien lee la posibilidad de
 * preguntarle a la fuente.
 *
 * Es idempotente: se guarda el id del socio, así que volver a correrlo
 * actualiza en vez de duplicar.
 *
 *   npm run importar -- revisar
 *   npm run importar -- publicar
 *
 * La URL con el token va en .env.local como SOCIO_URL, nunca en el repositorio.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROJECT = "ayuda-humanitaria-89e72";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function env(nombre) {
  const linea = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${nombre}=`));
  if (!linea) {
    console.error(
      `Falta ${nombre} en .env.local.\n` +
        "Ahí va la URL del socio con su token: es una credencial y no puede\n" +
        "vivir en el repositorio.",
    );
    process.exit(1);
  }
  return linea.slice(nombre.length + 1).trim();
}

const SOCIO_NOMBRE = process.env.SOCIO_NOMBRE ?? "Red Ayuda Cali";

/**
 * Sus categorías a las nuestras.
 *
 * "Mascotas" y "Alquiler" no tienen equivalente exacto: van a OTRA AYUDA, que
 * existe justo para lo que no cabe en ninguna casilla. Forzarlas dentro de una
 * casilla parecida sería peor, porque quien filtre por ella esperaría otra cosa.
 */
const CATEGORIAS = {
  Servicios: "transporte",
  "Psicología": "medico",
  Psicologia: "medico",
  Alquiler: "refugio",
  Mascotas: "otro",
  Entidades: "otro",
  Salud: "medico",
  Alimentos: "agua",
  Agua: "agua",
  Albergue: "refugio",
};

/** Categorías del socio que nunca son ofertas. */
const NO_SON_OFERTAS = new Set(["Desaparecidos", "Desaparecido", "Personas"]);

/**
 * Distinguir "busco esto" de "tengo esto" dentro de una categoría mixta.
 *
 * La categoría del socio no alcanza: "Mascotas" trae veterinaria gratis y
 * mascotas ENCONTRADAS —las dos son ofertas— junto a mascotas perdidas, que son
 * búsquedas. Sin esto se coló "Gato Rey Thor perdido" en la pantalla de ayuda
 * disponible, como si alguien estuviera ofreciendo el gato.
 *
 * El orden importa. Primero se descartan los canales institucionales y los
 * avisos de "encontrado", porque contienen las mismas palabras que una
 * búsqueda: "Reportar desaparecidos" de Medicina Legal es un formulario oficial
 * para denunciar, no alguien buscando a nadie. Al filtrar solo por palabras
 * sueltas quedaba fuera, que es el error contrario y también le quita a alguien
 * un recurso útil.
 */
const MARCAS_DE_SERVICIO = [
  "reportar", "reporte de", "sistema para", "formulario", "ingresa los datos",
  "encontrad", "gratis", "a disposicion", "a disposición",
];

const MARCAS_DE_BUSQUEDA = [
  "perdido", "perdida", "perdidos", "perdidas",
  "se busca", "buscamos a", "desaparecid", "extraviad", "no aparece",
  "quien lo haya visto", "quien la haya visto", "visto por ultima vez",
];

function normalizar(t) {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function esBusqueda(r) {
  const t = normalizar(`${r.titulo ?? ""} ${r.descripcion ?? ""}`);

  // Las entidades publican canales, nunca buscan: sacarlas primero evita que
  // "Reportar desaparecidos" se lea como una desaparición.
  if (r.categoria === "Entidades") return false;
  if (MARCAS_DE_SERVICIO.some((k) => t.includes(normalizar(k)))) return false;

  if (NO_SON_OFERTAS.has(r.categoria)) return true;
  return MARCAS_DE_BUSQUEDA.some((k) => t.includes(normalizar(k)));
}

/** 573043892004 -> +573043892004, para que el enlace de llamada funcione. */
function telefono(t) {
  const limpio = String(t ?? "").replace(/[^\d+]/g, "");
  if (!limpio) return "";
  if (limpio.startsWith("+")) return limpio.slice(0, 25);
  if (/^57\d{10}$/.test(limpio)) return `+${limpio}`.slice(0, 25);
  return limpio.slice(0, 25);
}

function recortar(t, n) {
  return String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
}

function mapear(r) {
  const categoria = CATEGORIAS[r.categoria] ?? "otro";
  const inactivo = String(r.estado ?? "").toUpperCase() !== "ACTIVO";
  return {
    sourceId: String(r.id ?? ""),
    categoriaOriginal: r.categoria,
    category: categoria,
    // El título es lo que identifica la oferta; la descripción amplía.
    description: recortar(r.titulo || r.descripcion, 140),
    reference: recortar(r.descripcion, 120),
    amount: "",
    contactName: recortar(r.contactoNombre || SOCIO_NOMBRE, 60),
    contactPhone: telefono(r.contactoTelefono),
    sourceUrl: recortar(r.enlaceAccion || r.flyerUrl, 300),
    activo: !inactivo,
    estadoOriginal: String(r.estado ?? ""),
  };
}

const [accion] = process.argv.slice(2);
if (!accion || !["revisar", "publicar"].includes(accion)) {
  console.log("Uso:\n  npm run importar -- revisar\n  npm run importar -- publicar");
  process.exit(0);
}

const res = await fetch(env("SOCIO_URL"), { redirect: "follow" });
if (!res.ok) {
  console.error(`El socio respondió ${res.status}. ¿Cambió la URL o el token?`);
  process.exit(1);
}
const crudo = await res.json();
if (!Array.isArray(crudo)) {
  console.error("Se esperaba una lista de recursos y llegó otra cosa.");
  process.exit(1);
}

const fraude = crudo.filter(
  (r) => String(r.estado ?? "").toUpperCase() === "ALERTA_FRAUDE",
);
const busquedas = crudo.filter(esBusqueda);
const ofertas = crudo
  .filter((r) => !esBusqueda(r))
  .filter((r) => String(r.estado ?? "").toUpperCase() !== "ALERTA_FRAUDE")
  .map(mapear)
  .filter((o) => o.description.length >= 3);

console.log(`\n${crudo.length} recurso(s) recibidos de ${SOCIO_NOMBRE}\n`);
for (const o of ofertas) {
  console.log(
    `  [${o.categoriaOriginal} → ${o.category}] ${o.description}` +
      (o.contactPhone ? `\n      tel: ${o.contactPhone}` : "\n      sin teléfono") +
      (o.activo ? "" : "\n      (marcado INACTIVO allá: entra como no disponible)") +
      "\n",
  );
}

if (fraude.length) {
  console.log(
    `${fraude.length} recurso(s) marcados por el socio como ALERTA_FRAUDE.\n` +
      "No se importan: esa advertencia es lo más valioso de su lista.\n",
  );
}
if (busquedas.length) {
  console.log(
    `${busquedas.length} búsqueda(s) —de personas o de mascotas— que NO se\n` +
      "importan como ofertas:\n",
  );
  for (const b of busquedas) {
    console.log(
      `  · ${recortar(b.titulo, 70)}  [${b.estado}]` +
        (b.contactoTelefono ? `  tel ${telefono(b.contactoTelefono)}` : ""),
    );
  }
  console.log(
    "\nUna búsqueda es una necesidad, no una oferta: publicarla aquí la\n" +
      "mostraría como si alguien estuviera ofreciendo a esa persona o a ese\n" +
      "animal. Si alguna sigue activa, publícala desde la app con la categoría\n" +
      "BUSCO A ALGUIEN, que también cubre mascotas.\n",
  );
}

if (accion === "revisar") {
  console.log(`Para publicarlas: npm run importar -- publicar\n`);
  process.exit(0);
}

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
const token = tokenAdmin();

/** Lo ya importado de este socio, para actualizar en vez de duplicar. */
const existentes = new Map();
{
  const r = await fetch(`${FS}/offers?pageSize=300`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  for (const doc of d.documents ?? []) {
    const f = doc.fields ?? {};
    const sid = f.sourceId?.stringValue;
    const sname = f.sourceName?.stringValue;
    if (sid && sname === SOCIO_NOMBRE) {
      existentes.set(sid, doc.name.split("/").pop());
    }
  }
}

const { zoneFromText } = await import("../lib/zones.ts");
let creadas = 0;
let actualizadas = 0;

for (const o of ofertas) {
  const ahora = new Date().toISOString();
  const campos = {
    category: { stringValue: o.category },
    description: { stringValue: o.description },
    reference: { stringValue: o.reference },
    location: { nullValue: null },
    amount: { stringValue: o.amount },
    contactName: { stringValue: o.contactName },
    contactPhone: { stringValue: o.contactPhone || "0000000" },
    status: { stringValue: o.activo ? "disponible" : "agotada" },
    active: { booleanValue: o.activo },
    zone: {
      stringValue:
        zoneFromText(`${o.description} ${o.reference}`)?.id ?? "otra",
    },
    // Sin dueño en esta app: lo mantiene el socio. Un validador puede
    // descartarla si algo no cuadra, que es la salida que importa.
    ownerUid: { stringValue: `socio:${SOCIO_NOMBRE}` },
    verified: { booleanValue: false },
    verifiedByName: { nullValue: null },
    sourceId: { stringValue: o.sourceId },
    sourceName: { stringValue: SOCIO_NOMBRE },
    sourceUrl: o.sourceUrl
      ? { stringValue: o.sourceUrl }
      : { nullValue: null },
    updatedAt: { timestampValue: ahora },
  };

  const yaEsta = existentes.get(o.sourceId);
  if (yaEsta) {
    const mascara = Object.keys(campos)
      .map((k) => `updateMask.fieldPaths=${k}`)
      .join("&");
    const r = await fetch(`${FS}/offers/${yaEsta}?${mascara}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: campos }),
    });
    if (r.ok) actualizadas++;
    else console.error(`  ✗ actualizar ${o.sourceId}: ${r.status}`);
  } else {
    const r = await fetch(`${FS}/offers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: { ...campos, createdAt: { timestampValue: ahora } },
      }),
    });
    if (r.ok) creadas++;
    else console.error(`  ✗ crear ${o.sourceId}: ${r.status}`);
  }
}

// Lo que este socio publicó antes y ya no corresponde: desapareció de su lista,
// o —como pasó con las mascotas perdidas— resultó ser una búsqueda y nunca
// debió entrar como oferta. Se retira, no se borra: el rastro de qué se publicó
// y cuándo importa, y alguien pudo haber llamado.
const vigentes = new Set(ofertas.map((o) => o.sourceId));
let retiradas = 0;
for (const [sid, docId] of existentes) {
  if (vigentes.has(sid)) continue;
  const r = await fetch(
    `${FS}/offers/${docId}?updateMask.fieldPaths=active&updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          active: { booleanValue: false },
          status: { stringValue: "agotada" },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    },
  );
  if (r.ok) retiradas++;
}

console.log(
  `\n${creadas} nueva(s), ${actualizadas} actualizada(s), ` +
    `${retiradas} retirada(s), a nombre de "${SOCIO_NOMBRE}".\n` +
    "Volver a correrlo actualiza; no duplica.\n",
);
