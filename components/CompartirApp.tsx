"use client";

import { useState } from "react";
import { SITE } from "@/lib/site";

/**
 * Difundir la app entera, no una necesidad suelta.
 *
 * Hasta ahora solo se podía compartir un reporte concreto, que sirve para
 * cubrir ese caso y para nada más. Una plataforma de emergencia crece por
 * cadenas de WhatsApp, y no había con qué empezar una: quien quería ayudar a
 * difundirla tenía que copiar la URL de la barra del navegador, algo que en un
 * teléfono casi nadie hace.
 *
 * El texto está escrito para que se entienda SIN abrir el enlace. En una cadena
 * de WhatsApp la mayoría no entra: lee, decide si le sirve a alguien y reenvía.
 * Por eso dice qué es, para quién, y que no cuesta ni pide registro —lo que más
 * frena a alguien desconfiado ante un enlace que le llegó de un desconocido.
 */
const MENSAJE =
  `AYUDA HUMANITARIA — necesidades reales de los damnificados, en un mapa.\n\n` +
  `Si necesitas ayuda, repórtala ahí y alguien cerca la ve.\n` +
  `Si puedes ayudar, mira qué hace falta cerca de ti.\n` +
  `También muestra albergues y puntos de acopio.\n\n` +
  `Gratis, sin registro y funciona sin señal.\n` +
  `${SITE.url}\n\n` +
  `Reenvíalo a quien esté en zona afectada.`;

export default function CompartirApp() {
  const [copiado, setCopiado] = useState(false);

  return (
    <section className="stack" style={{ gap: 10 }}>
      <hr className="hr" />
      <p className="meta center">
        <span className="strong">Esto solo sirve si la gente sabe que existe.</span>{" "}
        Reenvíalo a grupos de tu barrio, de tu edificio o de tu vereda.
      </p>
      <a
        className="btn"
        href={`https://wa.me/?text=${encodeURIComponent(MENSAJE)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Compartir por WhatsApp
      </a>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={async () => {
          try {
            if (navigator.share) {
              await navigator.share({ text: MENSAJE });
            } else {
              await navigator.clipboard.writeText(MENSAJE);
              setCopiado(true);
            }
          } catch {
            /* el usuario canceló el diálogo */
          }
        }}
      >
        {copiado ? "Mensaje copiado" : "Compartir de otra forma"}
      </button>
    </section>
  );
}
