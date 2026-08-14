"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import { useAuth } from "@/lib/auth";
import { distanceKm, formatDistance, getCurrentPosition } from "@/lib/geo";
import {
  PLACE_HINT,
  PLACE_KINDS,
  PLACE_LABEL,
  subscribeToPlaces,
  type Place,
  type PlaceKind,
} from "@/lib/places";
import type { GeoPoint } from "@/lib/types";

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
          onClick={() => setKind("todos")}
        >
          Todos
        </button>
        {PLACE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="chip"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {PLACE_LABEL[k]}
          </button>
        ))}
      </div>

      {error && <p className="notice notice--error">{error}</p>}

      {loading ? (
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
      )}

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
