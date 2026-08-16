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
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
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


/**
 * API publica de lectura, para que otras plataformas usen estos datos.
 *
 * Nace de querer coordinarse con otros desarrollos en vez de competir por los
 * mismos damnificados. En una emergencia, tres mapas distintos con datos
 * parciales son peores que uno con todos: la gente no sabe cual mirar.
 *
 * QUE SE ABRE Y QUE NO, y es la decision de diseno de todo esto:
 *
 * - Los PUNTOS (albergues, acopios, salud, agua, comida) se abren enteros. Son
 *   instituciones, no personas. Su telefono ya es publico dentro de la app
 *   porque llamar antes de caminar dos horas con ninos es exactamente lo que
 *   queremos. Compartirlos no cuesta nada y hace que un albergue aparezca en
 *   todos los mapas a la vez.
 *
 * - Las NECESIDADES solo salen agregadas: cuantas hay por zona, tipo y estado.
 *   Sin descripcion, sin referencia, sin ubicacion exacta. Una referencia como
 *   "Carrera 16 #3-51" junto a "insulina para mi tia que depende de esto"
 *   identifica a una persona vulnerable, y una API abierta convierte cosechar
 *   todas esas direcciones en una sola peticion. Esta app ya gasta un cupo por
 *   cada telefono que revela, precisamente para que nadie los coseche; abrir
 *   las direcciones de par en par contradiria esa misma decision.
 *
 * Para el detalle individual hara falta una llave por organizacion. Mientras no
 * exista, quien necesite ese nivel puede pedirlo por el correo de contacto.
 *
 * El cache de 5 minutos no es cosmetico: lo sirve el CDN de Hosting, asi que mil
 * consumidores no son mil lecturas de Firestore. Es lo que hace que abrir esto
 * no pueda dispararle la factura a un proyecto sin animo de lucro.
 */
export const api = onRequest(
  { region: REGION, cors: true, memory: "256MiB" },
  async (req, res) => {
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");
    res.set("Access-Control-Allow-Origin", "*");

    const ruta = req.path.replace(/^\/api/, "").replace(/\/$/, "");

    try {
      if (ruta === "/puntos.geojson" || ruta === "/puntos") {
        const snap = await db
          .collection("places")
          .where("active", "==", true)
          .limit(1000)
          .get();

        // GeoJSON porque lo entiende cualquier herramienta de mapas sin
        // conversion. Los puntos sin coordenadas van con geometria nula, que es
        // valido: se pierden en un mapa pero no en una lista, y omitirlos seria
        // esconder albergues que existen.
        res.json({
          type: "FeatureCollection",
          generado: new Date().toISOString(),
          fuente: "Ayuda Humanitaria",
          licencia: "Uso libre citando la fuente",
          features: snap.docs.map((d) => {
            const v = d.data();
            const loc = v.location as { lat: number; lng: number } | null;
            return {
              type: "Feature",
              id: d.id,
              geometry: loc
                ? { type: "Point", coordinates: [loc.lng, loc.lat] }
                : null,
              properties: {
                tipo: v.kind,
                nombre: v.name,
                direccion: v.reference,
                horario: v.schedule,
                notas: v.notes,
                telefono: v.phone,
                zona: v.zone,
                // Se expone el estado de confianza, no solo el dato. Un punto
                // sin confirmar sigue siendo util, pero quien lo republique
                // tiene que poder decirlo igual que lo decimos nosotros.
                confirmadoEnTerreno: v.confirmed === true,
                confirmadoPor: v.confirmedByName ?? null,
                publicadoPor: v.createdByName,
                actualizado: v.updatedAt?.toDate?.()?.toISOString() ?? null,
              },
            };
          }),
        });
        return;
      }

      if (ruta === "/resumen.json" || ruta === "/resumen") {
        const snap = await db
          .collection("needs")
          .where("active", "==", true)
          .limit(2000)
          .get();

        const porZona: Record<string, number> = {};
        const porCategoria: Record<string, number> = {};
        const porEstado: Record<string, number> = {};
        for (const d of snap.docs) {
          const v = d.data();
          const z = String(v.zone ?? "otra");
          const c = String(v.category ?? "otro");
          const e = String(v.status ?? "abierta");
          porZona[z] = (porZona[z] ?? 0) + 1;
          porCategoria[c] = (porCategoria[c] ?? 0) + 1;
          porEstado[e] = (porEstado[e] ?? 0) + 1;
        }

        res.json({
          generado: new Date().toISOString(),
          fuente: "Ayuda Humanitaria",
          abiertas: snap.size,
          porZona,
          porCategoria,
          porEstado,
          nota:
            "Solo agregados. El detalle de cada necesidad lleva la referencia " +
            "escrita de una persona damnificada y no se abre sin acuerdo previo.",
        });
        return;
      }

      res.status(404).json({
        error: "Ruta desconocida",
        disponibles: ["/api/puntos.geojson", "/api/resumen.json"],
      });
    } catch (e) {
      logger.error("fallo en la api publica", e);
      res.status(500).json({ error: "No se pudo servir la consulta" });
    }
  },
);
