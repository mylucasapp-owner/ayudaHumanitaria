/**
 * Fuente de teselas. Por defecto OpenStreetMap (sin llave, disponible en
 * minutos). Para operaciones de alto tráfico, define la variable de entorno
 * con un proveedor propio: la política de uso de OSM no cubre picos masivos.
 */
export const TILE_URL =
  process.env.NEXT_PUBLIC_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || "&copy; OpenStreetMap";

/**
 * Centro por defecto cuando aún no hay GPS ni necesidades ubicadas.
 * Se cambia por variables de entorno al desplegar en otra emergencia.
 */
export const FALLBACK_CENTER = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? 4.711),
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? -74.0721),
};
