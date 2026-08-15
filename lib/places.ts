import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  limit,
  setDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { GeoPoint } from "./types";

/**
 * Puntos a donde ir: albergues, acopios, puestos de salud, agua y comida.
 *
 * Nace de lo que los damnificados dijeron que les faltaba: no saben a dónde ir.
 * Es la pregunta contraria a la del resto de la app. Una necesidad dice "vengan
 * a donde estoy"; esto dice "ve a este sitio". Por eso vive aparte y no como
 * otra categoría de necesidad: nadie se "compromete" con un albergue, no caduca
 * en tres horas y no tiene un teléfono privado que proteger.
 *
 * SOLO LOS VALIDADORES PUEDEN PUBLICARLOS, y es la diferencia más importante
 * con una necesidad. Un reporte falso de necesidad le cuesta un viaje a un
 * voluntario que puede darse la vuelta. Un albergue falso manda a una familia
 * caminando de noche, con niños y sin batería, a un sitio que no existe. La
 * asimetría del daño justifica la asimetría del permiso.
 */
export const PLACE_KINDS = [
  "albergue",
  "acopio",
  "salud",
  "agua",
  "comida",
] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];

export const PLACE_LABEL: Record<PlaceKind, string> = {
  albergue: "ALBERGUE",
  acopio: "PUNTO DE ACOPIO",
  salud: "PUESTO DE SALUD",
  agua: "AGUA POTABLE",
  comida: "COMIDA",
};

/** Qué esperar al llegar. Se muestra bajo el nombre para no tener que entrar. */
export const PLACE_HINT: Record<PlaceKind, string> = {
  albergue: "Dónde dormir y resguardarse",
  acopio: "Dónde entregar o recibir donaciones",
  salud: "Atención médica",
  agua: "Dónde llenar recipientes",
  comida: "Comida preparada",
};

/** Glifo de una letra para los pines del mapa, legible a 30px. */
export const PLACE_GLYPH: Record<PlaceKind, string> = {
  albergue: "A",
  acopio: "D",
  salud: "+",
  agua: "≈",
  comida: "C",
};

export type Place = {
  id: string;
  kind: PlaceKind;
  name: string;
  /** Dirección o seña escrita. Es lo único que hay si no se marcó el punto. */
  reference: string;
  location: GeoPoint | null;
  /** "24 horas", "8am a 6pm". Texto libre: los horarios reales no son regulares. */
  schedule: string;
  /** Qué reciben o qué ofrecen, y advertencias ("no reciben ropa usada"). */
  notes: string;
  /**
   * Teléfono público del sitio. A diferencia del de una necesidad, este es de
   * una institución y se muestra a cualquiera: llamar antes de caminar dos horas
   * con niños es exactamente lo que queremos que la gente pueda hacer.
   */
  phone: string;
  active: boolean;
  zone: string | null;
  createdByName: string;
  createdAt: number | null;
  updatedAt: number | null;
};

export const MAX_PLACE_NAME = 80;
export const MAX_PLACE_REFERENCE = 140;
export const MAX_PLACE_SCHEDULE = 60;
export const MAX_PLACE_NOTES = 200;

function placesCol() {
  return collection(db(), "places");
}

function toPlace(d: {
  id: string;
  data: () => Record<string, unknown>;
}): Place {
  const v = d.data();
  const ms = (x: unknown) =>
    x && typeof x === "object" && "toMillis" in x
      ? (x as { toMillis: () => number }).toMillis()
      : null;
  return {
    id: d.id,
    kind: (v.kind as PlaceKind) ?? "acopio",
    name: (v.name as string) ?? "",
    reference: (v.reference as string) ?? "",
    location: (v.location as GeoPoint | null) ?? null,
    schedule: (v.schedule as string) ?? "",
    notes: (v.notes as string) ?? "",
    phone: (v.phone as string) ?? "",
    active: (v.active as boolean) ?? true,
    zone: (v.zone as string | null) ?? null,
    createdByName: (v.createdByName as string) ?? "",
    createdAt: ms(v.createdAt),
    updatedAt: ms(v.updatedAt),
  };
}

/**
 * Escucha todos los puntos, activos y cerrados. Sin tope y sin filtrar en el
 * servidor: son decenas, no miles, así que un `where` solo costaría un índice
 * compuesto sin ahorrar nada. Cada pantalla filtra lo que le toca.
 *
 * Traer también los cerrados es necesario, no un descuido: el panel tiene que
 * poder reabrir uno, y con el filtro en la consulta un punto cerrado no volvía
 * nunca y el botón de reabrir no tenía sobre qué actuar.
 */
