import { distanceKm } from "./geo";
import type { GeoPoint } from "./types";

/**
 * Zonas de la emergencia, una por departamento.
 *
 * Existen porque las necesidades están repartidas en cientos de kilómetros y
 * una referencia escrita —"Vereda La Suiza", "Corregimiento sobre el río"— no
 * le dice nada a quien no es de ahí. Sin esta etiqueta, un voluntario en Cali
 * no tiene forma de saber que lo que está leyendo queda a 250 km.
 *
 * Antes eran tres focos (Cali, Pereira, Chocó) y todo lo demás caía en "Otra
 * zona". Eso dejaba sin nombre a la mayoría de municipios afectados: una
 * necesidad en Mocoa o en Ayapel aparecía como si estuviera fuera del mapa. Con
 * cobertura nacional, cualquier municipio del país recibe una etiqueta real.
 *
 * CÓMO SE ASIGNA: cada departamento es un círculo centrado en su capital, y un
 * punto pertenece al círculo más cercano que lo contiene. Es una aproximación
 * —los departamentos no son círculos— y cerca de un límite puede quedar en el
 * vecino. Se acepta a conciencia: la alternativa es un servicio de geocodifica-
 * ción, y esta aplicación tiene que funcionar sin señal, que es justo cuando se
 * usa. El nombre exacto del sitio va en la referencia escrita del reporte, que
 * es la que guía a quien va en camino; esta etiqueta solo ordena el listado.
 *
 * Los radios son generosos a propósito: es mejor decir "Chocó" con holgura que
 * dejar una necesidad sin ubicar.
 */
export type Zone = {
  id: string;
  /** Nombre completo, para filtros y textos explicativos. */
  label: string;
  /** Nombre corto, para las fichas donde el espacio es escaso. */
  short: string;
  center: GeoPoint;
  radiusKm: number;
};

