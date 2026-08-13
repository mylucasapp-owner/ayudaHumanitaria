import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
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

function app() {
  return getApps().length ? getApp() : initializeApp(config);
}

/** Con `NEXT_PUBLIC_USE_EMULATORS=1` toda la app apunta a los emuladores. */
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

let dbRef: Firestore | null = null;
let authRef: Auth | null = null;

/**
 * Firestore con caché persistente: la última vista del mapa sigue disponible
 * aunque se caiga la señal, y las escrituras se encolan hasta que vuelva.
 */
export function db(): Firestore {
  if (!dbRef) {
    dbRef = initializeFirestore(app(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    if (useEmulators) connectFirestoreEmulator(dbRef, "127.0.0.1", 8181);
  }
  return dbRef;
}

export function auth(): Auth {
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
