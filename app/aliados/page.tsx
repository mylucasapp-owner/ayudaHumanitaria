"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";
import { useOrigen } from "@/lib/useOrigen";

/**
 * Quiénes comparten datos con esta plataforma, y cómo sumarse.
 *
 * Está a la vista y no escondida en un README porque reconocer a otros
 * públicamente es lo más barato que se puede hacer y lo que más colaboración
 * atrae. Un equipo que ve su nombre aquí entiende que no compite con nosotros.
 *
 * Se escribe con cuidado de no prometer que somos el centro de nada. La
 * ambición de ser la plataforma donde todos confluyen es la misma que produce
 * quince apps que no se hablan, solo que con mejor discurso.
 */
export default function Page() {
  const [aliados, setAliados] = useState<string[] | null>(null);
  const origen = useOrigen();

  useEffect(() => {
    fetch("/api/aliados.json")
      .then((r) => r.json())
      .then((d) => setAliados(Array.isArray(d.aliados) ? d.aliados : []))
      .catch(() => setAliados([]));
  }, []);

  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>

      <h1 className="title">Intercambio abierto</h1>
      <p className="subtitle">
        Los datos de esta plataforma son de quien los necesite, y aceptamos los
        de quien quiera traerlos.
      </p>

      <section className="stack">
        <p>
          En una emergencia, tres mapas con datos parciales son peores que uno
          con todos: la gente no sabe cuál mirar, y termina sin mirar ninguno.
        </p>
        <p className="meta">
          <span className="strong">No pedimos que nadie converja aquí.</span>{" "}
          Querer ser el centro donde todos confluyen es la misma ambición que
          hace que hoy existan quince aplicaciones que no se hablan, solo que
          con mejor discurso. Si otra plataforma cubre mejor una región, le
          mandamos gente. Lo que se mide aquí no es cuántos entran por nuestra
          puerta.
        </p>
      </section>

      <hr className="hr" />

      <section className="stack">
        <h2 className="label">Organizaciones que aportan datos</h2>
        {aliados === null ? (
          <p className="empty">Cargando…</p>
        ) : aliados.length === 0 ? (
          <p className="empty">
            Todavía ninguna. Si tu organización ya tiene albergues o acopios
            mapeados, puedes ser la primera.
          </p>
        ) : (
          <ul className="stack">
            {aliados.map((a) => (
              <li key={a} className="card">
                <span className="card__desc">{a}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <hr className="hr" />

      <section className="stack">
        <h2 className="label">Tomar los datos</h2>
        <p className="meta">
          Sin llave, sin registro y sin cuota. Albergues y puntos de acopio en
          GeoJSON, que abre cualquier herramienta de mapas sin conversión.
        </p>
        <a className="btn" href={`${origen}/api/puntos.geojson`}>
          Ver /api/puntos.geojson
        </a>
        <a className="btn btn--ghost" href={`${origen}/api/resumen.json`}>
          Ver /api/resumen.json
        </a>
        <p className="meta">
          Las necesidades solo salen agregadas: llevan la referencia escrita de
          una persona damnificada, y abrir esas direcciones de par en par le
          serviría antes que a nadie a quien busca a quién estafar.
        </p>
      </section>

      <section className="stack">
        <h2 className="label">Traer los tuyos</h2>
        <p className="meta">
          Si ya tienes puntos mapeados, se publican aquí con el nombre de tu
          organización. Escríbenos a{" "}
          <a className="strong" href={`mailto:${SITE.contactEmail}`}>
            {SITE.contactEmail}
          </a>{" "}
          contando quiénes son.
        </p>
      </section>

      <section className="stack">
        <h2 className="label">Montar tu propia instancia</h2>
        <p className="meta">
          El código es libre bajo licencia MIT. Si tu emergencia es otra —otro
          país, otro desastre— despliega el tuyo en vez de esperar a que
          cubramos tu zona. No hay que pedir permiso ni avisar.
        </p>
        <a
          className="btn btn--ghost"
          href="https://github.com/e1errante/ayudaHumanitaria"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver el código en GitHub
        </a>
      </section>

      <div className="spacer" />
    </main>
  );
}
