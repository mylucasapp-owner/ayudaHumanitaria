import { distanceKm } from "./geo";
import type { GeoPoint } from "./types";

/**
 * Focos de la emergencia.
 *
 * Existen porque las necesidades están repartidas en cientos de kilómetros y
 * una referencia escrita —"Vereda La Suiza", "Corregimiento sobre el río"— no
 * le dice nada a quien no es de ahí. Sin esta etiqueta, un voluntario en Cali
 * no tiene forma de saber que lo que está leyendo queda a 250 km.
 *
 * ESTE ES EL ÚNICO LUGAR A EDITAR para desplegar la plataforma en otra
 * emergencia. Los radios son generosos a propósito: es mejor decir "Chocó" con
 * holgura que dejar una necesidad sin ubicar.
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
  {
    id: "cali",
    label: "Cali y Valle del Cauca",
    short: "Cali",
    center: { lat: 3.4372, lng: -76.5225 },
    radiusKm: 80,
  },
  {
    id: "pereira",
    label: "Pereira y Eje Cafetero",
    short: "Pereira",
    center: { lat: 4.8087, lng: -75.6906 },
    radiusKm: 80,
  },
  {
    id: "choco",
    label: "Chocó",
    short: "Chocó",
    center: { lat: 5.6947, lng: -76.6611 },
    radiusKm: 150,
  },
];

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
