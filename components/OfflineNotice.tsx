"use client";

import { useEffect, useState } from "react";

/**
 * Aviso de falta de señal. No toca Firebase a propósito: lo usa la portada,
 * que debe pintarse antes de que se descargue el SDK.
 */
export default function OfflineNotice() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <p className="notice notice--signal">
      Sin conexión. Puedes seguir usando la app: lo que envíes se guardará y
      saldrá apenas vuelva la señal.
    </p>
  );
}
