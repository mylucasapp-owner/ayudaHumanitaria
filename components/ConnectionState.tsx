"use client";

import OfflineNotice from "./OfflineNotice";
import { useAuth } from "@/lib/auth";

/** Estado de conexión y de sesión. Solo para pantallas que ya usan Firebase. */
export default function ConnectionState() {
  const { error, blocked } = useAuth();
  if (error) return <p className="notice notice--error">{error}</p>;
  if (blocked) {
    return (
      <p className="notice notice--error">
        Un coordinador restringió esta sesión y no puede publicar ni tomar
        necesidades. Si crees que es un error, acércate a un punto de
        coordinación en terreno.
      </p>
    );
  }
  return <OfflineNotice />;
}
