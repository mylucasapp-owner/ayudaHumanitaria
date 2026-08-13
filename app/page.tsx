import Link from "next/link";
import OfflineNotice from "@/components/OfflineNotice";

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
        <Link className="btn btn--huge" href="/ayudar/">
          Quiero ayudar
          <span className="btn__note">Ver necesidades cerca de mí</span>
        </Link>
      </div>

      <div className="spacer" />

      <nav className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <Link className="btn btn--ghost" href="/mis-reportes/">
          Mis reportes y compromisos
        </Link>
        <Link className="btn btn--ghost" href="/validador/">
          Acceso validadores
        </Link>
        <p className="meta center">
          Si hay riesgo de vida inmediato, llama primero a emergencias.
        </p>
      </nav>
    </main>
  );
}