export const ZONES: Zone[] = [
  // Pacífico y suroccidente: el foco de la emergencia actual.
  { id: "valle", label: "Valle del Cauca", short: "Valle", center: { lat: 3.4372, lng: -76.5225 }, radiusKm: 110 },
  { id: "cauca", label: "Cauca", short: "Cauca", center: { lat: 2.4448, lng: -76.6147 }, radiusKm: 140 },
  { id: "choco", label: "Chocó", short: "Chocó", center: { lat: 5.6947, lng: -76.6611 }, radiusKm: 200 },
  { id: "narino", label: "Nariño", short: "Nariño", center: { lat: 1.2136, lng: -77.2811 }, radiusKm: 140 },
  { id: "putumayo", label: "Putumayo", short: "Putumayo", center: { lat: 1.1519, lng: -76.6483 }, radiusKm: 160 },

  // Eje Cafetero y centro.
  { id: "risaralda", label: "Risaralda", short: "Risaralda", center: { lat: 4.8087, lng: -75.6906 }, radiusKm: 60 },
  { id: "quindio", label: "Quindío", short: "Quindío", center: { lat: 4.5339, lng: -75.6811 }, radiusKm: 45 },
  { id: "caldas", label: "Caldas", short: "Caldas", center: { lat: 5.0703, lng: -75.5138 }, radiusKm: 70 },
  { id: "tolima", label: "Tolima", short: "Tolima", center: { lat: 4.4389, lng: -75.2322 }, radiusKm: 120 },
  { id: "huila", label: "Huila", short: "Huila", center: { lat: 2.9273, lng: -75.2819 }, radiusKm: 130 },
  { id: "antioquia", label: "Antioquia", short: "Antioquia", center: { lat: 6.2442, lng: -75.5812 }, radiusKm: 180 },
  { id: "cundinamarca", label: "Bogotá y Cundinamarca", short: "Cundinamarca", center: { lat: 4.711, lng: -74.0721 }, radiusKm: 110 },
  { id: "boyaca", label: "Boyacá", short: "Boyacá", center: { lat: 5.5353, lng: -73.3678 }, radiusKm: 130 },
  { id: "santander", label: "Santander", short: "Santander", center: { lat: 7.1193, lng: -73.1227 }, radiusKm: 130 },
  { id: "nortedesantander", label: "Norte de Santander", short: "N. Santander", center: { lat: 7.8939, lng: -72.5078 }, radiusKm: 130 },

  // Caribe.
  { id: "atlantico", label: "Atlántico", short: "Atlántico", center: { lat: 10.9685, lng: -74.7813 }, radiusKm: 60 },
  { id: "bolivar", label: "Bolívar", short: "Bolívar", center: { lat: 10.391, lng: -75.4794 }, radiusKm: 180 },
  { id: "magdalena", label: "Magdalena", short: "Magdalena", center: { lat: 11.2408, lng: -74.199 }, radiusKm: 140 },
  { id: "cesar", label: "Cesar", short: "Cesar", center: { lat: 10.4631, lng: -73.2532 }, radiusKm: 150 },
  { id: "cordoba", label: "Córdoba", short: "Córdoba", center: { lat: 8.7479, lng: -75.8814 }, radiusKm: 120 },
  { id: "sucre", label: "Sucre", short: "Sucre", center: { lat: 9.3047, lng: -75.3978 }, radiusKm: 90 },
  { id: "laguajira", label: "La Guajira", short: "La Guajira", center: { lat: 11.5444, lng: -72.9072 }, radiusKm: 130 },
  { id: "sanandres", label: "San Andrés y Providencia", short: "San Andrés", center: { lat: 12.5847, lng: -81.7006 }, radiusKm: 80 },

  // Orinoquía y Amazonía: radios amplios porque los municipios están lejísimos
  // entre sí y una necesidad ahí no debe quedarse sin nombre.
  { id: "meta", label: "Meta", short: "Meta", center: { lat: 4.142, lng: -73.6266 }, radiusKm: 250 },
  { id: "casanare", label: "Casanare", short: "Casanare", center: { lat: 5.3378, lng: -72.3959 }, radiusKm: 160 },
  { id: "arauca", label: "Arauca", short: "Arauca", center: { lat: 7.0844, lng: -70.7591 }, radiusKm: 150 },
  { id: "vichada", label: "Vichada", short: "Vichada", center: { lat: 6.189, lng: -67.4859 }, radiusKm: 280 },
  { id: "guainia", label: "Guainía", short: "Guainía", center: { lat: 3.8653, lng: -67.9239 }, radiusKm: 250 },
  { id: "guaviare", label: "Guaviare", short: "Guaviare", center: { lat: 2.5729, lng: -72.6459 }, radiusKm: 200 },
  { id: "caqueta", label: "Caquetá", short: "Caquetá", center: { lat: 1.6144, lng: -75.6062 }, radiusKm: 220 },
  { id: "vaupes", label: "Vaupés", short: "Vaupés", center: { lat: 1.2537, lng: -70.234 }, radiusKm: 250 },
  { id: "amazonas", label: "Amazonas", short: "Amazonas", center: { lat: -4.215, lng: -69.9406 }, radiusKm: 300 },
];

/**
 * Nombres escritos que delatan la zona cuando no hay coordenadas.
 *
 * Existe porque el GPS falla justo cuando más se necesita: bajo escombros, sin
 * batería, o simplemente porque la persona no dio permiso. En los primeros
 * reportes reales, 3 de cada 8 llegaron sin punto. Varios decían "Cali" en la
 * referencia escrita y aun así quedaban en "otra zona", invisibles para un
 * voluntario de Cali que filtrara por Valle.
 *
 * Se comparan palabras completas, nunca fragmentos: "Calle 56" contiene "cali"
 * como subcadena y mandaría a media Colombia al Valle del Cauca.
 */
