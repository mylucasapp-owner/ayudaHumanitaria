"use client";

import { useEffect } from "react";
import { instalarDiagnostico } from "@/lib/diagnostics";

/** Engancha el registro de fallos del cliente. No pinta nada. */
export default function Diagnostics() {
  useEffect(() => {
    instalarDiagnostico();
  }, []);

  return null;
}
