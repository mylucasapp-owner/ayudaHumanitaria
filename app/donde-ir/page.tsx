"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import { useAuth } from "@/lib/auth";
import { distanceKm, formatDistance, getCurrentPosition } from "@/lib/geo";
import {
  PLACE_GLYPH,
  PLACE_HINT,
  PLACE_KINDS,
  PLACE_LABEL,
  subscribeToPlaces,
  type Place,
  type PlaceKind,
} from "@/lib/places";
import type { GeoPoint } from "@/lib/types";

const PointsMap = dynamic(() => import("@/components/map/PointsMap"), {
  ssr: false,
  loading: () => <div className="map" />,
});

export default function Page() {
  return (
    <FirebaseGate>
      <DondeIrPage />
    </FirebaseGate>
  );
}

function DondeIrPage() {
  const { user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<PlaceKind | "todos">("todos");
  const [me, setMe] = useState<GeoPoint | null>(null);
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const [detalle, setDetalle] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToPlaces(
      (list) => {
        setPlaces(list);
        setLoading(false);
      },
      () => {
        setError("No se pudo cargar la lista. Revisa la conexión.");
        setLoading(false);
      },
    );
  }, [user]);

  // La ubicación es opcional: sin ella la lista sigue sirviendo, solo que sin
  // ordenar por cercanía. Quien huyó de su casa puede no tener ni permiso de GPS.
  useEffect(() => {
    getCurrentPosition(10000).then((r) => {
      if (r.ok) setMe(r.point);
    });
  }, []);

  const visible = useMemo(() => {
    return places
      .filter((p) => p.active)
      .filter((p) => kind === "todos" || p.kind === kind)
      .map((p) => ({
        place: p,
        km: me && p.location ? distanceKm(me, p.location) : null,
      }))
      .sort((a, b) => {
        if (a.km !== null && b.km !== null) return a.km - b.km;
        if (a.km !== null) return -1;
        if (b.km !== null) return 1;
        return a.place.name.localeCompare(b.place.name, "es");
      });
  }, [places, kind, me]);

  const marcadores = useMemo(
    () =>
      visible
        .filter(({ place }) => place.location)
        .map(({ place }) => ({
          id: place.id,
          point: place.location!,
          glyph: PLACE_GLYPH[place.kind],
          title: place.name,
        })),
    [visible],
  );

  /** El punto tocado en el mapa, si todavía pasa los filtros actuales. */
  const seleccionado = visible.find((v) => v.place.id === detalle) ?? null;

  /** Cuántos quedan fuera del mapa por no tener punto marcado. */
  const sinPunto = visible.filter(({ place }) => !place.location).length;

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>

      <h1 className="title">¿A dónde ir?</h1>
      <p className="subtitle">
        Albergues, puntos de acopio y sitios con agua, comida o atención médica.
      </p>

      <ConnectionState />

      <div className="chips" role="group" aria-label="Filtrar por tipo">
        <button
          type="button"
          className="chip"
          aria-pressed={kind === "todos"}
          onClick={() => {
            setKind("todos");
            setDetalle(null);
          }}
        >
          Todos
        </button>
        {PLACE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="chip"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setDetalle(null);
            }}
          >
            {PLACE_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Vista">
        <button
          type="button"
          className="chip"
          aria-pressed={view === "lista"}
          onClick={() => setView("lista")}
        >
          Lista
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={view === "mapa"}
          onClick={() => setView("mapa")}
        >
          Mapa
        </button>
      </div>

      {error && <p className="notice notice--error">{error}</p>}

      {view === "mapa" && (
        <>
          <PointsMap
            markers={marcadores}
            me={me}
            onSelect={(id) => setDetalle(id)}
            ariaLabel="Mapa de puntos a donde ir"
          />
          {/* Un mapa que calla lo que no muestra es peor que una lista: quien
              lo mira concluye que no hay nada más, y sí lo hay. */}
          {sinPunto > 0 && (
            <p className="meta center">
              {sinPunto === 1
                ? "1 punto no aparece en el mapa porque solo tiene dirección escrita."
                : `${sinPunto} puntos no aparecen en el mapa porque solo tienen dirección escrita.`}{" "}
              Míralos en la lista.
            </p>
          )}
          {/* Se busca sin dar por hecho que sigue ahí: tocar un pin y luego
              cambiar el filtro de tipo dejaba `detalle` apuntando a un punto
              que ya no está en la lista, y la pantalla se caía entera. */}
          {seleccionado && (
            <PlaceCard place={seleccionado.place} km={seleccionado.km} />
          )}
        </>
      )}

      {view === "lista" &&
        (loading ? (
        <p className="empty">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="empty">
          {places.filter((p) => p.active).length === 0
            ? "Todavía no hay puntos publicados para tu emergencia. Los publican los coordinadores acreditados."
            : "No hay puntos de este tipo. Prueba con “Todos”."}
        </p>
      ) : (
        <ul className="stack">
          {visible.map(({ place, km }) => (
            <li key={place.id}>
              <PlaceCard place={place} km={km} />
            </li>
          ))}
        </ul>
      ))}

      <div className="spacer" />
      <p className="meta center">
        Estos puntos los publican coordinadores acreditados, no cualquiera: a un
        albergue se llega caminando y con la familia, y un dato falso ahí se paga
        caro. Si conoces uno que falta, escríbele a un coordinador.
      </p>
    </main>
  );
}

function PlaceCard({ place, km }: { place: Place; km: number | null }) {
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="row row--between" style={{ gap: 8 }}>
        <span className="label">{PLACE_LABEL[place.kind]}</span>
        {typeof km === "number" && (
          <span className="strong" style={{ whiteSpace: "nowrap" }}>
            {formatDistance(km)}
          </span>
        )}
      </div>

      <div className="card__desc">{place.name}</div>
      <p className="meta">{PLACE_HINT[place.kind]}</p>

      {place.reference && (
        <p className="meta">
          <span className="strong">Dónde:</span> {place.reference}
        </p>
      )}
      {place.schedule && (
        <p className="meta">
          <span className="strong">Horario:</span> {place.schedule}
        </p>
      )}
      {place.notes && <p className="meta">{place.notes}</p>}

      {/* Llamar antes de caminar dos horas con niños es exactamente lo que
          queremos que la gente pueda hacer. El teléfono es del sitio, no de una
          persona damnificada, así que se muestra sin pedir nada a cambio. */}
      {place.phone && (
        <a className="btn" href={`tel:${place.phone}`}>
          Llamar · {place.phone}
        </a>
      )}

      {place.location && (
        <a
          className="btn btn--ghost"
          href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Cómo llegar
        </a>
      )}
    </div>
  );
}
