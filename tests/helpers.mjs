/**
 * Utilidades para las pruebas contra emuladores.
 *
 * La pieza importante es `actor()`: crea una sesión aislada y la inyecta en
 * `lib/firebase`, de modo que las pruebas ejecutan EL MISMO código que corre en
 * el navegador en vez de una reimplementación que puede divergir de él.
 */
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
} from "firebase/firestore";
import { __injectForTests } from "../lib/firebase.ts";

export const PROJECT = "ayuda-humanitaria-89e72";
export const FIRESTORE_HOST = "127.0.0.1:8181";
export const AUTH_HOST = "127.0.0.1:9099";

const CONFIG = { apiKey: "fake-api-key", projectId: PROJECT };

let counter = 0;
const openApps = [];

/** Sesión aislada. Cada actor es una identidad distinta y simultánea. */
export async function actor(label) {
  const app = initializeApp(CONFIG, `${label}-${counter++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8181);
  openApps.push(app);
  return { label, app, auth, db };
}

export async function anonActor(label) {
  const a = await actor(label);
  await signInAnonymously(a.auth);
  a.uid = a.auth.currentUser.uid;
  return a;
}

/** Crea la cuenta, la acredita como validadora y devuelve la sesión iniciada. */
export async function validatorActor(label, name = "Bomberos 3a", zone = "Norte") {
  const email = `${label}-${Date.now()}-${counter}@test.cl`;
  const password = "clave-larga-123";
  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!body.localId) throw new Error(`no se creó la cuenta: ${JSON.stringify(body)}`);

  await adminPatch(`validators/${body.localId}`, {
    name: { stringValue: name },
    zone: { stringValue: zone },
  });

  const a = await actor(label);
  await signInWithEmailAndPassword(a.auth, email, password);
  a.uid = body.localId;
  a.email = email;
  return a;
}

/** Ejecuta `fn` con el código de la app apuntando a la sesión de este actor. */
export async function as(a, fn) {
  __injectForTests({ db: a.db, auth: a.auth });
  try {
    return await fn();
  } finally {
    __injectForTests(null);
  }
}

/** Escritura con credencial de administrador del emulador: saltea las reglas. */
export async function adminPatch(path, fields) {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    },
  );
  if (!res.ok) throw new Error(`admin patch ${path}: ${res.status}`);
}

/** Lectura sin reglas, para comprobar el estado real de un documento. */
export async function adminGet(path) {
  const res = await fetch(
    `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    { headers: { Authorization: "Bearer owner" } },
  );
  if (!res.ok) return null;
  return res.json();
}

/**
 * Adelanta artificialmente el vencimiento de un compromiso. Esperar tres horas
 * reales no es una prueba, es una espera.
 */
export async function expireClaim(needId) {
  const snap = await adminGet(`needs/${needId}`);
  const claim = snap?.fields?.claim?.mapValue?.fields;
  if (!claim) throw new Error("la necesidad no tiene compromiso");
  claim.expiresAt = { integerValue: String(Date.now() - 1000) };
  await adminPatch(`needs/${needId}`, { ...snap.fields, claim: { mapValue: { fields: claim } } });
}

/** Retrocede el inicio de ventana del ledger para simular que ya pasó. */
export async function ageLedgerWindow(uid, hoursAgo = 7) {
  const snap = await adminGet(`ledger/${uid}`);
  if (!snap) throw new Error("no hay ledger");
  const past = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  await adminPatch(`ledger/${uid}`, {
    ...snap.fields,
    windowStart: { timestampValue: past },
  });
}

export async function needStatus(a, needId) {
  const snap = await getDoc(doc(a.db, "needs", needId));
  return snap.exists() ? snap.data().status : null;
}

export async function cleanup() {
  __injectForTests(null);
  await Promise.all(openApps.splice(0).map((app) => deleteApp(app).catch(() => {})));
}

/** Convierte un rechazo por reglas en un booleano legible. */
export async function denied(fn) {
  try {
    await fn();
    return false;
  } catch (e) {
    const code = e?.code ?? "";
    if (code === "permission-denied" || /PERMISSION_DENIED/.test(String(e))) return true;
    throw e;
  }
}
