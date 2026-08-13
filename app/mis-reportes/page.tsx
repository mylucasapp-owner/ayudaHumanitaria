"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import NeedCard from "@/components/NeedCard";
import { useAuth } from "@/lib/auth";
import { subscribeToMyClaims, subscribeToMyNeeds } from "@/lib/needs";
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

      <section className="stack">
        <span className="label">Necesidades que reporté</span>
        {loading ? (
          <p className="empty">Cargando…</p>
        ) : mine.length === 0 ? (
          <p className="empty">Aún no has reportado ninguna necesidad.</p>
        ) : (
          <ul className="stack">
            {mine.map((n) => (
              <li key={n.id}>
                <NeedCard need={n} href={`/necesidad/?id=${n.id}`} />
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

      <p className="meta center">
        Esta lista vive en este dispositivo y navegador. Si borras los datos del
        navegador, perderás el acceso a tus reportes.
      </p>
    </main>
  );
}
