/**
 * Defensas que no se pueden expresar en reglas de Firestore.
 *
 * Las reglas validan una escritura contra el estado previo, de a una. No pueden
 * contar, no pueden mirar hacia atrás en el tiempo y no pueden actuar solas.
 * Todo lo que necesita esas tres cosas vive aquí.
 *
 * Criterio de diseño: ninguna de estas funciones está en el camino crítico de
 * un damnificado. Publicar una necesidad sigue siendo una escritura directa a
 * Firestore, que funciona sin señal y se encola. Si estas funciones se caen, la
 * plataforma sigue sirviendo; solo pierde vigilancia.
 */
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

initializeApp();
const db = getFirestore();

const REGION = "us-east1";

/** Publicaciones por hora que delatan un script y no a una persona. */
const BURST_LIMIT = 12;
const BURST_WINDOW_MS = 60 * 60 * 1000;

/** Días que se conserva el teléfono de una necesidad ya cerrada. */
const CONTACT_RETENTION_DAYS = 30;

/** Horas que una entrega puede esperar confirmación antes de reabrirse. */
const DELIVERY_GRACE_HOURS = 72;

/**
 * Detección de ráfagas de publicación.
 *
 * Es el límite que las reglas no pueden imponer: un contador escrito por el
 * cliente se esquiva no incrementándolo, y no hay forma de contar documentos
 * desde una regla. Aquí sí.
 *
 * Actúa DESPUÉS de la escritura, a propósito. Interponer una función en la
 * creación de necesidades sacrificaría el modo sin conexión y agregaría un
 * arranque en frío al momento más urgente de la app. Detectar en segundos y
 * cortar hacia adelante es el mejor canje.
 */
export const detectarRafagaDePublicaciones = onDocumentCreated(
  { document: "needs/{needId}", region: REGION },
  async (event) => {
    const need = event.data?.data();
    const ownerUid = need?.ownerUid as string | undefined;
    if (!ownerUid) return;

    const since = Timestamp.fromMillis(Date.now() - BURST_WINDOW_MS);
    const recientes = await db
      .collection("needs")
      .where("ownerUid", "==", ownerUid)
      .where("createdAt", ">=", since)
      .count()
      .get();

    const total = recientes.data().count;
    if (total <= BURST_LIMIT) return;

    // Un validador acreditado puede publicar en volumen legítimamente.
    const esValidador = (await db.doc(`validators/${ownerUid}`).get()).exists;
    if (esValidador) return;

    const yaBloqueado = (await db.doc(`blocked/${ownerUid}`).get()).exists;
    if (!yaBloqueado) {
      await db.doc(`blocked/${ownerUid}`).set({
        byUid: "system",
        note: `Publicó ${total} necesidades en una hora`,
        at: FieldValue.serverTimestamp(),
      });
      logger.warn("cuenta bloqueada por ráfaga", { ownerUid, total });
    }

    // No se descarta ninguna necesidad automáticamente: si el que reporta en
    // ráfaga fuera un coordinador improvisado con gente real a cargo, borrarlas
    // sería el peor error posible. Se marcan para que un humano decida.
    await db
      .doc(`needs/${event.params.needId}/flags/system`)
      .set({
        needId: event.params.needId,
        uid: "system",
        reason: "volumen-inusual",
        at: FieldValue.serverTimestamp(),
      });
  },
);

/**
 * Canje del código de recuperación.
 *
 * La identidad de un usuario vive en el almacenamiento del navegador, que es
 * material desechable: se pierde al limpiar datos, al cambiar de teléfono, o
 * simplemente porque Safari borra el almacenamiento tras siete días sin
 * visitas. Sin esta función, alguien que reportó y volvió a la semana ya no
 * podría cerrar su propia necesidad ni ver quién la tomó.
 *
 * El código es el secreto: la colección `recovery` es ilegible para todo
 * cliente. Canjearlo transfiere la titularidad del reporte a quien lo presenta.
 */
const RECOVERY_ATTEMPT_LIMIT = 5;
const RECOVERY_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

