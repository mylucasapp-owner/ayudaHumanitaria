"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import { auth } from "@/lib/firebase";

/**
 * Definir la contraseña de un coordinador.
 *
 * Existe por dos razones. La primera es de control: la página alojada por
 * Firebase depende de que el enlace traiga la llave del proyecto, y si el
 * proyecto se configuró por API esa llave puede llegar vacía y la página falla
 * con un error incomprensible. Aquí la llave la pone la app, así que el enlace
 * solo necesita traer el código.
 *
 * La segunda es más importante: aquella página está en inglés. Un coordinador
 * de terreno en Chocó no tiene por qué toparse con "Reset your password" para
 * poder empezar a validar.
 */
export default function Page() {
  return (
    <Suspense fallback={<main className="shell">Cargando…</main>}>
      <FirebaseGate>
        <DefinirClave />
      </FirebaseGate>
    </Suspense>
  );
}

type Estado =
  | { fase: "verificando" }
  | { fase: "listo"; correo: string }
  | { fase: "guardando"; correo: string }
  | { fase: "hecho" }
  | { fase: "invalido"; mensaje: string };

function DefinirClave() {
  const params = useSearchParams();
  const code = params.get("oobCode") ?? "";
  const modo = params.get("mode") ?? "resetPassword";

  const [estado, setEstado] = useState<Estado>({ fase: "verificando" });
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setEstado({ fase: "invalido", mensaje: "El enlace está incompleto." });
      return;
    }
    if (modo !== "resetPassword") {
      setEstado({
        fase: "invalido",
        mensaje: "Este enlace no sirve para definir una contraseña.",
      });
      return;
    }
    verifyPasswordResetCode(auth(), code)
      .then((correo) => setEstado({ fase: "listo", correo }))
      .catch(() =>
        setEstado({
          fase: "invalido",
          // Los enlaces caducan y son de un solo uso: es el motivo más común.
          mensaje:
            "Este enlace ya se usó o venció. Pide uno nuevo a quien te acreditó.",
        }),
      );
  }, [code, modo]);

  async function guardar() {
    if (estado.fase !== "listo" || clave.length < 8) return;
    setEstado({ fase: "guardando", correo: estado.correo });
    setError(null);
    try {
      await confirmPasswordReset(auth(), code, clave);
      setEstado({ fase: "hecho" });
    } catch {
      setError("No se pudo guardar. Revisa la conexión y vuelve a intentar.");
      setEstado({ fase: "listo", correo: estado.correo });
    }
  }

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>
      <ConnectionState />

      <section className="stack">
        <h1 className="title">Define tu contraseña</h1>

        {estado.fase === "verificando" && (
          <p className="subtitle">Verificando el enlace…</p>
        )}

        {estado.fase === "invalido" && (
          <>
            <p className="notice notice--error">{estado.mensaje}</p>
            <Link className="btn btn--ghost" href="/validador/">
              Ir al acceso de validadores
            </Link>
          </>
        )}

        {(estado.fase === "listo" || estado.fase === "guardando") && (
          <>
            <p className="subtitle">
              Para la cuenta{" "}
              <span className="strong">{estado.correo}</span>
            </p>

            <div className="field">
              <label className="label" htmlFor="clave">
                Contraseña nueva
              </label>
              <input
                id="clave"
                className="input"
                type="password"
                autoFocus
                autoComplete="new-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") guardar();
                }}
              />
              <div className="counter">
                {clave.length < 8
                  ? `Faltan ${8 - clave.length} caracteres`
                  : "Suficiente"}
              </div>
            </div>

            {error && <p className="notice notice--error">{error}</p>}

            <button
              type="button"
              className="btn btn--primary"
              disabled={clave.length < 8 || estado.fase === "guardando"}
              onClick={guardar}
            >
              {estado.fase === "guardando" ? "Guardando…" : "Guardar y entrar"}
            </button>

            <p className="meta center">
              Mínimo 8 caracteres. Con esta contraseña vas a poder verificar
              necesidades, descartar reportes falsos y confirmar entregas.
            </p>
          </>
        )}

        {estado.fase === "hecho" && (
          <>
            <p className="notice notice--signal">
              Contraseña guardada. Ya puedes entrar al panel de validación.
            </p>
            <Link className="btn btn--primary" href="/validador/">
              Entrar al panel
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
