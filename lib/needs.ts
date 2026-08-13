import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import {
  CLAIM_LIMIT_PER_WINDOW,
  CLAIM_TTL_MS,
  CLAIM_WINDOW_MS,
  type Category,
  type Flag,
  type FlagReason,
  type GeoPoint,
  type Need,
  type NeedContact,
  type NeedStatus,
} from "./types";

export const MAX_DESCRIPTION = 140;
export const MAX_REFERENCE = 120;
const FEED_LIMIT = 300;

function needsCol() {
  return collection(db(), "needs");
}

function contactRef(needId: string) {
  return doc(db(), "needs", needId, "private", "contact");
}

function millis(value: unknown): number | null {
  const ts = value as Timestamp | undefined;
  return ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
}

function toNeed(snap: QueryDocumentSnapshot<DocumentData>): Need {
  const d = snap.data();
  const claim = d.claim
    ? {
        uid: String(d.claim.uid ?? ""),
        name: String(d.claim.name ?? "Voluntario"),
        expiresAt: Number(d.claim.expiresAt ?? 0),
        at: millis(d.claim.at),
        seq: Number(d.claim.seq ?? 0),
      }
    : null;
  return {
    id: snap.id,
    category: d.category as Category,
    description: String(d.description ?? ""),
    reference: String(d.reference ?? ""),
    location:
      d.location && typeof d.location.lat === "number"
        ? { lat: d.location.lat, lng: d.location.lng }
        : null,
    peopleCount: Number(d.peopleCount ?? 1),
    status: (d.status ?? "abierta") as NeedStatus,
    active: Boolean(d.active),
    ownerUid: String(d.ownerUid ?? ""),
    createdAt: millis(d.createdAt),
    updatedAt: millis(d.updatedAt),
    verified: Boolean(d.verified),
    verifiedByName: d.verifiedByName ? String(d.verifiedByName) : null,
    verifiedByUid: d.verifiedByUid ? String(d.verifiedByUid) : null,
    claim,
  };
}

export type NewNeed = {
  category: Category;
  description: string;
  reference: string;
  location: GeoPoint | null;
  peopleCount: number;
  contact: NeedContact;
};

export type CreatedNeed = {
  id: string;
  /** La escritura quedó en cola local y saldrá al recuperar la señal. */
  pending: boolean;
  /** Código para recuperar el reporte desde otro teléfono. */
  code: string;
};

/**
 * Alfabeto sin caracteres que se confunden al leerlos en voz alta o copiarlos
 * a mano bajo estrés: sin O ni 0, sin I ni 1.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Código de recuperación. Ocho caracteres del alfabeto anterior dan 1,1 billones
 * de combinaciones: adivinarlo es inviable, y la Cloud Function además limita
 * los intentos.
 */
function generateRecoveryCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** Se muestra en dos bloques porque así se dicta y se copia sin equivocarse. */
export function formatRecoveryCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const CODE_KEY = "ah.codigos";

/** Guarda el código localmente por comodidad; la copia que importa es la que
 *  el usuario se lleva fuera del teléfono. */
export function rememberCode(needId: string, code: string) {
  try {
    const map = JSON.parse(localStorage.getItem(CODE_KEY) ?? "{}");
    map[needId] = code;
    localStorage.setItem(CODE_KEY, JSON.stringify(map));
  } catch {
    /* sin almacenamiento el código solo vive en la pantalla del ticket */
  }
}

export function rememberedCode(needId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(CODE_KEY) ?? "{}");
    return typeof map[needId] === "string" ? map[needId] : null;
  } catch {
    return null;
  }
}

/** Plazo tras el cual damos la escritura por encolada en vez de por fallida. */
const COMMIT_ACK_MS = 2500;

/**
 * Crea la necesidad y su contacto protegido en una sola escritura atómica.
 *
 * No espera la confirmación del servidor para dar el ticket por bueno. La
 * promesa de Firestore no resuelve hasta que el backend responde, así que en
 * una zona sin cobertura la pantalla se quedaría en "Enviando…" para siempre y
 * la gente reenviaría el mismo reporte. La escritura ya está persistida en el
 * dispositivo y sale sola al reconectar: eso es suficiente para responderle al
 * usuario, siempre que se le diga la verdad sobre el estado.
 */
