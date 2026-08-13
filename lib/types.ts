export const CATEGORIES = [
  "medico",
  "rescate",
  "agua",
  "refugio",
  "transporte",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  medico: "MÉDICO",
  rescate: "RESCATE",
  agua: "AGUA / ALIMENTO",
  refugio: "REFUGIO",
  transporte: "TRANSPORTE",
};

/** Glifo de una sola letra para los pines del mapa, legible a 30px. */
export const CATEGORY_GLYPH: Record<Category, string> = {
  medico: "+",
  rescate: "!",
  agua: "A",
  refugio: "R",
  transporte: "T",
};

/** Ejemplo mostrado como placeholder para que el reporte sea concreto. */
export const CATEGORY_HINT: Record<Category, string> = {
  medico: "Ej: insulina para 2 adultos mayores",
  rescate: "Ej: 3 personas atrapadas, edificio 2 pisos",
  agua: "Ej: agua potable para 12 personas, 2 bebés",
  refugio: "Ej: carpa y frazadas para familia de 5",
  transporte: "Ej: traslado de herido a hospital regional",
};

/**
 * abierta      → nadie la ha tomado.
 * comprometida → un oferente la bloqueó; no debe duplicarse el esfuerzo.
 * resuelta     → la ayuda llegó (cierre por solicitante o validador).
 * falsa        → reporte no verificable, descartado por un validador.
 */
export type NeedStatus = "abierta" | "comprometida" | "resuelta" | "falsa";

export const STATUS_LABEL: Record<NeedStatus, string> = {
  abierta: "ABIERTA",
  comprometida: "COMPROMETIDA",
  resuelta: "RESUELTA",
  falsa: "DESCARTADA",
};

export type GeoPoint = { lat: number; lng: number };

export type Need = {
  id: string;
  category: Category;
  description: string;
  /** Referencia escrita a mano; puede ser lo único que haya si el GPS falla. */
  reference: string;
  location: GeoPoint | null;
  peopleCount: number;
  status: NeedStatus;
  /** Espejo de `status` para consultar sin índices compuestos por estado. */
  active: boolean;
  ownerUid: string;
  createdAt: number | null;
  updatedAt: number | null;
  /** Un validador confirmó en terreno o por teléfono que la necesidad es real. */
  verified: boolean;
  verifiedByName: string | null;
  claim: Claim | null;
};

export type Claim = {
  uid: string;
  name: string;
  /** ms epoch; pasado este instante cualquiera puede retomar la necesidad. */
  expiresAt: number;
  at: number | null;
};

/**
 * Datos de contacto. Viven en una subcolección aparte porque las reglas de
 * Firestore protegen documentos completos, no campos: así el teléfono solo se
 * revela a quien se comprometió, al autor y a los validadores.
 */
export type NeedContact = {
  name: string;
  phone: string;
};

/** Duración del bloqueo de una necesidad comprometida. */
export const CLAIM_TTL_MS = 3 * 60 * 60 * 1000;

export function isClaimExpired(need: Need, now = Date.now()): boolean {
  return !!need.claim && need.claim.expiresAt <= now;
}
