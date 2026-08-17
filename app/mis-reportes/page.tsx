"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import NeedCard from "@/components/NeedCard";
import { useAuth } from "@/lib/auth";
import {
  formatRecoveryCode,
  rememberedCode,
  subscribeToMyClaims,
  subscribeToMyNeeds,
} from "@/lib/needs";
import { SITE } from "@/lib/site";
import { useOrigen } from "@/lib/useOrigen";
import { requestPersistentStorage, type PersistenceState } from "@/lib/storage";
import type { Need } from "@/lib/types";

export default function Page() {
  return (
    <FirebaseGate>
      <MisReportesPage />
    </FirebaseGate>
  );
}

function MisReportesPage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<Need[]>([]);
  const [claimed, setClaimed] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persistencia, setPersistencia] = useState<PersistenceState>("desconocido");

  const pendientes = mine.filter((n) => n.pendingSync).length;

  // Se pide aquí y no al arrancar: el navegador concede el permiso con mucha
  // más facilidad cuando hay uso real, y quien mira sus reportes ya lo tiene.
  useEffect(() => {
    requestPersistentStorage().then(setPersistencia);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fail = () => {
      setError("No se pudo cargar. Revisa la conexión.");
      setLoading(false);
    };
    const stopMine = subscribeToMyNeeds(
      user.uid,
      (list) => {
        setMine(list);
        setLoading(false);
      },
      fail,
    );
    const stopClaims = subscribeToMyClaims(user.uid, setClaimed, fail);
    return () => {
      stopMine();
      stopClaims();
    };
  }, [user]);

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>
      <h1 className="title">Mi actividad</h1>
      <ConnectionState />
      {error && <p className="notice notice--error">{error}</p>}

      {pendientes > 0 && (
        <p className="notice notice--signal">
          <span className="strong">
            {pendientes === 1
              ? "1 reporte todavía está solo en este teléfono"
              : `${pendientes} reportes todavía están solo en este teléfono`}
          </span>
          . Se enviarán apenas haya señal. Hasta entonces, no borres los datos
          del navegador ni desinstales la app.
        </p>
      )}

      {persistencia === "efimero" && (
        <p className="notice">
          Este navegador puede borrar los datos guardados si le falta espacio.
          Instalar la app desde{" "}
          <Link className="strong" href="/como-usar/">
            Cómo funciona
          </Link>{" "}
          hace que los conserve.
        </p>
      )}

      <section className="stack">
        <span className="label">Necesidades que reporté</span>
        {loading ? (
          <p className="empty">Cargando…</p>
        ) : mine.length === 0 ? (
          <p className="empty">Aún no has reportado ninguna necesidad.</p>
        ) : (
          <ul className="stack">
            {mine.map((n) => (
              <li key={n.id} className="stack" style={{ gap: 4 }}>
                <NeedCard need={n} href={`/necesidad/?id=${n.id}`} />
                {n.pendingSync && (
                  <p className="meta">Sin enviar · esperando señal</p>
                )}
                <CodigoDeReporte needId={n.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <hr className="hr" />
        <span className="label">Necesidades que me comprometí a cubrir</span>
        {claimed.length === 0 ? (
          <p className="empty">No tienes compromisos activos.</p>
        ) : (
          <ul className="stack">
            {claimed.map((n) => (
              <li key={n.id}>
                <NeedCard need={n} href={`/necesidad/?id=${n.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <hr className="hr" />
        <p className="meta">
          Esta lista vive en este dispositivo. Si borras los datos del
          navegador, cambias de teléfono o pasas mucho tiempo sin abrir la app,
          puedes perder el acceso — pero tu código de recuperación te lo
          devuelve.
        </p>
        <Link className="btn btn--ghost" href="/recuperar/">
          Tengo un código de recuperación
        </Link>
      </section>
    </main>
  );
}

/**
 * Muestra el código si este dispositivo todavía lo recuerda, con una salida
 * para llevárselo fuera. Que no aparezca no significa que se haya perdido: solo
 * que este navegador ya no lo tiene guardado.
 */
function CodigoDeReporte({ needId }: { needId: string }) {
  const [code, setCode] = useState<string | null>(null);
  // Antes del `return` de abajo: un hook por debajo cambia el número de hooks
  // entre renders y tumba la pantalla entera. Ya pasó una vez.
  const origen = useOrigen();

  useEffect(() => {
    setCode(rememberedCode(needId));
  }, [needId]);

  if (!code) return null;
  const shown = formatRecoveryCode(code);
  const mensaje = `Mi código de recuperación en Ayuda Humanitaria es ${shown} — ${origen}/recuperar/`;

  return (
    <div className="row" style={{ gap: 10, alignItems: "center" }}>
      <span className="meta">Código</span>
      <span className="mono strong grow">{shown}</span>
      <a
        className="meta strong"
        href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Guardarlo aparte
      </a>
    </div>
  );
}
