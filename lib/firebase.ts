import { getApp, getApps, initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

let appCheckStarted = false;

/**
 * App Check acredita que la petición viene de la app real en un navegador
 * real. Es la única defensa que encarece crear identidades anónimas, y sin ella
 * los cupos y bloqueos se esquivan reinstalando. Ver SEGURIDAD.md.
 *
 * Falla en silencio a propósito: si reCAPTCHA no carga —red mala, bloqueador,
 * navegador viejo— la app debe seguir funcionando. Rechazar a un damnificado
 * porque no pudo probar que es humano sería el peor final posible.
 */
function startAppCheck(instance: ReturnType<typeof initializeApp>) {
  if (appCheckStarted || !RECAPTCHA_SITE_KEY) return;
  if (typeof window === "undefined") return;
  appCheckStarted = true;
  try {
    initializeAppCheck(instance, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // Sin atestación se sigue: la barrera es de abuso, no de acceso.
  }
}

function app() {
  const instance = getApps().length ? getApp() : initializeApp(config);
  if (!useEmulators) startAppCheck(instance);
  return instance;
}

/** Con `NEXT_PUBLIC_USE_EMULATORS=1` toda la app apunta a los emuladores. */
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

let dbRef: Firestore | null = null;
let authRef: Auth | null = null;

/**
 * Instancias inyectadas por las pruebas para poder ejecutar el código real con
 * varias identidades a la vez. En el navegador siempre vale `null`.
 */
let injected: { db: Firestore; auth: Auth } | null = null;

export function __injectForTests(instances: { db: Firestore; auth: Auth } | null) {
  injected = instances;
}

/**
 * Firestore con caché persistente: la última vista del mapa sigue disponible
 * aunque se caiga la señal, y las escrituras se encolan hasta que vuelva.
 *
 * En navegación privada IndexedDB no está disponible; ahí se cae a memoria en
 * vez de fallar. Perder la caché es un mal menor frente a que la app no abra.
 */
export function db(): Firestore {
  if (injected) return injected.db;
  if (!dbRef) {
    const canPersist = typeof indexedDB !== "undefined";
    dbRef = initializeFirestore(app(), {
      localCache: canPersist
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    });
    if (useEmulators) connectFirestoreEmulator(dbRef, "127.0.0.1", 8181);
  }
  return dbRef;
}

export function auth(): Auth {
  if (injected) return injected.auth;
  if (!authRef) {
    authRef = getAuth(app());
    if (useEmulators) {
      connectAuthEmulator(authRef, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    }
  }
  return authRef;
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);
