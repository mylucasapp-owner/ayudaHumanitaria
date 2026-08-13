"use client";

import OfflineNotice from "./OfflineNotice";
import { useAuth } from "@/lib/auth";

/** Estado de conexión y de sesión. Solo para pantallas que ya usan Firebase. */
export default function ConnectionState() {
  const { error } = useAuth();
  if (error) return <p className="notice notice--error">{error}</p>;
  return <OfflineNotice />;
}
