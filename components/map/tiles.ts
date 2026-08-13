/**
 * Fuente de teselas. Por defecto OpenStreetMap (sin llave, disponible en
 * minutos). Para operaciones de alto tráfico, define la variable de entorno
 * con un proveedor propio: la política de uso de OSM no cubre picos masivos y
 * el bloqueo, cuando llega, es silencioso.
 *
 * El proveedor debe enviar cabeceras CORS. Sin ellas Leaflet ni siquiera pinta
 * la tesela —se piden con `crossOrigin`— y el service worker no puede
 * guardarlas, que es lo que sostiene el mapa sin señal.
 */
export const TILE_URL =
  process.env.NEXT_PUBLIC_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * La atribución no es decorativa: es la condición de licencia bajo la que se
 * puede usar el mapa. Si se cambia de proveedor hay que cambiarla con él.
 */
export const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * Cada nivel de zoom cuadruplica las teselas posibles. El 17 ya muestra calles
 * con número; pasar de ahí multiplica el tráfico —y el riesgo de bloqueo— sin
 * aportar nada para ubicar una casa.
 */
export const TILE_MAX_ZOOM = Number(process.env.NEXT_PUBLIC_TILE_MAX_ZOOM ?? 17);

/**
 * Invertir las teselas por CSS solo tiene sentido si el proveedor entrega mapa
 * claro. Aplicarlo sobre un estilo ya oscuro lo devuelve a blanco, que es justo
 * lo que la app evita: reflejo al sol y batería de más.
 */
export const TILE_INVERT = process.env.NEXT_PUBLIC_TILE_DARK_FILTER === "1";

/** Clase del contenedor del mapa según haga falta invertir o no. */
export const mapClass = (base: string) =>
  TILE_INVERT ? `${base} map--invertido` : base;

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
