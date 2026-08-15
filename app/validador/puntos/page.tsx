"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConnectionState from "@/components/ConnectionState";
import FirebaseGate from "@/components/FirebaseGate";
import { useAuth } from "@/lib/auth";
import { getCurrentPosition } from "@/lib/geo";
import {
  closePlace,
  createPlace,
  MAX_PLACE_NAME,
  MAX_PLACE_NOTES,
  MAX_PLACE_REFERENCE,
  MAX_PLACE_SCHEDULE,
  PLACE_KINDS,
  PLACE_LABEL,
  PLACE_REPORT_LABEL,
  subscribeToPlaceReports,
  reopenPlace,
  subscribeToPlaces,
  type Place,
  type PlaceKind,
  type PlaceReport,
} from "@/lib/places";
import { zoneFromText, zoneOf } from "@/lib/zones";
import type { GeoPoint } from "@/lib/types";

export default function Page() {
  return (
    <FirebaseGate>
      <PuntosPage />
    </FirebaseGate>
  );
}

function PuntosPage() {
  const { validator, loading } = useAuth();

  if (loading) return <main className="shell">Cargando…</main>;
  if (!validator) {
    return (
      <main className="shell stack" id="main">
        <Link className="backlink" href="/validador/">
          ← Panel
        </Link>
        <p className="notice notice--error">
          Solo los coordinadores acreditados publican puntos. A un albergue se
          llega caminando y con la familia: un dato falso ahí se paga caro.
        </p>
      </main>
    );
  }

  return <Editor nombreValidador={validator.name} />;
}

function Editor({ nombreValidador }: { nombreValidador: string }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [reports, setReports] = useState<PlaceReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  const [kind, setKind] = useState<PlaceKind>("albergue");
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [schedule, setSchedule] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToPlaces(
      (list) => setPlaces(list),
      () => setError("No se pudo cargar la lista."),
    );
  }, []);

  // Los avisos de la gente que llegó hasta la puerta. Son lo primero que hay
  // que mirar: un albergue lleno que sigue publicado manda familias para nada.
  useEffect(() => {
    return subscribeToPlaceReports(
      (list) => setReports(list),
      () => {
        /* sin avisos el panel sigue sirviendo */
      },
    );
  }, []);

  async function ubicar() {
    setGeoMsg(null);
    const r = await getCurrentPosition();
    if (r.ok) {
      setPoint(r.point);
      setGeoMsg("Punto tomado de tu ubicación actual.");
    } else {
      setGeoMsg(r.message);
    }
  }

  async function publicar() {
    if (name.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await createPlace({
        kind,
        name,
        reference,
        location: point,
        schedule,
        notes,
        phone,
        // Igual que en las necesidades: si no hay punto, la referencia escrita
        // sirve para ubicarlo por departamento.
        zone: (zoneOf(point) ?? zoneFromText(reference))?.id ?? "otra",
        createdByName: nombreValidador,
      });
      setOk(`Publicado: ${name}`);
      setName("");
      setReference("");
      setSchedule("");
      setNotes("");
      setPhone("");
      setPoint(null);
      setGeoMsg(null);
    } catch {
      setError("No se pudo publicar. Revisa la conexión.");
    } finally {
      setBusy(false);
    }
  }

  /** Avisos agrupados por punto, y los avisados primero en la lista. */
  const porPunto = new Map<string, PlaceReport[]>();
  for (const r of reports) {
    porPunto.set(r.placeId, [...(porPunto.get(r.placeId) ?? []), r]);
  }
  const ordenados = [...places].sort(
    (a, b) =>
      (porPunto.get(b.id)?.length ?? 0) - (porPunto.get(a.id)?.length ?? 0),
  );

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/validador/">
        ← Panel
      </Link>

      <h1 className="title">Puntos a donde ir</h1>
      <p className="subtitle">
        Albergues, acopios, salud, agua y comida. Los publica un coordinador
        porque la gente llega caminando confiando en el dato.
      </p>

      <ConnectionState />
      {error && <p className="notice notice--error">{error}</p>}
      {ok && <p className="notice notice--signal">{ok}</p>}

      <section className="stack">
        <div className="chips" role="group" aria-label="Tipo de punto">
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

        <div className="field">
          <label className="label" htmlFor="p-nombre">
            Nombre del sitio
          </label>
          <input
            id="p-nombre"
            className="input"
            maxLength={MAX_PLACE_NAME}
            value={name}
            placeholder="Ej: Coliseo El Pueblo"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="p-ref">
            Dirección o seña
          </label>
          <input
            id="p-ref"
            className="input"
            maxLength={MAX_PLACE_REFERENCE}
            value={reference}
            placeholder="Ej: Carrera 52 con calle 5, Cali"
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <button type="button" className="btn" onClick={ubicar}>
          {point ? "Ubicación tomada ✓" : "Marcar con mi ubicación actual"}
        </button>
        {geoMsg && <p className="meta">{geoMsg}</p>}

        <div className="field">
          <label className="label" htmlFor="p-horario">
            Horario
          </label>
          <input
            id="p-horario"
            className="input"
            maxLength={MAX_PLACE_SCHEDULE}
            value={schedule}
            placeholder="Ej: 24 horas · Ej: 7am a 7pm"
            onChange={(e) => setSchedule(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="p-tel">
            Teléfono del sitio
          </label>
          <input
            id="p-tel"
            className="input"
            inputMode="tel"
            maxLength={25}
            value={phone}
            placeholder="Ej: 3001234567"
            onChange={(e) => setPhone(e.target.value)}
          />
          {/* Este teléfono lo ve cualquiera. Debe ser el del sitio, no el de
              una persona: es la diferencia entre un dato útil y exponer a
              alguien. */}
          <p className="meta">
            Se muestra a todo el mundo. Pon el del sitio o el de la
            coordinación, nunca el de un damnificado.
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="p-notas">
            Qué ofrecen o qué reciben
          </label>
          <textarea
            id="p-notas"
            className="textarea"
            maxLength={MAX_PLACE_NOTES}
            value={notes}
            placeholder="Ej: reciben ropa y mercados. No reciben medicamentos vencidos."
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || name.trim().length < 3}
          onClick={publicar}
        >
          {busy ? "Publicando…" : "Publicar punto"}
        </button>
      </section>

      <div className="spacer" />
      <hr className="hr" />

      <h2 className="label">Publicados ({places.length})</h2>
      {places.length === 0 ? (
        <p className="empty">Todavía no hay puntos publicados.</p>
      ) : (
        <ul className="stack">
          {ordenados.map((p) => (
            <li key={p.id} className="card stack" style={{ gap: 8 }}>
              <span className="label">
                {PLACE_LABEL[p.kind]}
                {!p.active && " · CERRADO"}
              </span>
              <span className="card__desc">{p.name}</span>
              {p.reference && <p className="meta">{p.reference}</p>}
              {/* Quien llegó hasta la puerta se entera antes que nadie. */}
              {(porPunto.get(p.id) ?? []).length > 0 && (
                <p className="notice notice--signal">
                  {(porPunto.get(p.id) ?? []).length} aviso(s):{" "}
                  {[
                    ...new Set(
                      (porPunto.get(p.id) ?? []).map(
                        (r) => PLACE_REPORT_LABEL[r.reason],
                      ),
                    ),
                  ].join(" · ")}
                </p>
              )}
              <button
                type="button"
                className="btn"
                onClick={() =>
                  p.active ? closePlace(p.id) : reopenPlace(p.id)
                }
              >
                {p.active ? "Cerrar este punto" : "Reabrir"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