export async function createNeed(
  uid: string,
  input: NewNeed,
): Promise<CreatedNeed> {
  const ref = doc(needsCol());
  const batch = writeBatch(db());
  batch.set(ref, {
    category: input.category,
    description: input.description.trim().slice(0, MAX_DESCRIPTION),
    reference: input.reference.trim().slice(0, MAX_REFERENCE),
    location: input.location,
    peopleCount: input.peopleCount,
    status: "abierta" satisfies NeedStatus,
    active: true,
    ownerUid: uid,
    verified: false,
    verifiedByName: null,
    verifiedByUid: null,
    claim: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(contactRef(ref.id), {
    name: input.contact.name.trim().slice(0, 60),
    phone: input.contact.phone.trim().slice(0, 25),
    ownerUid: uid,
  });

  // El vale de recuperación viaja en el mismo lote: o existen los tres
  // documentos o no existe ninguno. Ningún cliente puede leer esta colección;
  // solo la Cloud Function que canjea el código.
  const code = generateRecoveryCode();
  batch.set(doc(db(), "recovery", code), {
    needId: ref.id,
    createdBy: uid,
    at: serverTimestamp(),
  });

  const confirmada = batch.commit();

  // Si el servidor rechaza (reglas, cuenta bloqueada) responde rápido y hay que
  // avisar. Si simplemente no hay red, no responde nunca: pasado el plazo se
  // asume encolada, que es exactamente lo que ocurrió.
  const pending = await Promise.race([
    confirmada.then(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), COMMIT_ACK_MS)),
  ]);

  // Sin este catch, un rechazo posterior queda como promesa no manejada.
  confirmada.catch(() => undefined);

  rememberCode(ref.id, code);
  return { id: ref.id, pending, code };
}

/** Feed en vivo de necesidades pendientes, lo más reciente primero. */
export function subscribeToOpenNeeds(
  onData: (needs: Need[]) => void,
  onError: (e: unknown) => void,
) {
  return onSnapshot(
    query(
      needsCol(),
      where("active", "==", true),
      orderBy("createdAt", "desc"),
      limit(FEED_LIMIT),
    ),
    (snap) => onData(snap.docs.map(toNeed)),
    onError,
  );
}

export function subscribeToMyNeeds(
  uid: string,
  onData: (needs: Need[]) => void,
  onError: (e: unknown) => void,
) {
  return onSnapshot(
    query(needsCol(), where("ownerUid", "==", uid)),
    // Sin `includeMetadataChanges` no hay forma de saber qué reportes siguen
    // solo en el teléfono, y esa es justo la información que el usuario
    // necesita antes de borrar datos del navegador o cambiar de dispositivo.
    { includeMetadataChanges: true },
    (snap) =>
      onData(
        snap.docs
          .map((d) => ({ ...toNeed(d), pendingSync: d.metadata.hasPendingWrites }))
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
      ),
    onError,
  );
}

/** Necesidades que este oferente tiene comprometidas ahora mismo. */
export function subscribeToMyClaims(
  uid: string,
  onData: (needs: Need[]) => void,
  onError: (e: unknown) => void,
) {
  return onSnapshot(
    query(needsCol(), where("claim.uid", "==", uid)),
    (snap) =>
      onData(
        snap.docs
          .map(toNeed)
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
      ),
    onError,
  );
}

export function subscribeToNeed(
  id: string,
  onData: (need: Need | null) => void,
  onError: (e: unknown) => void,
) {
  return onSnapshot(
    doc(db(), "needs", id),
    (snap) =>
      onData(snap.exists() ? toNeed(snap as QueryDocumentSnapshot<DocumentData>) : null),
    onError,
  );
}

export class ClaimTakenError extends Error {
  constructor() {
    super("Otra persona tomó esta necesidad primero.");
    this.name = "ClaimTakenError";
  }
}

export class ClaimQuotaError extends Error {
  constructor() {
    super(
      `Ya tomaste ${CLAIM_LIMIT_PER_WINDOW} necesidades en pocas horas. ` +
        "Cierra las que tienes pendientes o espera un momento.",
    );
    this.name = "ClaimQuotaError";
  }
}

export class RecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryError";
  }
}

export class OfflineError extends Error {
  constructor(accion: string) {
    super(`Necesitas señal para ${accion}. Reintenta cuando vuelva la conexión.`);
    this.name = "OfflineError";
  }
}

