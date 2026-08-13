"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Invitación a instalar la app.
 *
 * Instalada, abre sin barra del navegador y —lo que de verdad importa— arranca
 * con la última vista guardada aunque no haya señal. En Chocó eso puede ser la
 * diferencia entre tener el mapa y no tener nada.
 *
 * iOS no expone `beforeinstallprompt`, así que ahí se explican los pasos a mano.
 */
export default function InstallPWA() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari en iOS no implementa display-mode: standalone.
      (window.navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    setIsIOS(
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
        !/crios|fxios/i.test(navigator.userAgent),
    );

    const capture = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  if (installed) {
    return (
      <p className="notice">
        Ya tienes la app instalada. Abre sin conexión con la última información
        que alcanzó a guardar.
      </p>
    );
  }

  if (prompt) {
    return (
      <button
        type="button"
        className="btn btn--primary"
        onClick={async () => {
          await prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome === "accepted") setInstalled(true);
          setPrompt(null);
        }}
      >
        Instalar la app
      </button>
    );
  }

  if (isIOS) {
    return (
      <div className="notice">
        <span className="strong">Para instalarla en iPhone:</span> toca el botón
        Compartir abajo en Safari, y luego{" "}
        <span className="strong">Añadir a pantalla de inicio</span>.
      </div>
    );
  }

  return (
    <div className="notice">
      <span className="strong">Para instalarla:</span> abre el menú de tu
      navegador (⋮) y elige{" "}
      <span className="strong">Instalar aplicación</span> o{" "}
      <span className="strong">Añadir a pantalla de inicio</span>.
    </div>
  );
}