export const recuperarReporte = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sesión no iniciada.");

  const code = String(request.data?.codigo ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (code.length !== 8) {
    throw new HttpsError("invalid-argument", "El código tiene 8 caracteres.");
  }

  // Freno de fuerza bruta. Sin esto, 1,1 billones de combinaciones se recorren
  // con paciencia y un script.
  const intentosRef = db.doc(`recoveryAttempts/${uid}`);
  const intentos = await intentosRef.get();
  const ahora = Date.now();
  const desde = intentos.get("windowStart")?.toMillis?.() ?? 0;
  const dentroDeVentana = ahora - desde < RECOVERY_ATTEMPT_WINDOW_MS;
  const usados = dentroDeVentana ? (intentos.get("count") ?? 0) : 0;

  if (usados >= RECOVERY_ATTEMPT_LIMIT) {
    throw new HttpsError(
      "resource-exhausted",
      "Demasiados intentos. Espera una hora y vuelve a probar.",
    );
  }
  await intentosRef.set({
    count: usados + 1,
    windowStart: dentroDeVentana
      ? intentos.get("windowStart")
      : FieldValue.serverTimestamp(),
  });

  const vale = await db.doc(`recovery/${code}`).get();
  if (!vale.exists) {
    throw new HttpsError("not-found", "Ese código no corresponde a ningún reporte.");
  }

  const needId = vale.get("needId") as string;
  const createdBy = vale.get("createdBy") as string;
  const needRef = db.doc(`needs/${needId}`);
  const need = await needRef.get();
  if (!need.exists) {
    throw new HttpsError("not-found", "El reporte ya no existe.");
  }

  // Impide que alguien registre un código apuntando al reporte de otro y luego
  // lo canjee: el vale solo vale si lo creó el mismo que publicó.
  if (need.get("ownerUid") !== createdBy) {
    logger.warn("vale de recuperación que no corresponde al autor", {
      needId,
      createdBy,
    });
    throw new HttpsError("permission-denied", "Ese código no es válido.");
  }

  if ((await db.doc(`blocked/${uid}`).get()).exists) {
    throw new HttpsError("permission-denied", "Esta sesión está restringida.");
  }

  await needRef.update({ ownerUid: uid, updatedAt: FieldValue.serverTimestamp() });
  // El contacto guarda su propio `ownerUid`; sin actualizarlo el nuevo titular
  // podría leerlo pero no corregir el teléfono.
  await needRef
    .collection("private")
    .doc("contact")
    .set({ ownerUid: uid }, { merge: true });
  await db.doc(`recovery/${code}`).set({ createdBy: uid }, { merge: true });

  logger.info("reporte recuperado", { needId, uid });
  return { needId };
});

/**
 * Retención de datos personales.
 *
 * Los reportes guardan teléfono y coordenadas de gente vulnerable. Una vez
 * cerrada la necesidad ese dato ya no cumple ninguna función y solo puede
 * hacer daño si se filtra. La necesidad se conserva —es la auditoría de la
 * emergencia— pero sin el contacto.
 */
export const purgarContactosCerrados = onSchedule(
  { schedule: "every day 04:00", timeZone: "America/Bogota", region: REGION },
  async () => {
    const corte = Timestamp.fromMillis(
      Date.now() - CONTACT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const cerradas = await db
      .collection("needs")
      .where("active", "==", false)
      .where("updatedAt", "<", corte)
      .limit(400)
      .get();

    let purgados = 0;
    for (const necesidad of cerradas.docs) {
      const contacto = necesidad.ref.collection("private").doc("contact");
      if (!(await contacto.get()).exists) continue;
      await contacto.delete();
      purgados++;
    }

    logger.info("purga de contactos", {
      revisadas: cerradas.size,
      purgados,
    });
  },
);

/**
 * Entregas que nadie confirmó.
 *
 * Una necesidad declarada "entregada" que nadie confirma se queda en el limbo:
 * ni cubierta ni disponible. Pasado el plazo se reabre.
 *
 * Reabrir puede provocar una entrega duplicada si la ayuda sí había llegado.
 * Se asume ese costo: en una emergencia, que una familia reciba dos veces es
 * mucho menos grave que una familia que nunca recibió y quedó invisible.
 */
export const reabrirEntregasSinConfirmar = onSchedule(
  { schedule: "every 6 hours", timeZone: "America/Bogota", region: REGION },
  async () => {
    const corte = Timestamp.fromMillis(
      Date.now() - DELIVERY_GRACE_HOURS * 60 * 60 * 1000,
    );

    const estancadas = await db
      .collection("needs")
      .where("status", "==", "entregada")
      .where("updatedAt", "<", corte)
      .limit(200)
      .get();

    for (const necesidad of estancadas.docs) {
      await necesidad.ref.update({
        status: "abierta",
        active: true,
        claim: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await necesidad.ref
        .collection("flags")
        .doc("system")
        .set({
          needId: necesidad.id,
          uid: "system",
          reason: "entrega-sin-confirmar",
          at: FieldValue.serverTimestamp(),
        });
    }

    logger.info("entregas reabiertas", { total: estancadas.size });
  },
);
