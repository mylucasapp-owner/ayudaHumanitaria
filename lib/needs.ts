import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  CLAIM_TTL_MS,
  type Category,
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

/** Crea la necesidad y su contacto protegido en una sola escritura atómica. */
export async function createNeed(uid: string, input: NewNeed): Promise<string> {
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
    claim: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(contactRef(ref.id), {
    name: input.contact.name.trim().slice(0, 60),
    phone: input.contact.phone.trim().slice(0, 25),
    ownerUid: uid,
  });
  await batch.commit();
  return ref.id;
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
    (snap) =>
      onData(
        snap.docs
          .map(toNeed)
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

/**
 * Bloquea la necesidad para un oferente. La transacción es la garantía de que
 * dos personas no gasten recursos en lo mismo: si alguien llegó antes, falla.
 * Un compromiso vencido puede ser retomado por cualquiera.
 */
export async function claimNeed(needId: string, uid: string, name: string) {
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
    if (takenByOther || data.status === "resuelta" || data.status === "falsa") {
      throw new ClaimTakenError();
    }
    tx.update(ref, {
      status: "comprometida" satisfies NeedStatus,
      active: true,
      claim: {
        uid,
        name: name.trim().slice(0, 60) || "Voluntario",
        expiresAt: Date.now() + CLAIM_TTL_MS,
        at: serverTimestamp(),
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
export async function verifyNeed(needId: string, validatorName: string) {
  await updateDoc(doc(db(), "needs", needId), {
    verified: true,
    verifiedByName: validatorName.slice(0, 60),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Lee el contacto. Las reglas solo lo permiten al autor, a quien tiene el
 * compromiso vigente y a los validadores; para el resto devuelve null.
 */
export async function fetchContact(needId: string): Promise<NeedContact | null> {
  try {
    const snap = await getDoc(contactRef(needId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { name: String(d.name ?? ""), phone: String(d.phone ?? "") };
  } catch {
    return null;
  }
}
