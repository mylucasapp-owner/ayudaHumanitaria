import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Términos, privacidad y autoría · Ayuda Humanitaria",
  description:
    "Condiciones de uso, tratamiento de datos personales, limitaciones y autoría de la plataforma.",
};

export default function LegalPage() {
  return (
    <main className="shell" id="main">
      <Link className="backlink" href="/">
        ← Inicio
      </Link>

      <header className="stack" style={{ gap: 8 }}>
        <h1 className="title">Términos y privacidad</h1>
        <p className="meta">Última actualización: {SITE.updatedAt}</p>
      </header>

      <section className="card stack" style={{ gap: 10 }}>
        <h2 className="label">Lo primero, en una frase</h2>
        <p>
          Esta herramienta se hizo gratis y de buena fe para que la ayuda llegue
          antes. No cobra, no vende datos, no tiene publicidad y no lucra con la
          emergencia de nadie.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Nuestra intención, y lo que te pedimos</h2>
        <p>
          Creemos que la enorme mayoría de las personas que llegan aquí vienen a
          ayudar o a pedir ayuda honestamente. Toda la plataforma está construida
          sobre esa confianza: por eso entrar no exige registro, ni documento, ni
          cuenta.
        </p>
        <p>
          Esa misma apertura es frágil. Un reporte inventado desvía recursos que
          otra familia estaba esperando, y un dato falso le hace perder a un
          voluntario un viaje que no le sobraba. Cuando alguien abusa, el costo
          no lo paga la plataforma: lo paga una persona damnificada.
        </p>
        <p className="strong">
          Te pedimos tres cosas: publica solo lo que necesitas de verdad, ofrece
          solo lo que puedas cumplir, y cierra lo que ya se resolvió.
        </p>
        <p className="meta">
          Existen defensas técnicas contra el abuso, pero ninguna sustituye a la
          decencia de quien usa la herramienta.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Advertencia importante</h2>
        <p className="notice notice--error">
          <span className="strong">
            Esta plataforma no es un servicio de emergencia
          </span>{" "}
          y no reemplaza a bomberos, policía, ambulancias, defensa civil ni a la
          Unidad Nacional para la Gestión del Riesgo de Desastres. Ante riesgo
          de vida inmediato, llama al{" "}
          <a className="strong" href={`tel:${SITE.emergencyNumber}`}>
            {SITE.emergencyNumber}
          </a>
          .
        </p>
        <p>
          Nadie garantiza que una necesidad publicada sea atendida, ni en cuánto
          tiempo. Quienes responden son voluntarios, no personal a cargo. La
          verificación de un coordinador ayuda, pero no es una certificación
          oficial ni un aval de nadie.
        </p>
        <p>
          <span className="strong">La ayuda de esta plataforma no se paga.</span>{" "}
          Nadie que ofrezca algo aquí debería pedirte plata, un depósito, una
          recarga ni datos de tu cuenta. Si pasa, es una estafa: no pagues y
          denúncialo desde la ficha.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Uso aceptable</h2>
        <p>Al usar esta plataforma te comprometes a no:</p>
        <ul className="stack" style={{ gap: 6 }}>
          <Item>Publicar necesidades falsas, exageradas o duplicadas.</Item>
          <Item>
            Usar los teléfonos que veas para algo distinto de coordinar esa
            ayuda concreta. Nunca para vender, hacer campaña, pedir dinero ni
            contactar después.
          </Item>
          <Item>
            Recolectar, copiar o extraer datos de la plataforma de forma
            masiva. Si tu organización necesita los datos para coordinar, hay
            una vía abierta y sin llave: escríbenos.
          </Item>
          <Item>
            Suplantar a otra persona, a una organización, a un coordinador o a
            una autoridad.
          </Item>
          <Item>
            Condicionar la entrega de ayuda a un pago, un voto, una firma, una
            afiliación o cualquier contraprestación.
          </Item>
          <Item>
            Tomar necesidades que no piensas cubrir, o bloquearlas para
            estorbar.
          </Item>
        </ul>
        <p className="meta">
          Los coordinadores acreditados pueden descartar reportes y restringir
          cuentas que incumplan esto. Las conductas que además sean delito
          —estafa, suplantación, hurto— se denuncian ante las autoridades.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Qué datos se tratan</h2>
        <p>Solo lo mínimo para que la ayuda llegue:</p>
        <ul className="stack" style={{ gap: 6 }}>
          <Item>
            <span className="strong">Lo que escribes en el reporte:</span>{" "}
            categoría, una frase de descripción, referencia del lugar, cantidad
            de personas y, si lo autorizas, tu ubicación aproximada.{" "}
            <span className="strong">Esto es público</span> dentro de la
            plataforma: es lo que permite que alguien te encuentre.
          </Item>
          <Item>
            <span className="strong">
              Tu nombre y teléfono, cuando pides ayuda:
            </span>{" "}
            <span className="strong">no son públicos</span>. Se guardan aparte y
            solo los alcanzan quien se compromete a cubrir tu necesidad mientras
            ese compromiso esté vigente, y los coordinadores acreditados. En una
            búsqueda de personas el acceso no es exclusivo —varias personas
            pueden tener información— pero se registra igual.
          </Item>
          <Item>
            <span className="strong">
              Tu nombre y teléfono, cuando ofreces ayuda:
            </span>{" "}
            <span className="strong">sí son públicos</span>, y se te avisa antes
            de publicar. Es al revés a propósito: publicas para que te llamen, y
            quien acaba de perderlo todo no debería tener que pedir permiso para
            hacerlo.
          </Item>
          <Item>
            <span className="strong">Un identificador anónimo</span> que crea tu
            navegador. No es tu nombre ni tu correo: es un número aleatorio que
            permite que solo tú puedas cerrar tu propio reporte.
          </Item>
          <Item>
            <span className="strong">Registro de accesos al contacto:</span>{" "}
            queda anotado qué cuenta accedió al teléfono de qué necesidad. Es lo
            que permite investigar si alguien usa mal esos datos.
          </Item>
          <Item>
            <span className="strong">Fallos de la aplicación:</span> cuando algo
            se rompe se guarda el error técnico, la pantalla donde ocurrió y el
            modelo de navegador. Nunca se guarda lo que escribiste ni tu
            teléfono, y no se manda a ningún servicio externo: se queda en el
            mismo proyecto que el resto.
          </Item>
        </ul>
        <p className="meta">
          No se pide documento de identidad, correo, ni datos bancarios. No hay
          publicidad ni rastreadores de terceros. Los datos no se venden ni se
          ceden con fines comerciales.
        </p>
        <p className="meta">
          El mapa lo dibuja un proveedor externo (Stadia Maps y OpenStreetMap),
          que por tanto ve desde qué zona se está mirando. Es lo único que sale
          de aquí sin que lo decidas.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Cuánto se conserva</h2>
        <ul className="stack" style={{ gap: 6 }}>
          <Item>
            <span className="strong">Nombre y teléfono:</span> se borran
            automáticamente a los 30 días de cerrada la necesidad.
          </Item>
          <Item>
            <span className="strong">El reporte sin contacto</span> (categoría,
            descripción, ubicación, fechas) se conserva como memoria de la
            emergencia y para poder auditar qué pasó.
          </Item>
        </ul>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Datos abiertos y otras plataformas</h2>
        <p>
          Los albergues y puntos de acopio se publican en abierto para que otras
          aplicaciones puedan mostrarlos: son sitios públicos, y que aparezcan en
          más mapas solo ayuda a que alguien los encuentre.
        </p>
        <p>
          <span className="strong">
            Las necesidades individuales no se abren.
          </span>{" "}
          Hacia afuera solo salen cuentas —cuántas hay por zona y por tipo—,
          nunca tu descripción, tu dirección ni tu teléfono.
        </p>
        <p className="meta">
          También se publican aquí ofertas que vienen de plataformas aliadas.
          Aparecen siempre con el nombre de quién las trajo y un enlace a su
          ficha, para que sepas de dónde salió el dato y a quién preguntarle.
          Que estén aquí no significa que las hayamos comprobado.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Tus derechos sobre tus datos</h2>
        <p>
          Conforme a la Ley 1581 de 2012 y sus decretos reglamentarios, puedes
          conocer, actualizar y rectificar tus datos personales, pedir prueba de
          la autorización que diste, ser informado sobre su uso, presentar
          quejas ante la Superintendencia de Industria y Comercio, y revocar la
          autorización o solicitar la supresión de tus datos.
        </p>
        <p>
          Para ejercer cualquiera de estos derechos, o para reportar un uso
          indebido, escribe a{" "}
          <a className="strong" href={`mailto:${SITE.contactEmail}`}>
            {SITE.contactEmail}
          </a>{" "}
          indicando el código de tu reporte.
        </p>
        <p className="meta">
          Responsable del tratamiento: {SITE.authorFull}.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Límites de responsabilidad</h2>
        <p>
          La plataforma se ofrece “tal como está”, sin garantía de
          disponibilidad, exactitud ni continuidad. Depende de internet, de
          servicios de terceros y de energía eléctrica, y en una catástrofe
          cualquiera de los tres puede faltar.
        </p>
        <p>
          Quien publica es responsable de la veracidad de lo que publica. Quien
          ofrece ayuda es responsable de sus actos al prestarla. La coordinación
          y la entrega ocurren directamente entre las personas, fuera de la
          plataforma, bajo su propio criterio y riesgo.
        </p>
        <p>
          Quien desarrolla esta herramienta lo hace de forma voluntaria y
          gratuita, y no responde por daños derivados del uso o de la
          imposibilidad de uso, en la máxima medida que permita la ley
          aplicable.
        </p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <h2 className="label">Autoría</h2>
        <p className="strong" style={{ fontSize: 20 }}>
          {SITE.author}
        </p>
        <p className="subtitle">{SITE.org}</p>
        <p className="meta">
          Hecha sin ánimo de lucro para la emergencia del occidente colombiano.
          Si eres parte de una organización de socorro y quieres usarla,
          adaptarla a otra zona o auditarla, escribe a{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        </p>
      </section>

      <nav className="stack" style={{ gap: 10 }}>
        <hr className="hr" />
        <Link className="btn btn--ghost" href="/como-usar/">
          Cómo usar la plataforma
        </Link>
        <Link className="btn btn--primary" href="/">
          Volver al inicio
        </Link>
      </nav>
    </main>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="row" style={{ alignItems: "flex-start", gap: 10 }}>
      <span aria-hidden="true" className="meta">
        ·
      </span>
      <span className="grow">{children}</span>
    </li>
  );
}