export class BlockedError extends Error {
  constructor() {
    super(
      "Un coordinador restringió esta sesión. Acércate a un punto de " +
        "coordinación en terreno si crees que es un error.",
    );
    this.name = "BlockedError";
  }
}

const SLOT_KEY = "ah.cupos";

/** Recuerda qué cupo se gastó en cada necesidad, para no pagar dos veces. */
function rememberedSlot(needId: string): number | null {
  try {
    const map = JSON.parse(localStorage.getItem(SLOT_KEY) ?? "{}");
    return typeof map[needId] === "number" ? map[needId] : null;
  } catch {
    return null;
  }
}

function rememberSlot(needId: string, seq: number) {
  try {
    const map = JSON.parse(localStorage.getItem(SLOT_KEY) ?? "{}");
    map[needId] = seq;
    localStorage.setItem(SLOT_KEY, JSON.stringify(map));
  } catch {
    /* sin almacenamiento se gasta un cupo extra al reintentar; no es grave */
  }
}

/**
 * Consume una posición del registro personal. La escritura es un lote atómico:
 * el slot en su posición exacta y el contador un paso adelante. Las reglas
 * rechazan cualquier otra combinación, así que el cupo no se puede esquivar
 * omitiendo el contador ni reescribiendo un slot ya usado.
 */
async function reserveSlot(uid: string, needId: string): Promise<number> {
  const ledgerRef = doc(db(), "ledger", uid);
  const snap = await getDoc(ledgerRef);
  const batch = writeBatch(db());

  let seq: number;
  if (!snap.exists()) {
    seq = 0;
    batch.set(ledgerRef, {
      total: 1,
      windowCount: 1,
      windowStart: serverTimestamp(),
    });
  } else {
    const data = snap.data();
    seq = Number(data.total ?? 0);
    const startedAt = (data.windowStart as Timestamp | undefined)?.toMillis();
    // Sin señal, un serverTimestamp aún sin confirmar se lee como null. Ante la
    // duda tratamos la ventana como vigente: pedir una ventana nueva que el
    // servidor no reconoce hace que las reglas rechacen la escritura entera.
    const fresh =
      startedAt != null && Date.now() - startedAt >= CLAIM_WINDOW_MS;
    const nextCount = fresh ? 1 : Number(data.windowCount ?? 0) + 1;
    if (!fresh && nextCount > CLAIM_LIMIT_PER_WINDOW) throw new ClaimQuotaError();
    batch.update(ledgerRef, {
      total: seq + 1,
      windowCount: nextCount,
      ...(fresh ? { windowStart: serverTimestamp() } : {}),
    });
  }

  batch.set(doc(db(), "ledger", uid, "slots", String(seq)), {
    needId,
    at: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (e) {
    // Un rechazo aquí puede ser el tope de la ventana o una cuenta bloqueada.
    // Confundirlos le dice a alguien expulsado que "espere un momento", que es
    // falso y lo deja reintentando para siempre.
    if (await isBlocked(uid)) throw new BlockedError();
    const code = (e as { code?: string })?.code ?? "";
    if (code === "permission-denied") throw new ClaimQuotaError();
    throw e; // problemas de red: que los maneje quien llamó
  }
  rememberSlot(needId, seq);
  return seq;
}

/**
 * Bloquea la necesidad para un oferente. La transacción es la garantía de que
 * dos personas no gasten recursos en lo mismo: si alguien llegó antes, falla.
 * Un compromiso vencido puede ser retomado por cualquiera.
 *
 * Antes de tomarla hay que tener cupo. Los validadores están exentos: coordinan
 * en volumen y su cuenta tiene nombre y responsable.
 */
export async function claimNeed(
  needId: string,
  uid: string,
  name: string,
  isValidator = false,
) {
  // Comprometerse exige saber si alguien llegó antes, y eso no se puede
  // resolver desde la caché local. Mejor decirlo de entrada que dejar al
  // voluntario esperando frente a una pantalla muda.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new OfflineError("tomar una necesidad");
  }
  return conPlazoDeRed(
    () => intentarCompromiso(needId, uid, name, isValidator),
    "tomar una necesidad",
  );
}

/**
 * Plazo para operaciones que no funcionan sin red. `navigator.onLine` no basta:
 * en móviles marca "en línea" con un portal cautivo o con señal que no cursa
 * datos, que es justo lo que pasa cuando una antena queda saturada.
 */
const NETWORK_DEADLINE_MS = 12000;

async function conPlazoDeRed<T>(fn: () => Promise<T>, accion: string): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        temporizador = setTimeout(
          () => reject(new OfflineError(accion)),
          NETWORK_DEADLINE_MS,
        );
      }),
    ]);
  } catch (e) {
    // Firestore avisa la falta de red con `unavailable`. Sin traducirlo, el
    // voluntario ve "no se pudo completar la acción" y no sabe si el problema
    // es suyo, de la app, o que alguien se le adelantó.
    if ((e as { code?: string })?.code === "unavailable") {
      throw new OfflineError(accion);
    }
    throw e;
  } finally {
    clearTimeout(temporizador!);
  }
}

