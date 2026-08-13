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
import { zoneById, zoneOf } from "@/lib/zones";
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

const ZONE_KEY = "ah.zona";

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
  const [zone, setZone] = useState<string>("todas");
  const [locating, setLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  // Zonas que han llegado a aparecer en el listado. Se acumulan en vez de
  // recalcularse: al filtrar por una, la consulta ya solo devuelve esa, y unos
  // chips que se borran al usarlos dejarían al voluntario sin forma de volver.
  const [zonasVistas, setZonasVistas] = useState<string[]>([]);

  // La zona elegida se recuerda: un voluntario trabaja siempre en la suya y no
  // tiene por qué volver a filtrar cada vez que abre la app.
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(ZONE_KEY);
      // Las zonas pasaron de tres focos a un departamento cada una. Una
      // preferencia vieja ("cali") ya no existe y filtraría a cero: dejaría al
      // voluntario ante una lista vacía sin nada que indique por qué.
      if (guardada && (guardada === "todas" || guardada === "otra" || zoneById(guardada))) {
        setZone(guardada);
      } else if (guardada) {
        localStorage.removeItem(ZONE_KEY);
      }
    } catch {
      /* sin almacenamiento se arranca en "todas" */
    }
  }, []);

  function elegirZona(id: string) {
    setZone(id);
    try {
      localStorage.setItem(ZONE_KEY, id);
    } catch {
      /* preferencia no persistida: no es grave */
    }
  }

  async function ubicarme() {
    setLocating(true);
    setGeoMessage(null);
    const r = await getCurrentPosition();
    setLocating(false);
    if (r.ok) {
      setMe(r.point);
      // Si su ubicación cae en un foco conocido, se filtra solo: es lo que
      // habría hecho a mano.
      const suya = zoneOf(r.point);
      if (suya) elegirZona(suya.id);
    } else {
      setGeoMessage(r.message);
    }
  }

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    return subscribeToOpenNeeds(
      (list) => {
        setNeeds(list);
        setLoading(false);
        setZonasVistas((previas) => {
          const union = new Set(previas);
          for (const n of list) if (n.zone) union.add(n.zone);
          return union.size === previas.length ? previas : [...union];
        });
      },
      () => {
        setError("No se pudo cargar el listado. Revisa la conexión.");
        setLoading(false);
      },
      zone,
    );
  }, [user, zone]);

  // Los chips salen de los datos, no de una lista fija: pintar los 32
  // departamentos dejaría treinta botones vacíos y ninguno encontrable. Se
  // incluye siempre el que está activo, para que al filtrar por una zona que
  // acaba de vaciarse siga viéndose cuál está puesta.
  const zonasConNecesidades = useMemo(() => {
    const ids = new Set(zonasVistas);
    if (zone !== "todas") ids.add(zone);
    return [...ids]
      .map((id) => zoneById(id) ?? { id, short: "Otra zona", label: "Otra zona" })
      .sort((a, b) => a.short.localeCompare(b.short, "es"));
  }, [zonasVistas, zone]);

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
          !hideTaken ||
          n.status === "abierta" ||
          // Un compromiso vencido vuelve a estar disponible, pero una entrega
          // declarada no: está esperando confirmación, no oferentes.
          (n.status === "comprometida" && isClaimExpired(n)),
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

      {!me && (
        <div className="stack" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn"
            disabled={locating}
            onClick={ubicarme}
          >
            {locating ? "Buscando señal…" : "Usar mi ubicación"}
          </button>
          {geoMessage ? (
            <p className="notice notice--signal">
              {geoMessage} Mientras tanto, elige tu zona abajo.
            </p>
          ) : (
            <p className="meta center">
              Ordena por cercanía y filtra tu zona automáticamente.
            </p>
          )}
        </div>
      )}

      <div className="chips" role="group" aria-label="Filtrar por zona">
        <button
          type="button"
          className="chip"
          aria-pressed={zone === "todas"}
          onClick={() => elegirZona("todas")}
        >
          Toda la región
        </button>
        {zonasConNecesidades.map((z) => (
          <button
            key={z.id}
            type="button"
            className="chip"
            aria-pressed={zone === z.id}
            onClick={() => elegirZona(z.id)}
          >
            {z.short}
          </button>
        ))}
      </div>

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
        {/* El rótulo dice qué se está viendo, no qué se está escondiendo: al
            leer "ocultando" nadie sabe si tocarlo oculta o muestra. */}
        {hideTaken ? "Solo disponibles" : "Todas, incluso tomadas"}
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
