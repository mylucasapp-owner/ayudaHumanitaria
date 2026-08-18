import Link from "next/link";
import OfflineNotice from "@/components/OfflineNotice";
import CompartirApp from "@/components/CompartirApp";
import { SITE } from "@/lib/site";

export default function Home() {
  return (
    <main className="shell" id="main">
      <header className="stack" style={{ gap: 6 }}>
        <h1 className="title">Ayuda Humanitaria</h1>
        <p className="subtitle">
          Necesidades reales, ubicadas y verificadas. Sin registro.
        </p>
      </header>

      <OfflineNotice />

      <div className="stack" style={{ gap: 14 }}>
        <Link className="btn btn--primary btn--huge" href="/necesito/">
          Necesito ayuda
          <span className="btn__note">Reportar una necesidad urgente</span>
        </Link>
        {/* Va con los damnificados y antes de "quiero ayudar": quien acaba de
            perder la casa no viene a reportar una necesidad, viene a saber a
            dónde ir esta noche. Era la pregunta que más se repetía. */}
        <Link className="btn btn--huge" href="/donde-ir/">
          ¿A dónde ir?
          <span className="btn__note">
            Albergues, acopios, agua y comida cerca
          </span>
        </Link>
        <Link className="btn btn--huge" href="/ofertas/">
          Ayuda disponible
          <span className="btn__note">
            Lo que otros están ofreciendo ahora
          </span>
        </Link>
        <Link className="btn btn--huge" href="/ayudar/">
          Quiero ayudar
          <span className="btn__note">Ver necesidades cerca de mí</span>
        </Link>
      </div>

      <p className="meta center">
        Si hay riesgo de vida inmediato, llama primero al{" "}
        <a className="strong" href={`tel:${SITE.emergencyNumber}`}>
          {SITE.emergencyNumber}
        </a>
        . Esta plataforma no reemplaza a los servicios de emergencia.
      </p>

      <CompartirApp />

      <div className="spacer" />

      <nav className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <Link className="btn btn--ghost" href="/ofrezco/">
          Tengo algo que ofrecer
        </Link>
        <Link className="btn btn--ghost" href="/mis-reportes/">
          Mis reportes y compromisos
        </Link>
        <Link className="btn btn--ghost" href="/como-usar/">
          Cómo funciona · Instalar la app
        </Link>
        <Link className="btn btn--ghost" href="/aliados/">
          Datos abiertos · Otras plataformas
        </Link>
        <Link className="btn btn--ghost" href="/validador/">
          Acceso validadores
        </Link>
      </nav>

      <footer className="stack center" style={{ gap: 6 }}>
        <hr className="hr" />
        <p className="meta">
          Hecha sin ánimo de lucro por{" "}
          <span className="strong">{SITE.author}</span>
          <br />
          {SITE.org}
        </p>
        <Link className="meta" href="/legal/">
          Términos, privacidad y buen uso
        </Link>
      </footer>
    </main>
  );
}
