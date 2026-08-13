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
  // Centro del triángulo Cali · Chocó · Pereira, la zona afectada. Bogotá
  // dejaría el mapa mirando a 250 km del problema.
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? 4.55),
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? -76.3),
};

/**
 * Zoom de arranque sin GPS ni necesidades ubicadas. Tiene que abarcar los
 * 250 km que separan Quibdó de Cali; con un zoom de barrio, quien abre el mapa
 * ve selva vacía y cree que no hay nada reportado.
 */
export const FALLBACK_ZOOM = Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM ?? 8);
