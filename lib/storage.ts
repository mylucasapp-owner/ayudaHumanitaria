/**
 * Durabilidad del almacenamiento local.
 *
 * Todo lo que sostiene la sesión de un usuario —su identidad anónima, la caché
 * del mapa y, sobre todo, los reportes escritos sin señal que aún no salieron—
 * vive en IndexedDB. Los navegadores lo consideran material desechable: lo
 * borran cuando falta espacio, y Safari en iOS lo elimina tras siete días sin
 * visitas. Para alguien que reportó y volvió a la semana, eso es perder el
 * control de su propia necesidad.
 *
 * `persist()` le pide al navegador que trate estos datos como duraderos. En
 * Chrome se concede solo si la app está instalada o hay uso real, que es otra
 * razón para invitar a instalarla.
 */
export type PersistenceState = "duradero" | "efimero" | "desconocido";

export async function requestPersistentStorage(): Promise<PersistenceState> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return "desconocido";
  }
  try {
    if (await navigator.storage.persisted()) return "duradero";
    return (await navigator.storage.persist()) ? "duradero" : "efimero";
  } catch {
    return "desconocido";
  }
}
