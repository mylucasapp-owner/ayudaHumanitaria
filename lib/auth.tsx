"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";

export type Validator = { name: string; zone: string };

type AuthState = {
  user: User | null;
  /** null mientras no se sabe; luego el perfil o `false` si no es validador. */
  validator: Validator | null;
  /** Cuenta expulsada por un validador: puede leer, no escribir. */
  blocked: boolean;
  loading: boolean;
  error: string | null;
};

const Ctx = createContext<AuthState>({
  user: null,
  validator: null,
  blocked: false,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [validator, setValidator] = useState<Validator | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setError("Falta la configuración de Firebase (.env.local).");
      setLoading(false);
      return;
    }
    return onAuthStateChanged(
      auth(),
      (u) => {
        if (u) {
          setUser(u);
          setLoading(false);
          return;
        }
        // Identidad anónima: permite reclamar autoría de un reporte y
        // bloquear una necesidad sin pedirle a nadie que cree una cuenta.
        setUser(null);
        signInAnonymously(auth()).catch((e) => {
          setError(authMessage(e));
          setLoading(false);
        });
      },
      (e) => {
        setError(authMessage(e));
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setValidator(null);
      return;
    }
    return onSnapshot(
      doc(db(), "validators", user.uid),
      (snap) => {
        const data = snap.data();
        setValidator(
          snap.exists()
            ? { name: data?.name ?? "Validador", zone: data?.zone ?? "—" }
            : null,
        );
      },
      () => setValidator(null),
    );
  }, [user]);

  // Una cuenta expulsada merece saberlo: si no, ve fallos sin explicación y
  // vuelve a intentar, o cree que la app está rota.
  useEffect(() => {
    if (!user) {
      setBlocked(false);
      return;
    }
    return onSnapshot(
      doc(db(), "blocked", user.uid),
      (snap) => setBlocked(snap.exists()),
      () => setBlocked(false),
    );
  }, [user]);

  const value = useMemo(
    () => ({ user, validator, blocked, loading, error }),
    [user, validator, blocked, loading, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

export async function signInValidator(email: string, password: string) {
  await signInWithEmailAndPassword(auth(), email.trim(), password);
}

/** Vuelve a la identidad anónima; el panel de validador queda cerrado. */
export async function signOutValidator() {
  await signOut(auth());
}

export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "Correo inválido.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un minuto.";
    case "auth/network-request-failed":
      return "Sin conexión. Reintenta.";
    case "auth/admin-restricted-operation":
    case "auth/operation-not-allowed":
      return "Falta habilitar el método de acceso en Firebase.";
    default:
      return "No se pudo completar la operación. Reintenta.";
  }
}
