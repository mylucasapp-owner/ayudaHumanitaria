"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";

/**
 * Monta Firebase solo en las pantallas que lo necesitan. Si el proveedor
 * viviera en el layout raíz, la portada —dos botones y nada más— arrastraría
 * el SDK completo antes de poder pintarse, que es justo lo que no puede pasar
 * en una conexión 3G.
 */
export default function FirebaseGate({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