export function subscribeToPlaces(
  onData: (places: Place[]) => void,
  onError: (e: unknown) => void,
) {
  return onSnapshot(
    query(placesCol(), orderBy("name")),
    (snap) => onData(snap.docs.map(toPlace)),
    onError,
  );
}

/**
 * Avisos de que un punto ya no sirve.
 *
 * Los albergues se llenan y cierran todo el tiempo, y quien se entera es el que
 * llegó hasta la puerta, no el coordinador que lo publicó desde otra ciudad. Sin
 * este camino de vuelta, el dato envejece mal y una familia camina hasta un
 * sitio cerrado —justo el daño que quisimos evitar restringiendo quién publica.
 *
 * El aviso NO cierra el punto: lo marca para que un humano llame y confirme. Si
 * bastara con avisar, cualquiera podría vaciar el mapa de albergues.
 */
export const PLACE_REPORT_REASONS = [
  "lleno",
  "cerrado",
  "no-existe",
  "datos-erroneos",
] as const;

export type PlaceReportReason = (typeof PLACE_REPORT_REASONS)[number];

export const PLACE_REPORT_LABEL: Record<PlaceReportReason, string> = {
  lleno: "Está lleno, no reciben más",
  cerrado: "Está cerrado ahora",
  "no-existe": "Fui y no existe",
  "datos-erroneos": "La dirección o el teléfono están mal",
};

export type PlaceReport = {
  placeId: string;
  uid: string;
  reason: PlaceReportReason;
  at: number | null;
};

/** Un aviso por persona y punto: la ruta impide acumular avisos falsos. */
export async function reportPlace(
  placeId: string,
  uid: string,
  reason: PlaceReportReason,
) {
  await setDoc(doc(db(), "places", placeId, "reports", uid), {
    placeId,
    uid,
    reason,
    at: serverTimestamp(),
  });
}

/** Para el panel: todos los avisos, sin recorrer punto por punto. */
export function subscribeToPlaceReports(
  onData: (reports: PlaceReport[]) => void,
  onError: (e: unknown) => void,
) {
  return onSnapshot(
    query(collectionGroup(db(), "reports"), orderBy("at", "desc"), limit(200)),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const f = d.data();
          return {
            placeId: String(f.placeId ?? ""),
            uid: String(f.uid ?? ""),
            reason: f.reason as PlaceReportReason,
            at: f.at?.toMillis?.() ?? null,
          };
        }),
      ),
    onError,
  );
}

export type PlaceInput = {
  kind: PlaceKind;
  name: string;
  reference: string;
  location: GeoPoint | null;
  schedule: string;
  notes: string;
  phone: string;
  zone: string | null;
  createdByName: string;
};

export async function createPlace(input: PlaceInput) {
  return addDoc(placesCol(), {
    kind: input.kind,
    name: input.name.trim().slice(0, MAX_PLACE_NAME),
    reference: input.reference.trim().slice(0, MAX_PLACE_REFERENCE),
    location: input.location,
    schedule: input.schedule.trim().slice(0, MAX_PLACE_SCHEDULE),
    notes: input.notes.trim().slice(0, MAX_PLACE_NOTES),
    phone: input.phone.trim().slice(0, 25),
    active: true,
    zone: input.zone,
    createdByName: input.createdByName.slice(0, 60),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Corregir un punto ya publicado.
 *
 * Un teléfono mal tecleado o un horario que cambió no deberían obligar a cerrar
 * el punto y crearlo de nuevo: eso le cambia el identificador, y quien lo tenía
 * abierto o compartido se queda con un enlace muerto. Además los avisos de la
 * gente cuelgan del punto, y perderlos borra el rastro de que alguien fue y
 * encontró algo distinto.
 */
export async function updatePlace(placeId: string, input: PlaceInput) {
  await updateDoc(doc(db(), "places", placeId), {
    kind: input.kind,
    name: input.name.trim().slice(0, MAX_PLACE_NAME),
    reference: input.reference.trim().slice(0, MAX_PLACE_REFERENCE),
    location: input.location,
    schedule: input.schedule.trim().slice(0, MAX_PLACE_SCHEDULE),
    notes: input.notes.trim().slice(0, MAX_PLACE_NOTES),
    phone: input.phone.trim().slice(0, 25),
    zone: input.zone,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Cerrar un punto. No se borra: que un albergue haya existido y ya no reciba es
 * información, y alguien puede llegar con la dirección apuntada en un papel.
 */
export async function closePlace(placeId: string) {
  await updateDoc(doc(db(), "places", placeId), {
    active: false,
    updatedAt: serverTimestamp(),
  });
}

export async function reopenPlace(placeId: string) {
  await updateDoc(doc(db(), "places", placeId), {
    active: true,
    updatedAt: serverTimestamp(),
  });
}
