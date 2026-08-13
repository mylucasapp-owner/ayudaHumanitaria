import Link from "next/link";
import type { Metadata } from "next";
import InstallPWA from "@/components/InstallPWA";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cómo usar · Ayuda Humanitaria",
  description:
    "Qué es esta plataforma, cómo reportar una necesidad, cómo ofrecer ayuda y cómo instalarla para usarla sin conexión.",
};

export default function ComoUsarPage() {
  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>

      <header className="stack" style={{ gap: 8 }}>
        <h1 className="title">Cómo usar</h1>
        <p className="subtitle">
          Una herramienta para que la ayuda llegue a quien la necesita, sin
          intermediarios y sin perder tiempo.
        </p>
      </header>

      <p className="notice notice--error">
        <span className="strong">Esto no reemplaza a los servicios de
        emergencia.</span>{" "}
        Si hay riesgo de vida inmediato, llama primero al{" "}
        <a className="strong" href={`tel:${SITE.emergencyNumber}`}>
          {SITE.emergencyNumber}
        </a>
        .
      </p>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Qué es</h2>
        <p>
          Después de un desastre, la ayuda suele existir pero no encuentra a
          quién la necesita. Hay quien tiene agua, transporte o medicinas, y hay
          familias a pocas cuadras esperando, sin que unos sepan de los otros.
        </p>
        <p>
          Esta plataforma junta las dos puntas: quien necesita algo lo publica
          en el mapa, quien puede cubrirlo lo ve y se compromete. Coordinadores
          en terreno verifican que lo publicado sea real.
        </p>
        <p className="meta">
          No se pide registro, ni correo, ni cuenta. Entrar cuesta un toque.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Si necesitas ayuda</h2>
        <ol className="stack" style={{ gap: 8 }}>
          <Paso n={1} titulo="Toca “Necesito ayuda”">
            Elige qué necesitas: médico, rescate, agua y alimento, refugio o
            transporte.
          </Paso>
          <Paso n={2} titulo="Escribe una frase">
            Concreta y corta. “Insulina para 2 adultos mayores” sirve mucho más
            que “necesitamos medicinas”.
          </Paso>
          <Paso n={3} titulo="Marca dónde estás">
            Usa el GPS. Si no hay señal de satélite, marca el punto en el mapa o
            escribe una referencia: una calle, una esquina, algo que se vea.
          </Paso>
          <Paso n={4} titulo="Deja un teléfono">
            Solo lo verá quien se comprometa a ayudarte y los coordinadores.{" "}
            <span className="strong">Nunca aparece en el mapa público.</span>
          </Paso>
          <Paso n={5} titulo="Guarda tu código">
            Con él sigues tu reporte y lo cierras cuando la ayuda llegue.
          </Paso>
        </ol>
        <p className="meta">
          Sin señal el reporte igual se guarda en tu teléfono y sale solo cuando
          vuelva la conexión. No hace falta escribirlo de nuevo.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Si quieres ayudar</h2>
        <ol className="stack" style={{ gap: 8 }}>
          <Paso n={1} titulo="Toca “Quiero ayudar”">
            Verás la lista ordenada por cercanía, con las verificadas primero.
            También hay vista de mapa.
          </Paso>
          <Paso n={2} titulo="Elige una que puedas cubrir de verdad">
            Mejor una cumplida que cinco tomadas.
          </Paso>
          <Paso n={3} titulo="Toca “Yo lo cubro”">
            La necesidad queda reservada tres horas para que nadie más gaste
            recursos en lo mismo, y recién ahí se te muestra el teléfono.
          </Paso>
          <Paso n={4} titulo="Coordina y entrega">
            Llama, ponte de acuerdo, entrega.
          </Paso>
          <Paso n={5} titulo="Marca “Ya la entregué”">
            La cierra quien pidió la ayuda, confirmando que llegó. Si no puedes
            cumplir, libérala: vuelve a la lista al instante.
          </Paso>
        </ol>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Si eres coordinador en terreno</h2>
        <p>
          ONG, bomberos, defensa civil, juntas de acción comunal y líderes
          comunitarios pueden verificar necesidades, liberar compromisos que no
          se concretaron y descartar reportes falsos.
        </p>
        <p className="meta">
          La acreditación se otorga a mano, una por una. Escribe a{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>{" "}
          contando a qué organización perteneces y qué zona cubres.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Instálala en tu teléfono</h2>
        <p>
          Instalada abre como una app normal y{" "}
          <span className="strong">funciona sin conexión</span>: guarda la última
          información que alcanzó a recibir y encola lo que escribas hasta que
          vuelva la señal.
        </p>
        <p className="meta">
          Ocupa menos de lo que pesa una foto y no descarga nada de ninguna
          tienda.
        </p>
        <InstallPWA />
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Cuídate también tú</h2>
        <ul className="stack" style={{ gap: 8 }}>
          <li className="meta">
            Coordina entregas en lugares visibles y, si puedes, acompañado.
          </li>
          <li className="meta">
            Nadie de esta plataforma te va a pedir dinero, datos bancarios ni
            claves. Si alguien lo hace, denúncialo con el botón{" "}
            <span className="strong">“Algo no cuadra aquí”</span>.
          </li>
          <li className="meta">
            Si vas a un lugar y la necesidad no existe, márcalo. Esa señal es lo
            que mantiene el mapa limpio.
          </li>
        </ul>
      </section>

      <nav className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <Link className="btn btn--primary" href="/">
          Empezar
        </Link>
        <Link className="btn btn--ghost" href="/legal/">
          Términos, privacidad y autoría
        </Link>
      </nav>
    </main>
  );
}

function Paso({
  n,
  titulo,
  children,
}: {
  n: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="card">
      <div className="row" style={{ alignItems: "flex-start", gap: 14 }}>
        <span className="strong" style={{ fontSize: 26, lineHeight: 1 }}>
          {n}
        </span>
        <div className="grow stack" style={{ gap: 4 }}>
          <span className="strong">{titulo}</span>
          <span className="meta">{children}</span>
        </div>
      </div>
    </li>
  );
}