async function intentarCompromiso(
  needId: string,
  uid: string,
  name: string,
  isValidator: boolean,
) {
  const remembered = isValidator ? null : rememberedSlot(needId);
  const seq = isValidator ? 0 : (remembered ?? (await reserveSlot(uid, needId)));

  try {
    await commitClaim(needId, uid, name, seq);
  } catch (e) {
    // Un cupo recordado puede haber quedado huérfano: por ejemplo si el
    // navegador conservó localStorage pero perdió la identidad anónima. En ese
    // caso se paga un cupo nuevo en vez de dejar la necesidad inalcanzable.
    if (remembered === null || e instanceof ClaimTakenError) throw e;
    const fresh = await reserveSlot(uid, needId);
    await commitClaim(needId, uid, name, fresh);
  }
}

async function commitClaim(
  needId: string,
  uid: string,
  name: string,
  seq: number,
) {
  const ref = doc(db(), "needs", needId);
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new ClaimTakenError();
    const data = snap.data();
    const claim = data.claim as { uid: string; expiresAt: number } | null;
    const takenByOther =
      data.status === "comprometida" &&
      claim &&
      claim.uid !== uid &&
      claim.expiresAt > Date.now();
    const closed =
      data.status === "resuelta" ||
      data.status === "falsa" ||
      data.status === "entregada";
    if (takenByOther || closed) throw new ClaimTakenError();
    tx.update(ref, {
      status: "comprometida" satisfies NeedStatus,
      active: true,
      claim: {
        uid,
        name: name.trim().slice(0, 60) || "Voluntario",
        expiresAt: Date.now() + CLAIM_TTL_MS,
        at: serverTimestamp(),
        seq,
      },
      updatedAt: serverTimestamp(),
    });
  });
}

