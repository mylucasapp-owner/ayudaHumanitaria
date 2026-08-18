import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Category, GeoPoint } from "./types";

/**
 * Ofertas de ayuda: lo que alguien tiene y quiere dar.
 *
 * Es la dirección contraria del resto de la app. Una necesidad dice "me falta
 * esto"; una oferta dice "tengo esto". Vive en su propia colección y no como
 * otro estado de `needs` porque el ciclo de vida es distinto: una necesidad se
 * cubre una vez y se cierra, mientras que doscientas cobijas pueden repartirse
 * entre diez familias.
 *
 * EL TELÉFONO AQUÍ SÍ SE MUESTRA, al revés que en una necesidad. Quien ofrece
 * no es una persona vulnerable: publica porque quiere que lo llamen, y lo hace
 * a sabiendas. Aplicarle el mismo cupo que protege a los damnificados sería
 * ponerle un peaje justo a quien más lo necesita para poder pedirle.
 *
 * EL RIESGO REAL ES LA ESTAFA. Un tablón de ofertas en un desastre atrae a
 * quien pide un depósito por adelantado y desaparece, y la víctima es alguien
 * que ya lo perdió todo. Por eso: aviso permanente de no pagar nunca, denuncia
 * de la comunidad y verificación de coordinadores, igual que en las
 * necesidades.
 */
export const OFFER_STATUS = ["disponible", "agotada", "falsa"] as const;
export type OfferStatus = (typeof OFFER_STATUS)[number];

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  disponible: "DISPONIBLE",
  agotada: "YA NO DISPONIBLE",
  falsa: "DESCARTADA",
};

export type Offer = {
  id: string;
  category: Category;
  /** Qué se ofrece, en una frase. */
  description: string;
  /** Dónde se recoge o desde dónde se lleva. */
  reference: string;
  location: GeoPoint | null;
  /** "200 cobijas", "un camión", "3 horas los sábados". Texto libre. */
  amount: string;
  /** Nombre y teléfono de quien ofrece. Público: publicó para que lo llamen. */
  contactName: string;
  contactPhone: string;
  status: OfferStatus;
  active: boolean;
  zone: string | null;
  ownerUid: string;
  verified: boolean;
  verifiedByName: string | null;
  /**
   * Procedencia, cuando la oferta vino de otra plataforma.
   *
   * Se guarda el identificador de allá para poder volver a sincronizar sin
   * duplicar, y el nombre para mostrarlo: quien lee tiene derecho a saber de
   * dónde salió el dato y a quién preguntarle. Republicar sin decir de dónde
   * viene convierte un intercambio en una apropiación.
   */
  sourceId: string | null;
  sourceName: string | null;
  /** Enlace del socio con más información: un volante, una ficha, un formulario. */
  sourceUrl: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

export const MAX_OFFER_DESCRIPTION = 140;
export const MAX_OFFER_REFERENCE = 120;
export const MAX_OFFER_AMOUNT = 60;

const OFFER_FEED_LIMIT = 200;

function offersCol() {
  return collection(db(), "offers");
}

function toOffer(d: { id: string; data: () => Record<string, unknown> }): Offer {
  const v = d.data();
  const ms = (x: unknown) =>
    x && typeof x === "object" && "toMillis" in x
      ? (x as { toMillis: () => number }).toMillis()
      : null;
  return {
    id: d.id,
    category: (v.category as Category) ?? "otro",
    description: (v.description as string) ?? "",
    reference: (v.reference as string) ?? "",
    location: (v.location as GeoPoint | null) ?? null,
    amount: (v.amount as string) ?? "",
    contactName: (v.contactName as string) ?? "",
    contactPhone: (v.contactPhone as string) ?? "",
    status: (v.status as OfferStatus) ?? "disponible",
    active: (v.active as boolean) ?? true,
    zone: (v.zone as string | null) ?? null,
    ownerUid: (v.ownerUid as string) ?? "",
    verified: (v.verified as boolean) ?? false,
    verifiedByName: (v.verifiedByName as string | null) ?? null,
    sourceId: (v.sourceId as string | null) ?? null,
    sourceName: (v.sourceName as string | null) ?? null,
    sourceUrl: (v.sourceUrl as string | null) ?? null,
    createdAt: ms(v.createdAt),
    updatedAt: ms(v.updatedAt),
  };
}

export function subscribeToOffers(
  onData: (offers: Offer[]) => void,
  onError: (e: unknown) => void,
  zone?: string,
) {
  const filtros = [where("active", "==", true)];
  if (zone && zone !== "todas") filtros.push(where("zone", "==", zone));
  return onSnapshot(
    query(offersCol(), ...filtros, orderBy("createdAt", "desc"), limit(OFFER_FEED_LIMIT)),
    (snap) => onData(snap.docs.map(toOffer)),
    onError,
  );
}

export type OfferInput = {
  category: Category;
  description: string;
  reference: string;
  location: GeoPoint | null;
  amount: string;
  contactName: string;
  contactPhone: string;
  zone: string | null;
};

export async function createOffer(uid: string, input: OfferInput) {
  return addDoc(offersCol(), {
    category: input.category,
    description: input.description.trim().slice(0, MAX_OFFER_DESCRIPTION),
    reference: input.reference.trim().slice(0, MAX_OFFER_REFERENCE),
    location: input.location,
    amount: input.amount.trim().slice(0, MAX_OFFER_AMOUNT),
    contactName: input.contactName.trim().slice(0, 60),
    contactPhone: input.contactPhone.trim().slice(0, 25),
    status: "disponible" satisfies OfferStatus,
    active: true,
    zone: input.zone,
    ownerUid: uid,
    verified: false,
    verifiedByName: null,
    sourceId: null,
    sourceName: null,
    sourceUrl: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Quien ofrece marca que ya se acabó. No se borra: sirve de histórico. */
export async function closeOffer(offerId: string) {
  await updateDoc(doc(db(), "offers", offerId), {
    status: "agotada" satisfies OfferStatus,
    active: false,
    updatedAt: serverTimestamp(),
  });
}

/** Solo coordinadores: confirma que la oferta es real. */
export async function verifyOffer(offerId: string, nombre: string) {
  await updateDoc(doc(db(), "offers", offerId), {
    verified: true,
    verifiedByName: nombre.slice(0, 60),
    updatedAt: serverTimestamp(),
  });
}

/** Solo coordinadores: descarta una oferta falsa o una estafa. */
export async function discardOffer(offerId: string) {
  await updateDoc(doc(db(), "offers", offerId), {
    status: "falsa" satisfies OfferStatus,
    active: false,
    updatedAt: serverTimestamp(),
  });
}
