"use client";

import { useEffect, useState } from "react";
import { SITE } from "./site";

/**
 * El dominio real desde el que se está mirando, para armar enlaces a compartir.
 *
 * Existe porque `window.location.origin` leído directamente al pintar no basta.
 * Esta app se exporta estática: Next pre-genera el HTML de cada pantalla al
 * construir, donde no hay navegador, así que ahí queda grabado el dominio de
 * respaldo. La hidratación no lo corrige —React conserva lo que ya venía— y el
 * resultado fue que en `ayudahumanitaria.info` los botones de compartir seguían
 * repartiendo el dominio viejo de Firebase.
 *
 * Con estado que se rellena tras montar, el primer pintado usa el respaldo y el
 * navegador lo reemplaza de inmediato. Nadie llega a copiar el valor viejo
 * porque para tocar un botón la página ya montó.
 */
export function useOrigen(): string {
  const [origen, setOrigen] = useState<string>(SITE.url);

  useEffect(() => {
    setOrigen(window.location.origin);
  }, []);

  return origen;
}
