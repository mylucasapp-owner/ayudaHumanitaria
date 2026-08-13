"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import {
  OfflineError,
  RecoveryError,
  normalizeRecoveryCode,
  recoverNeed,
} from "@/lib/needs";

export default function Page() {
  return (
    <FirebaseGate>
      <Recuperar />
    </FirebaseGate>
  );
}

function Recuperar() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limpio = normalizeRecoveryCode(code);
  const listo = limpio.length === 8;

  async function submit() {
    if (!listo || busy) return;
    setBusy(true);
    setError(null);
    try {
      const needId = await recoverNeed(limpio);
      router.push(`/necesidad/?id=${needId}`);
    } catch (e) {
      setError(
        e instanceof RecoveryError || e instanceof OfflineError
          ? e.message
          : "No se pudo recuperar el reporte. Intenta de nuevo.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/mis-reportes/">
        ← Mis reportes
      </Link>
      <ConnectionState />

      <section className="stack">
        <h1 className="title">Recuperar un reporte</h1>
        <p className="subtitle">
          Si cambiaste de teléfono o el navegador borró sus datos, tu código
          devuelve el control del reporte a este dispositivo.
        </p>

        <div className="field">
          <label className="label" htmlFor="codigo">
            Código de recuperación
          </label>
          <input
            id="codigo"
            className="input mono"
            style={{ fontSize: 26, letterSpacing: 3, textAlign: "center" }}
            value={code}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            placeholder="ABCD-2345"
            maxLength={12}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <div className="counter">{limpio.length}/8</div>
        </div>

        {error && <p className="notice notice--error">{error}</p>}

        <button
          type="button"
          className="btn btn--primary"
          disabled={!listo || busy}
          onClick={submit}
        >
          {busy ? "Buscando…" : "Recuperar mi reporte"}
        </button>

        <p className="meta center">
          Por seguridad solo se permiten 5 intentos por hora.
        </p>

        <hr className="hr" />
        <p className="meta">
          ¿No tienes el código? Un coordinador en terreno puede cerrar tu
          necesidad por ti cuando la ayuda llegue. También puedes publicar una
          nueva y pedir que descarten la anterior con el botón{" "}
          <span className="strong">“Algo no cuadra aquí”</span>.
        </p>
      </section>
    </main>
  );
}
