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
        <p>
          También responde dos preguntas que aparecen enseguida:{" "}
          <span className="strong">a dónde ir</span> —albergues, puntos de
          acopio, agua, comida y atención médica— y{" "}
          <span className="strong">qué hay disponible</span>, que es lo que
          personas y organizaciones están ofreciendo ahora mismo.
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
            Elige qué necesitas: atención médica, medicamentos, rescate, agua y
            alimento, refugio, transporte, o buscar a alguien.
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
            Con él sigues tu reporte y lo cierras cuando la ayuda llegue, y lo
            recuperas si cambias de teléfono o el navegador borra sus datos.
          </Paso>
        </ol>
        <p className="meta">
          Sin señal el reporte igual se guarda en tu teléfono y sale solo cuando
          vuelva la conexión. No hace falta escribirlo de nuevo.
        </p>
        <p className="meta">
          <span className="strong">Puedes corregirlo después.</span> Si
          conseguiste parte de lo que pedías, cambiaste de sitio o eran más
          personas de las que dijiste, entra a tu reporte y edítalo: no hace
          falta cerrarlo y publicar otro.
        </p>
        <p className="meta">
          <span className="strong">Compártelo.</span> Desde tu reporte puedes
          mandarlo por WhatsApp. Ese enlace no muestra tu teléfono, así que
          reenviarlo a grupos del barrio no te expone.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">A dónde ir</h2>
        <p>
          En{" "}
          <Link className="strong" href="/donde-ir/">
            ¿A dónde ir?
          </Link>{" "}
          están los albergues y puntos de acopio que conocen los coordinadores.
        </p>
        <p className="meta">
          Fíjate si dice{" "}
          <span className="strong">sin confirmar en terreno</span>: significa
          que el dato viene de una lista y que nadie de aquí se paró en esa
          puerta. Sigue siendo útil, pero llama antes de salir. Y si vas y está
          lleno o cerrado, avísalo desde la ficha: le ahorras el viaje a la
          siguiente familia.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Qué hay disponible ahora</h2>
        <p>
          En{" "}
          <Link className="strong" href="/ofertas/">
            Ayuda disponible
          </Link>{" "}
          está lo que personas y organizaciones están ofreciendo: transporte,
          atención, alojamiento, cosas concretas. No hace falta que lo hayas
          pedido: si te sirve, llama al número que aparece.
        </p>
        <p className="notice notice--error">
          <span className="strong">La ayuda no se paga. Nunca.</span> Si alguien
          te pide plata, un depósito, una recarga o datos de tu cuenta, es una
          estafa: no le pagues y denúncialo desde la ficha.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Si buscas a alguien</h2>
        <p>
          Usa la categoría{" "}
          <span className="strong">Busco a alguien</span>, que también sirve
          para mascotas perdidas. Escribe lo que ayude a reconocerla: edad,
          ropa, dónde se la vio por última vez.
        </p>
        <p className="meta">
          Funciona distinto al resto:{" "}
          <span className="strong">nadie la “toma” ni la bloquea</span>. A una
          persona no la encuentra uno, la encuentran varios, así que cualquiera
          que tenga información puede avisarte, y lo que más ayuda es difundirla.
        </p>
        <p className="meta">
          Y al revés: si encontraste a una persona desorientada o a una mascota,
          publícalo desde{" "}
          <Link className="strong" href="/ofrezco/">
            Tengo algo que ofrecer
          </Link>{" "}
          con la opción <span className="strong">Encontré a alguien</span>.
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
        <p className="meta">
          <span className="strong">
            ¿No hay ninguna que puedas cubrir?
          </span>{" "}
          Publica lo que tengas de todos modos. Mucha gente tiene algo útil que
          nadie ha pedido todavía porque no sabe que existe.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Si tienes algo que ofrecer</h2>
        <p>
          No hace falta que alguien lo haya pedido. Si tienes cobijas, un
          camión, horas de tu oficio o un espacio, publícalo en{" "}
          <Link className="strong" href="/ofrezco/">
            Tengo algo que ofrecer
          </Link>{" "}
          y quien lo necesite te llama directamente.
        </p>
        <p className="meta">
          <span className="strong">Ahí tu teléfono sí es público</span>, al
          revés que en una necesidad. Es a propósito: publicas para que te
          llamen, y quien acaba de perderlo todo no debería tener que pedir
          permiso para hacerlo. Cuando se acabe lo que ofreces, ciérralo: una
          oferta vieja hace que alguien llame para nada.
        </p>
        <p className="notice notice--error">
          <span className="strong">La ayuda no se paga. Nunca.</span> Si alguien
          te pide plata, un depósito o datos de tu cuenta para entregarte algo,
          es una estafa: no le pagues y denúncialo desde la ficha.
        </p>
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
          Además de verificar necesidades, publicas los puntos a donde ir y
          puedes ubicar en el mapa los reportes que llegaron sin coordenadas.
        </p>
        <p className="meta">
          La acreditación se otorga a mano, una por una. Escribe a{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>{" "}
          contando a qué organización perteneces y qué zona cubres.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Si vienes de otra plataforma</h2>
        <p className="meta">
          Los albergues y puntos de acopio de aquí son datos abiertos: cualquier
          otra aplicación puede mostrarlos sin pedir permiso, y aceptamos los de
          quien quiera traerlos. Está explicado en{" "}
          <Link className="strong" href="/aliados/">
            Intercambio abierto
          </Link>
          .
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
