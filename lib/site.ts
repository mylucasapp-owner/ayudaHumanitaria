/** Datos de identidad y contacto de la plataforma, en un solo lugar. */
export const SITE = {
  name: "Ayuda Humanitaria",
  author: "Mateo CM",
  org: "El Errante Coding Labs",
  authorFull: "Mateo CM — El Errante Coding Labs",
  url: "https://ayuda-humanitaria-89e72.web.app",
  /** Canal para ejercer derechos sobre datos personales y reportar abusos. */
  contactEmail: "errantelegal@gmail.com",
  /** Línea única de emergencias en Colombia. */
  emergencyNumber: "123",
  updatedAt: "13 de agosto de 2026",
} as const;

/**
 * Dominio desde el que mirar, para armar enlaces que se van a compartir.
 *
 * Al estrenar dominio propio hay una temporada en que conviven los dos: el
 * viejo `.web.app` sigue vivo para siempre y hay cadenas de WhatsApp que lo
 * llevan. Si los enlaces se armaran siempre con una constante, quien entra por
 * uno compartiría el otro, y en el peor momento —mientras el DNS propaga— podría
 * repartir un dominio que todavía no responde.
 *
 * Tomando el origen real se comparte siempre algo que acaba de funcionar: es
 * literalmente la página que la persona está viendo. `SITE.url` queda como
 * respaldo para lo que se genera en construcción, donde no hay navegador.
 */
export function origenActual(): string {
  if (typeof window === "undefined") return SITE.url;
  return window.location.origin;
}
