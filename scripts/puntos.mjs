#!/usr/bin/env node
/**
 * Carga de puntos a donde ir desde una lista de texto.
 *
 * Existe porque meter treinta albergues uno por uno en un formulario de celular
 * es un trabajo que nadie hace, y por eso "¿A dónde ir?" llevaba días vacío
 * teniendo la información a mano.
 *
 * NO EXIGE UN FORMATO. Acepta lo que ya tengas: un WhatsApp copiado, una
 * columna pegada de una hoja de cálculo, una lista escrita a mano. Separa por
 * líneas y adivina qué es cada cosa. Pedir un CSV con columnas exactas sería
 * trasladarte a ti el trabajo que debería hacer la máquina.
 *
 * REVISA ANTES DE PUBLICAR, y esa es la parte importante. Publicar un albergue
 * manda familias caminando: volcar treinta líneas mal entendidas de una sola vez
 * es el peor error posible de toda esta app. Por eso `revisar` es el modo por
 * defecto y `publicar` hay que pedirlo a propósito.
 *
 *   npm run puntos -- revisar lista.txt
 *   npm run puntos -- publicar lista.txt --por "Defensa Civil Comuna 3"
 *
 * Se ejecuta con npm porque importa lib/zones.ts para no duplicar la tabla de
 * departamentos: Node necesita una bandera para leer TypeScript.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROJECT = "ayuda-humanitaria-89e72";
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Palabras que delatan de qué tipo es cada sitio. */
const TIPOS = [
  ["albergue", ["albergue", "refugio", "alojamiento", "dormitorio", "coliseo", "polideportivo"]],
  ["salud", ["salud", "medic", "hospital", "enfermer", "puesto de salud", "eps", "clinica", "clínica"]],
  ["agua", ["agua", "potable", "tanque", "carrotanque", "hidrante"]],
  ["comida", ["comida", "olla", "alimenta", "comedor", "almuerzo", "desayuno", "cocina"]],
  ["acopio", ["acopio", "donacion", "donación", "recolec", "centro de acopio", "bodega"]],
];

function sinTildes(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tipoDe(linea) {
  const t = sinTildes(linea);
  for (const [tipo, claves] of TIPOS) {
    if (claves.some((k) => t.includes(sinTildes(k)))) return tipo;
  }
  // Sin pistas se asume acopio: es el que menos promete. Decir "albergue" de
  // algo que no lo es manda a una familia a dormir a una bodega cerrada.
  return null;
}

/** Teléfono colombiano: celular de 10 dígitos o fijo de 7, con o sin separadores. */
function telefonoDe(linea) {
  const limpio = linea.replace(/[().\-\s]/g, " ");
  const movil = limpio.match(/\b(3\d{9})\b/);
  if (movil) return movil[1];
  const fijo = limpio.match(/\b(\d{7})\b/);
  return fijo ? fijo[1] : "";
}

function horarioDe(linea) {
  if (/24\s*(horas|hrs\b|h\b)/i.test(linea)) return "24 horas";
  // Exige am/pm o dos puntos. Sin esa exigencia, "#12-30" de una dirección se
  // leía como "12 a 30" y quedaba publicado un horario inventado, que es peor
  // que no poner ninguno: alguien llega a esa hora y encuentra cerrado.
  const rango = linea.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?\s?m\.?|p\.?\s?m\.?))\s*(?:a|-|hasta)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?\s?m\.?|p\.?\s?m\.?))/i,
  );
  if (rango) return `${rango[1]} a ${rango[2]}`.replace(/\s+/g, " ");
  const conDosPuntos = linea.match(
    /\b(\d{1,2}:\d{2})\s*(?:a|-|hasta)\s*(\d{1,2}:\d{2})\b/,
  );
  return conDosPuntos ? `${conDosPuntos[1]} a ${conDosPuntos[2]}` : "";
}

/** Trozos que parecen una dirección, no un nombre. */
function pareceDireccion(trozo) {
  return /\b(carrera|cra|kra|calle|cll|clle|avenida|av|diagonal|dg|transversal|tv|manzana|mz|vereda|barrio|km|kil[oó]metro)\b|#/i.test(
    trozo,
  );
}

function interpretar(linea) {
  const original = linea.trim();

  // Se extraen y se quitan primero, para que no ensucien el nombre.
  const telefono = telefonoDe(original);
  const horario = horarioDe(original);
  const tipo = tipoDe(original);

  let resto = original;
  if (telefono) resto = resto.replace(telefono, " ");
  if (horario !== "24 horas" && horario) {
    resto = resto.replace(
      /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?\s?m\.?|p\.?\s?m\.?)\s*(?:a|-|hasta)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.?\s?m\.?|p\.?\s?m\.?)/i,
      " ",
    );
  } else if (horario === "24 horas") {
    resto = resto.replace(/24\s*(horas|hrs\b|h\b)/i, " ");
  }
  resto = resto.replace(/\b(tel|cel|celular|tel[eé]fono|contacto)\b\s*:?/gi, " ");

  // La coma también separa: muchas listas no traen ningún otro separador. Se
  // parte por todo y luego se clasifica cada trozo por lo que parece.
  const trozos = resto
    .split(/\s*[—–|;,]\s*|\t+|\s+-\s+/)
    .map((t) => t.replace(/\s{2,}/g, " ").replace(/^[\s.:;-]+|[\s.:;-]+$/g, "").trim())
    .filter(Boolean);

  const direccionTrozos = trozos.filter(pareceDireccion);
  const otros = trozos.filter((t) => !pareceDireccion(t));

  return {
    original,
    tipo,
    // El nombre es el primer trozo que no es dirección. Si todo parece
    // dirección, se usa el primero: es preferible un nombre raro a ninguno.
    nombre: (otros[0] ?? trozos[0] ?? "").slice(0, 80),
    direccion: direccionTrozos.join(", ").slice(0, 140),
    telefono,
    horario: horario.slice(0, 60),
    notas: otros.slice(1).join(" · ").slice(0, 200),
  };
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