/** Devuelve la necesidad al feed cuando el oferente no puede cumplir. */
export async function releaseNeed(needId: string) {
  await updateDoc(doc(db(), "needs", needId), {
    status: "abierta" satisfies NeedStatus,
    active: true,
    claim: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * El oferente declara la entrega. No cierra la necesidad a propósito: si quien
 * entrega pudiera cerrar, tomar y "entregar" todo bastaría para vaciar el mapa
 * sin repartir nada. Queda a la vista esperando confirmación.
 */
export async function markDelivered(needId: string) {
  await updateDoc(doc(db(), "needs", needId), {
    status: "entregada" satisfies NeedStatus,
    active: true,
    updatedAt: serverTimestamp(),
  });
}

/** Cierre real. Solo el solicitante o un validador. */
export async function resolveNeed(needId: string) {
  await updateDoc(doc(db(), "needs", needId), {
    status: "resuelta" satisfies NeedStatus,
    active: false,
    updatedAt: serverTimestamp(),
  });
}

/** Solo validadores: descarta un reporte que no pudo confirmarse. */
export async function discardNeed(needId: string) {
  await updateDoc(doc(db(), "needs", needId), {
    status: "falsa" satisfies NeedStatus,
    active: false,
    updatedAt: serverTimestamp(),
  });
}

/** Solo validadores: marca la necesidad como confirmada en terreno. */
export async function verifyNeed(
  needId: string,
  validatorName: string,
  validatorUid: string,
) {
  await updateDoc(doc(db(), "needs", needId), {
    verified: true,
    verifiedByName: validatorName.slice(0, 60),
    // Firmar con nombre no basta: queda también la cuenta que lo hizo.
    verifiedByUid: validatorUid,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Denuncia de la comunidad. Un documento por persona y necesidad: la ruta
 * impide que un mismo uid infle el conteo. Quien va al lugar y no encuentra
 * nada es la fuente más confiable que tiene la plataforma.
 */
export async function flagNeed(needId: string, uid: string, reason: FlagReason) {
  await setDoc(doc(db(), "needs", needId, "flags", uid), {
    needId,
    uid,
    reason,
    at: serverTimestamp(),
  });
}

export function subscribeToMyFlag(
  needId: string,
  uid: string,
  onData: (flagged: boolean) => void,
) {
  return onSnapshot(
    doc(db(), "needs", needId, "flags", uid),
    (snap) => onData(snap.exists()),
    () => onData(false),
  );
}

/** Solo validadores: todas las denuncias, lo más reciente primero. */
export function subscribeToFlags(
  onData: (flags: Flag[]) => void,
  onError: (e: unknown) => void,
) {
  return onSnapshot(
    query(collectionGroup(db(), "flags"), orderBy("at", "desc"), limit(200)),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const f = d.data();
          return {
            needId: String(f.needId ?? ""),
            uid: String(f.uid ?? ""),
            reason: f.reason as FlagReason,
            at: millis(f.at),
          };
        }),
      ),
    onError,
  );
}

/** Solo validadores: corta la escritura a una cuenta abusiva. */
export async function blockUser(
  targetUid: string,
  byUid: string,
  note: string,
) {
  await setDoc(doc(db(), "blocked", targetUid), {
    byUid,
    note: note.slice(0, 140),
    at: serverTimestamp(),
  });
}

export async function unblockUser(targetUid: string) {
  await deleteDoc(doc(db(), "blocked", targetUid));
}

/** ¿Esta sesión está bloqueada? La app lo dice en vez de fallar en silencio. */
export async function isBlocked(uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(db(), "blocked", uid))).exists();
  } catch {
    return false;
  }
}

/**
 * Canjea un código de recuperación y devuelve el reporte a quien lo presenta.
 *
 * Es la salida cuando la identidad del navegador se pierde: al limpiar datos,
 * al cambiar de teléfono, o porque el navegador borró el almacenamiento por su
 * cuenta. El canje lo resuelve una Cloud Function porque exige leer una
 * colección que ningún cliente puede ver.
 */
export async function recoverNeed(rawCode: string): Promise<string> {
  const codigo = normalizeRecoveryCode(rawCode);
  if (codigo.length !== 8) {
    throw new RecoveryError("El código tiene 8 caracteres, como ABCD-2345.");
  }
  try {
    const call = httpsCallable<{ codigo: string }, { needId: string }>(
      functions(),
      "recuperarReporte",
    );
    const { data } = await call({ codigo });
    return data.needId;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "functions/unavailable" || err.code === "unavailable") {
      throw new OfflineError("recuperar un reporte");
    }
    throw new RecoveryError(
      err.message?.replace(/^.*?: /, "") ??
        "No se pudo recuperar el reporte. Revisa el código.",
    );
  }
}

/**
 * Bitácora de a qué necesidades accedió una cuenta. Es lo que permite
 * investigar una fuga de teléfonos después de que ocurra.
 */
export async function fetchLedgerTrail(uid: string): Promise<string[]> {
  try {
    const snap = await getDocs(
      query(collection(db(), "ledger", uid, "slots"), limit(100)),
    );
    return snap.docs.map((d) => String(d.data().needId ?? ""));
  } catch {
    return [];
  }
}

export type ContactResult =
  | { state: "ok"; contact: NeedContact }
  | { state: "denied" }
  | { state: "missing" }
  | { state: "offline" };

/**
 * Lee el contacto. Las reglas solo lo permiten al autor, a quien tiene el
 * compromiso vigente y a los validadores. Distingue el motivo del fallo: un
 * "cargando…" eterno cuando el compromiso acaba de vencer deja al voluntario
 * sin saber que perdió el acceso.
 */
export async function fetchContact(needId: string): Promise<ContactResult> {
  try {
    const snap = await getDoc(contactRef(needId));
    if (!snap.exists()) return { state: "missing" };
    const d = snap.data();
    return {
      state: "ok",
      contact: { name: String(d.name ?? ""), phone: String(d.phone ?? "") },
    };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    return code === "permission-denied" ? { state: "denied" } : { state: "offline" };
  }
}
