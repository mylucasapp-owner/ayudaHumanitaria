"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import NeedCard from "@/components/NeedCard";
import { useAuth } from "@/lib/auth";
import { distanceKm, getCurrentPosition } from "@/lib/geo";
import { subscribeToOpenNeeds } from "@/lib/needs";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  isClaimExpired,
  type Category,
  type GeoPoint,
  type Need,
} from "@/lib/types";

const NeedsMap = dynamic(() => import("@/components/map/NeedsMap"), {
  ssr: false,
  loading: () => <div className="map" />,
});

type View = "lista" | "mapa";

export default function Page() {
  return (
    <FirebaseGate>
      <AyudarPage />
    </FirebaseGate>
  );
}

function AyudarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("lista");
  const [category, setCategory] = useState<Category | "todas">("todas");
  const [hideTaken, setHideTaken] = useState(true);
  const [me, setMe] = useState<GeoPoint | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToOpenNeeds(
      (list) => {
        setNeeds(list);
        setLoading(false);
      },
      () => {
        setError("No se pudo cargar el listado. Revisa la conexión.");
        setLoading(false);
      },
    );
  }, [user]);

  // La ubicación es opcional: sin ella la lista sigue sirviendo, solo que
  // ordenada por hora en vez de por cercanía.
  useEffect(() => {
    getCurrentPosition(10000).then((r) => {
      if (r.ok) setMe(r.point);
    });
  }, []);

  const visible = useMemo(() => {
    const withDistance = needs
      .filter((n) => category === "todas" || n.category === category)
      .filter(
        (n) =>
          !hideTaken || n.status === "abierta" || isClaimExpired(n),
      )
      .map((n) => ({
        need: n,
        km: me && n.location ? distanceKm(me, n.location) : null,
      }));

    withDistance.sort((a, b) => {
      // Verificadas primero: son las que un humano ya confirmó en terreno.
      if (a.need.verified !== b.need.verified) return a.need.verified ? -1 : 1;
      if (a.km !== null && b.km !== null) return a.km - b.km;
      if (a.km !== null) return -1;
      if (b.km !== null) return 1;
      return (b.need.createdAt ?? 0) - (a.need.createdAt ?? 0);
    });
    return withDistance;
  }, [needs, category, hideTaken, me]);

  return (
    <main className="shell shell--wide" id="main">
      <header className="row row--between">
        <Link className="backlink" href="/">
          ← Inicio
        </Link>
        <div className="btn-row" style={{ width: 200 }}>
          {(["lista", "mapa"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              className="chip"
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      <h1 className="title">Necesidades cerca</h1>
      <ConnectionState />

      <div className="chips" role="group" aria-label="Filtrar por categoría">
        <button
          type="button"
          className="chip"
          aria-pressed={category === "todas"}
          onClick={() => setCategory("todas")}
        >
          Todas
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="chip"
        style={{ alignSelf: "flex-start" }}
        aria-pressed={hideTaken}
        onClick={() => setHideTaken((v) => !v)}
      >
        {hideTaken ? "Ocultando ya tomadas" : "Mostrando todas"}
      </button>

      {error && <p className="notice notice--error">{error}</p>}

      {view === "mapa" && (
        <NeedsMap
          needs={visible.map((v) => v.need)}
          me={me}
          onSelect={(id) => router.push(`/necesidad/?id=${id}`)}
        />
      )}

      {loading ? (
        <p className="empty">Cargando necesidades…</p>
      ) : visible.length === 0 ? (
        <p className="empty">
          No hay necesidades con estos filtros. Prueba con “Todas” o muestra las
          ya tomadas.
        </p>
      ) : (
        <ul className="stack">
          {visible.map(({ need, km }) => (
            <li key={need.id}>
              <NeedCard
                need={need}
                distanceKm={km}
                href={`/necesidad/?id=${need.id}`}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="meta center">
        {visible.length} de {needs.length} necesidades pendientes
        {!me && " · activa la ubicación para ordenar por cercanía"}
      </p>
    </main>
  );
}
