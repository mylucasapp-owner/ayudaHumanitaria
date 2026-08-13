"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Última red de seguridad. Sin esto, cualquier excepción no prevista deja una
 * pantalla en blanco: la persona no sabe si la app murió, si se quedó sin datos
 * o si su reporte se perdió, y no tiene ninguna salida más que cerrar.
 *
 * Lo que más importa aquí no es el botón de reintentar, sino decirle que lo que
 * ya escribió sigue guardado en el teléfono. Si cree que se perdió, lo va a
 * escribir de nuevo y va a duplicar el pedido.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("fallo no controlado:", error);
  }, [error]);

  return (
    <main className="shell" id="main">
      <div className="spacer" />
      <section className="stack" style={{ gap: 16 }}>
        <h1 className="title">Algo falló</h1>
        <p className="subtitle">
          La aplicación tuvo un problema inesperado. No fue culpa tuya.
        </p>

        <p className="notice notice--signal">
          <span className="strong">Tus reportes no se perdieron.</span> Lo que
          hayas enviado sigue guardado, y lo que quedó sin señal se enviará solo
          cuando vuelva la conexión.
        </p>

        <button type="button" className="btn btn--primary" onClick={reset}>
          Reintentar
        </button>
        <Link className="btn" href="/">
          Volver al inicio
        </Link>

        <hr className="hr" />
        <p className="meta center">
          Si necesitas ayuda urgente y la app no responde, llama al{" "}
          <a className="strong" href="tel:123">
            123
          </a>
          .
        </p>
      </section>
    </main>
  );
}