const [accion, archivo, ...resto] = process.argv.slice(2);
const por =
  resto[resto.indexOf("--por") + 1] && resto.includes("--por")
    ? resto[resto.indexOf("--por") + 1]
    : "Carga inicial";

if (!accion || !archivo) {
  console.log(
    "Uso:\n" +
      "  npm run puntos -- revisar lista.txt\n" +
      '  npm run puntos -- publicar lista.txt --por "Defensa Civil Comuna 3"\n\n' +
      "Formato: una línea por sitio. Da igual cómo estén separados los datos;\n" +
      "el script intenta entenderlos. Revisa siempre antes de publicar.",
  );
  process.exit(0);
}

const lineas = readFileSync(archivo, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const puntos = lineas.map(interpretar);
/**
 * Líneas que hay que mirar a ojo. No basta con "falta un campo": lo peligroso
 * es lo que el script cree haber entendido y entendió mal.
 */
function problemasDe(p) {
  const fallos = [];
  if (!p.tipo) fallos.push("no se sabe qué tipo de sitio es");
  if (p.nombre.length < 3) fallos.push("sin nombre reconocible");
  if (/^\d{1,2}(:\d{2})?\s*(am|pm)/i.test(p.nombre))
    fallos.push("el nombre parece un horario");
  if (/^\d[\d\s-]*$/.test(p.nombre)) fallos.push("el nombre son solo números");
  if (p.direccion && p.nombre === p.direccion)
    fallos.push("el nombre y la dirección salieron iguales");
  return fallos;
}

const dudosos = puntos.filter((p) => problemasDe(p).length > 0);

console.log(`\n${puntos.length} línea(s) leída(s) de ${archivo}\n`);
for (const p of puntos) {
  const falta = problemasDe(p);
  if (!p.telefono) falta.push("sin teléfono (se publica igual)");
  if (!p.direccion) falta.push("sin dirección (se publica igual)");
  console.log(
    `  ${p.tipo ?? "???"}  ${p.nombre}` +
      (p.direccion ? `\n      dónde:   ${p.direccion}` : "") +
      (p.telefono ? `\n      tel:     ${p.telefono}` : "") +
      (p.horario ? `\n      horario: ${p.horario}` : "") +
      (p.notas ? `\n      notas:   ${p.notas}` : "") +
      (falta.length ? `\n      ⚠ ${falta.join(" · ")}` : "") +
      "\n",
  );
}

if (accion === "revisar") {
  console.log(
    dudosos.length
      ? `${dudosos.length} línea(s) con problemas, arriba marcadas con ⚠.\n` +
          "Arréglalas en el archivo y vuelve a revisar. Si falta el tipo, basta\n" +
          'con añadir la palabra "albergue", "acopio", "salud", "agua" o "comida".\n'
      : "Todo se entendió, pero léelo igual: esto lo va a usar alguien para\n" +
          "caminar hasta ahí. Para publicarlo:\n" +
          `  npm run puntos -- publicar ${archivo} --por "Tu organización"\n`,
  );
  process.exit(0);
}

if (accion !== "publicar") {
  console.error(`Acción desconocida: ${accion}`);
  process.exit(1);
}

if (dudosos.length) {
  console.error(
    `${dudosos.length} línea(s) con problemas. No se publica NADA hasta que\n` +
      "todas se entiendan: un albergue mal clasificado manda familias a dormir\n" +
      "a una bodega cerrada, y un horario inventado las manda a una puerta\n" +
      "cerrada. Corre `revisar` para ver cuáles.\n",
  );
  process.exit(1);
}

// Se importa desde el propio código para no repetir la tabla de departamentos.
const { zoneFromText } = await import("../lib/zones.ts");
const token = tokenAdmin();
let creados = 0;

for (const p of puntos) {
  // De la línea entera, no solo de la dirección: el municipio suele quedar en
  // otro trozo ("…, Cali" o "Parque de Yumbo") y perderlo deja el punto fuera
  // del filtro de su propio departamento.
  const zona = zoneFromText(p.original)?.id ?? "otra";
  const res = await fetch(`${FS}/places`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        kind: { stringValue: p.tipo },
        name: { stringValue: p.nombre },
        reference: { stringValue: p.direccion },
        location: { nullValue: null },
        schedule: { stringValue: p.horario },
        notes: { stringValue: p.notas },
        phone: { stringValue: p.telefono },
        active: { booleanValue: true },
        // Sin confirmar, siempre: viene de una lista, nadie se paró en la
        // puerta. Se muestra con esa advertencia hasta que alguien vaya.
        confirmed: { booleanValue: false },
        confirmedByName: { nullValue: null },
        zone: { stringValue: zona },
        createdByName: { stringValue: por },
        createdAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (res.ok) {
    creados++;
  } else {
    const e = await res.json().catch(() => ({}));
    console.error(`  ✗ ${p.nombre}: ${e?.error?.message ?? res.status}`);
  }
}

console.log(
  `\n${creados} punto(s) publicado(s) como SIN CONFIRMAR, a nombre de "${por}".\n` +
    "Aparecen con la advertencia de llamar antes de ir. En cuanto alguien\n" +
    "confirme uno en terreno, márcalo desde /validador/puntos/.\n",
);
