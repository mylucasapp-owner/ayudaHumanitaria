import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, isFirebaseConfigured } from "./firebase";

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

/**
 * Cola en el teléfono para los fallos que no se pueden enviar todavía.
 *
 * La pantalla de error de React no pasa por el proveedor de sesión: ahí Firebase
 * Auth ni se inicializa, y las reglas —con razón— no aceptan escrituras sin
 * sesión. Abrirlas seria dejar un endpoint publico de escritura a internet.
 *
 * Así que el fallo se guarda y se envía en el siguiente arranque normal de la
 * app, que es cuando ya hay sesión. Llega unos minutos tarde y llega completo,
 * que es infinitamente mejor que no enterarse: una caída total de las fichas de
 * necesidad estuvo en producción sin aparecer en ningún diagnóstico.
 */
const COLA = "ah.fallos.pendientes";
const MAX_EN_COLA = 5;

type Registro = Record<string, unknown>;

function encolar(registro: Registro): void {
  try {
    const previos: Registro[] = JSON.parse(localStorage.getItem(COLA) ?? "[]");
    localStorage.setItem(
      COLA,
      JSON.stringify([...previos, registro].slice(-MAX_EN_COLA)),
    );
  } catch {
    /* sin almacenamiento el fallo se pierde; no hay nada mejor que hacer */
  }
}

/** Vacía la cola. Si falla el envío, se deja para el próximo arranque. */
async function vaciarCola(): Promise<void> {
  let pendientes: Registro[] = [];
  try {
    pendientes = JSON.parse(localStorage.getItem(COLA) ?? "[]");
  } catch {
    return;
  }
  if (pendientes.length === 0) return;
  try {
    for (const r of pendientes) {
      await addDoc(collection(db(), "diagnostics"), {
        ...r,
        at: serverTimestamp(),
      });
    }
    localStorage.removeItem(COLA);
  } catch {
    /* se reintenta en el próximo arranque */
  }
}

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
 * Saca algo legible de lo que sea que se rechazó.
 *
 * No todo lo que llega aquí es un Error. Una promesa puede rechazarse con un
 * Event —una imagen que no cargó, una petición abortada— y `String(evento)` da
 * "[object Event]", que no le sirve a nadie. El primer fallo real registrado en
 * producción fue exactamente eso: se supo que algo falló y nada más.
 */
function describir(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof Event !== "undefined" && error instanceof Event) {
    const destino = error.target as
      | { tagName?: string; src?: string; url?: string }
      | undefined;
    const que =
      destino?.src ?? destino?.url ?? destino?.tagName ?? "sin destino";
    return `evento ${error.type} en ${que}`;
  }

  if (error && typeof error === "object") {
    const o = error as { code?: unknown; message?: unknown; name?: unknown };
    // Los errores de Firebase traen `code`, que es lo que de verdad identifica
    // el problema ("permission-denied", "unavailable").
    if (o.code || o.message) {
      return [o.code, o.name, o.message].filter(Boolean).join(" · ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
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

    const mensaje = recortar(describir(error), MAX_MENSAJE);

    // Se agrupa por origen y mensaje: mil repeticiones del mismo fallo no
    // aportan más que la primera, y sí cuestan escrituras.
    const huella = `${origen}:${mensaje}`;
    if (vistos.has(huella)) return;
    vistos.add(huella);
    enviados += 1;

    const registro = {
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
    };

    // Sin sesión no se puede escribir: se guarda para el próximo arranque.
    if (!auth().currentUser) {
      encolar(registro);
      return;
    }
    await addDoc(collection(db(), "diagnostics"), {
      ...registro,
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

  // En cuanto haya sesión se envía lo que quedó pendiente de una pantalla de
  // error anterior, que es justo lo que antes se perdía entero.
  if (isFirebaseConfigured) {
    try {
      onAuthStateChanged(auth(), (usuario) => {
        if (usuario) void vaciarCola();
      });
    } catch {
      /* sin auth no hay nada que vaciar */
    }
  }
}
