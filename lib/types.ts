export const CATEGORIES = [
  "medico",
  "rescate",
  "agua",
  "refugio",
  "transporte",
  "otro",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  medico: "MÉDICO",
  rescate: "RESCATE",
  agua: "AGUA / ALIMENTO",
  refugio: "REFUGIO",
  transporte: "TRANSPORTE",
  otro: "OTRA AYUDA",
};

/** Glifo de una sola letra para los pines del mapa, legible a 30px. */
export const CATEGORY_GLYPH: Record<Category, string> = {
  medico: "+",
  rescate: "!",
  agua: "A",
  refugio: "R",
  transporte: "T",
  otro: "O",
};

/** Ejemplo mostrado como placeholder para que el reporte sea concreto. */
export const CATEGORY_HINT: Record<Category, string> = {
  medico: "Ej: insulina para 2 adultos mayores",
  rescate: "Ej: 3 personas atrapadas, edificio 2 pisos",
  agua: "Ej: agua potable para 12 personas, 2 bebés",
  refugio: "Ej: carpa y frazadas para familia de 5",
  transporte: "Ej: traslado de herido a hospital regional",
  otro: "Ej: evaluar daños de la casa antes de volver a habitarla",
};

/**
 * Qué cabe en "OTRA AYUDA". Una emergencia produce necesidades que no entran en
 * ninguna casilla —peritar una vivienda agrietada, un servicio funerario, un
 * veterinario para los animales de los que vive una familia— y sin este cajón
 * quedaban forzadas dentro de "MÉDICO" o sin reportar. Se muestra bajo el campo
 * para que nadie descarte su necesidad por creer que no aplica.
 */
export const OTHER_EXAMPLES = [
  "Evaluación de daños de la vivienda",
  "Servicios funerarios",
  "Atención veterinaria o para animales de trabajo",
  "Documentos perdidos",
  "Otros elementos de supervivencia",
];

/**
 * abierta      → nadie la ha tomado.
 * comprometida → un oferente la bloqueó; no debe duplicarse el esfuerzo.
 * entregada    → el oferente dice haber entregado. NO cierra la necesidad:
 *                sigue visible hasta que el solicitante o un validador lo
 *                confirmen. Si el oferente pudiera cerrarla por su cuenta,
 *                bastaría con tomar y "entregar" todo para vaciar el mapa.
 * resuelta      → confirmada por el solicitante o un validador. Cierra.
 * falsa         → reporte no verificable, descartado por un validador.
 */
export type NeedStatus =
  | "abierta"
  | "comprometida"
  | "entregada"
  | "resuelta"
  | "falsa";

export const STATUS_LABEL: Record<NeedStatus, string> = {
  abierta: "ABIERTA",
  comprometida: "COMPROMETIDA",
  entregada: "ENTREGA POR CONFIRMAR",
  resuelta: "RESUELTA",
  falsa: "DESCARTADA",
};

/** Motivos de denuncia. Lista cerrada: un texto libre sería otro canal de abuso. */
export const FLAG_REASONS = [
  "duplicada",
  "no-existe",
  "datos-falsos",
  "ya-resuelta",
  "estafa",
] as const;

/**
 * Motivos que solo escribe el servidor. Quedan fuera de la lista que aceptan
 * las reglas para que ningún cliente pueda fabricar una alerta del sistema.
 */
export const SYSTEM_FLAG_REASONS = [
  "volumen-inusual",
  "entrega-sin-confirmar",
] as const;

export type FlagReason =
  | (typeof FLAG_REASONS)[number]
  | (typeof SYSTEM_FLAG_REASONS)[number];

export const FLAG_LABEL: Record<FlagReason, string> = {
  duplicada: "Está duplicada",
  "no-existe": "Fui y no existe",
  "datos-falsos": "Los datos son falsos",
  "ya-resuelta": "Ya fue resuelta",
  estafa: "Parece una estafa",
  "volumen-inusual": "Sistema: publicaciones en ráfaga",
  "entrega-sin-confirmar": "Sistema: entrega nunca confirmada",
};

export type Flag = {
  needId: string;
  uid: string;
  reason: FlagReason;
  at: number | null;
};

/**
 * Cupo de compromisos por ventana. Un voluntario real atiende unas pocas
 * necesidades a la vez; quien cosecha teléfonos para estafar necesita cientos.
 * El cupo hace cara esa diferencia sin estorbar a nadie de buena fe.
 * Los validadores están exentos: coordinan en volumen y responden con nombre.
 */
export const CLAIM_WINDOW_MS = 6 * 60 * 60 * 1000;
export const CLAIM_LIMIT_PER_WINDOW = 8;

/**
 * Días sin novedades tras los cuales una necesidad abierta deja de ser fiable.
 *
 * En un desastre la mayoría se resuelven por fuera de la plataforma —un vecino
 * llegó con el agua, la familia se fue donde un pariente— y nadie vuelve a
 * cerrarlas. Sin esta señal el mapa se llena de necesidades fantasma: el
 * voluntario maneja dos horas hasta algo ya resuelto, y a la tercera vez deja
 * de creer en lo que lee. Es la forma más probable de que la plataforma muera,
 * y no aparece en las pruebas porque necesita que pase el tiempo.
 *
 * No se cierran solas. Igual que con las ráfagas de publicación: si la
 * necesidad sigue viva, borrarla sería el peor error posible. Se marca para que
 * un humano pregunte.
 */
export const STALE_DAYS = 7;

/** Una necesidad abierta de la que no se sabe nada hace demasiado. */
export function isStale(need: Need, now = Date.now()): boolean {
  if (need.status !== "abierta") return false;
  const desde = need.updatedAt ?? need.createdAt;
  if (!desde) return false;
  return now - desde > STALE_DAYS * 24 * 60 * 60 * 1000;
}

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
  /** Queda registrado quién verificó, no solo con qué nombre firmó. */
  verifiedByUid: string | null;
  /** Foco de la emergencia, calculado al publicar. Permite filtrar en la consulta. */
  zone: string | null;
  claim: Claim | null;
  /**
   * La escritura todavía vive solo en este dispositivo. Solo lo informa
   * `subscribeToMyNeeds`; en el feed general siempre es indefinido.
   */
  pendingSync?: boolean;
};

export type Claim = {
  uid: string;
  name: string;
  /** ms epoch; pasado este instante cualquiera puede retomar la necesidad. */
  expiresAt: number;
  at: number | null;
  /**
   * Número de cupo consumido del registro personal. Es lo que ata cada
   * compromiso a una posición irrepetible del ledger y hace que el cupo no se
   * pueda esquivar simplemente omitiendo el contador.
   */
  seq: number;
};

/**
 * Registro personal de compromisos. `total` es un contador que solo avanza:
 * cada compromiso consume una posición `slots/{seq}` que no se puede reescribir,
 * y esa unicidad de ruta es lo que vuelve el cupo inesquivable desde el cliente.
 */
export type Ledger = {
  total: number;
  windowCount: number;
  windowStart: number | null;
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