const NOMBRES: Record<string, string[]> = {
  valle: ["valle", "valle del cauca", "cali", "buenaventura", "palmira", "buga", "tulua", "yumbo", "jamundi", "cartago"],
  cauca: ["cauca", "popayan", "santander de quilichao", "guapi", "silvia"],
  choco: ["choco", "quibdo", "istmina", "condoto", "riosucio", "bahia solano", "nuqui"],
  narino: ["narino", "pasto", "tumaco", "ipiales", "tuquerres"],
  putumayo: ["putumayo", "mocoa", "puerto asis", "sibundoy"],
  risaralda: ["risaralda", "pereira", "dosquebradas", "santa rosa de cabal"],
  quindio: ["quindio", "armenia", "calarca", "montenegro"],
  caldas: ["caldas", "manizales", "la dorada", "chinchina", "riosucio caldas"],
  tolima: ["tolima", "ibague", "espinal", "melgar", "honda"],
  huila: ["huila", "neiva", "pitalito", "garzon"],
  antioquia: ["antioquia", "medellin", "bello", "itagui", "envigado", "apartado", "turbo", "rionegro"],
  cundinamarca: ["cundinamarca", "bogota", "soacha", "zipaquira", "girardot", "fusagasuga"],
  boyaca: ["boyaca", "tunja", "duitama", "sogamoso", "chiquinquira"],
  santander: ["santander", "bucaramanga", "floridablanca", "barrancabermeja", "giron"],
  nortedesantander: ["norte de santander", "cucuta", "ocana", "pamplona"],
  atlantico: ["atlantico", "barranquilla", "soledad", "malambo"],
  bolivar: ["bolivar", "cartagena", "magangue", "turbaco", "el carmen de bolivar"],
  magdalena: ["magdalena", "santa marta", "cienaga", "fundacion", "el banco"],
  cesar: ["cesar", "valledupar", "aguachica", "codazzi"],
  cordoba: ["cordoba", "monteria", "lorica", "sahagun", "cerete", "ayapel"],
  sucre: ["sucre", "sincelejo", "corozal", "san marcos"],
  laguajira: ["guajira", "la guajira", "riohacha", "maicao", "uribia"],
  sanandres: ["san andres", "providencia"],
  meta: ["meta", "villavicencio", "acacias", "granada meta", "puerto lopez"],
  casanare: ["casanare", "yopal", "aguazul", "villanueva"],
  arauca: ["arauca", "saravena", "tame"],
  vichada: ["vichada", "puerto carreno"],
  guainia: ["guainia", "inirida"],
  guaviare: ["guaviare", "san jose del guaviare"],
  caqueta: ["caqueta", "florencia", "san vicente del caguan"],
  vaupes: ["vaupes", "mitu"],
  amazonas: ["amazonas", "leticia"],
};

/** Sin tildes y en minúsculas: nadie escribe "Quibdó" con tilde en el celular. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deduce la zona de una referencia escrita. Devuelve null si nada calza, que es
 * lo correcto: inventar una zona es peor que admitir que no se sabe.
 */
export function zoneFromText(texto: string | null | undefined): Zone | null {
  if (!texto) return null;
  const limpio = ` ${normalizar(texto)} `;
  let mejor: { id: string; largo: number } | null = null;
  for (const [id, nombres] of Object.entries(NOMBRES)) {
    for (const nombre of nombres) {
      // Palabra completa, con espacios alrededor: descarta "cali" dentro de
      // "calle". Gana el nombre más largo, para que "san andres" no pierda
      // contra un "andres" suelto de otra lista.
      if (limpio.includes(` ${nombre} `) && (!mejor || nombre.length > mejor.largo)) {
        mejor = { id, largo: nombre.length };
      }
    }
  }
  return mejor ? zoneById(mejor.id) : null;
}

/** Identificadores válidos, incluido el comodín de lo que cae fuera del país. */
export const ZONE_IDS = [...ZONES.map((z) => z.id), "otra"];

const POR_ID = new Map(ZONES.map((z) => [z.id, z]));

export function zoneById(id: string | null | undefined): Zone | null {
  return id ? (POR_ID.get(id) ?? null) : null;
}

/** Zona a la que pertenece un punto, o null si cae fuera de todas. */
export function zoneOf(point: GeoPoint | null | undefined): Zone | null {
  if (!point) return null;
  let mejor: Zone | null = null;
  let menor = Infinity;
  for (const zona of ZONES) {
    const d = distanceKm(point, zona.center);
    if (d <= zona.radiusKm && d < menor) {
      menor = d;
      mejor = zona;
    }
  }
  return mejor;
}

/**
 * Etiqueta corta para una ficha. "Otra zona" cuando el punto queda fuera de los
 * focos conocidos: sigue siendo información útil —dice "esto no es tu zona"— y
 * evita que una necesidad legítima parezca defectuosa.
 */
export function zoneLabel(point: GeoPoint | null | undefined): string | null {
  if (!point) return null;
  return zoneOf(point)?.short ?? "Otra zona";
}

/** Nombre corto a partir del identificador guardado en la necesidad. */
export function zoneShortById(id: string | null | undefined): string {
  return zoneById(id)?.short ?? "Otra zona";
}
