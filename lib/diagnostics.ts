import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

/**
 * Registro de fallos del cliente.
 *
 * Existe porque hasta ahora no había forma de enterarse de nada. Si la app se
 * rompe para una parte de la gente —un navegador viejo, un permiso denegado, un
 * despliegue a medias— nadie lo sabe salvo que alguien se tome el trabajo de
 * escribir. Con difusión masiva eso deja de ser aceptable: lo más probable es
 * que quien falla simplemente se vaya, y el fallo se vea como desinterés.
 *
 * NO se usa un servicio externo a propósito. Un payload de error puede arrastrar
 * la descripción de una necesidad, una referencia con la dirección de alguien o
 * un teléfono; mandar eso a un tercero contradice todo lo demás que hace esta
 * app con los datos de los damnificados. Los errores se quedan en el mismo
 * proyecto, bajo las mismas reglas.
 *
 * QUÉ SE GUARDA: solo campos técnicos, y la lista es cerrada tanto aquí como en
 * las reglas. Ningún texto escrito por una persona entra en este documento.
 */

/** Tope por sesión. Un bucle de renderizado podría escribir miles si no. */
const MAX_POR_SESION = 5;

/** Recorte del mensaje y de la pila: lo que no cabe aquí no ayuda a depurar. */
const MAX_MENSAJE = 300;
const MAX_PILA = 1200;

let enviados = 0;
const vistos = new Set<string>();
let instalado = false;

function recortar(texto: unknown, tope: number): string {
  return String(texto ?? "").slice(0, tope);
}

/**
 * Anota un fallo. Nunca lanza: un error dentro del registro de errores dejaría
 * a la persona sin la pantalla que estaba usando, que es peor que no enterarse.
 */
export async function anotarFallo(
  origen: string,
  error: unknown,
  extra?: string,
): Promise<void> {
  try {
    if (!isFirebaseConfigured) return;
    if (enviados >= MAX_POR_SESION) return;

    const mensaje = recortar(
      error instanceof Error ? error.message : error,
      MAX_MENSAJE,
    );

    // Se agrupa por origen y mensaje: mil repeticiones del mismo fallo no
    // aportan más que la primera, y sí cuestan escrituras.
    const huella = `${origen}:${mensaje}`;
    if (vistos.has(huella)) return;
    vistos.add(huella);
    enviados += 1;

    await addDoc(collection(db(), "diagnostics"), {
      origen: recortar(origen, 60),
      mensaje,
      pila: recortar(error instanceof Error ? (error.stack ?? "") : "", MAX_PILA),
      // La ruta sin querystring: el id de una necesidad no aporta a depurar y
      // sí serviría para reconstruir quién miró qué.
      ruta: recortar(
        typeof location !== "undefined" ? location.pathname : "",
        120,
      ),
      agente: recortar(
        typeof navigator !== "undefined" ? navigator.userAgent : "",
        200,
      ),
      enLinea: typeof navigator !== "undefined" ? navigator.onLine : true,
      extra: recortar(extra ?? "", 200),
      at: serverTimestamp(),
    });
  } catch {
    /* Si no se puede anotar el fallo, no pasa nada más. */
  }
}

/**
 * Engancha los fallos que nadie captura: excepciones sueltas y promesas
 * rechazadas. Es donde aparecen los que de verdad no se ven venir.
 */
export function instalarDiagnostico(): void {
  if (instalado || typeof window === "undefined") return;
  instalado = true;

  window.addEventListener("error", (e) => {
    void anotarFallo("window.error", e.error ?? e.message);
  });

  window.addEventListener("unhandledrejection", (e) => {
    void anotarFallo("promesa.sin.capturar", e.reason);
  });
}
