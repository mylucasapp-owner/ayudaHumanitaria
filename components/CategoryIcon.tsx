import type { Category } from "@/lib/types";

/**
 * Íconos de trazo, sin relleno ni detalle: legibles a 20px y a 48px, y
 * heredan el color para funcionar igual sobre negro o sobre blanco.
 */
const PATHS: Record<Category, React.ReactNode> = {
  medico: (
    <>
      <path d="M12 4v16M4 12h16" />
    </>
  ),
  // Frasco con pastilla: medicina, no atención. La diferencia importa porque un
  // medicamento crónico lo cubre una farmacia o un vecino con receta, mientras
  // que un especialista es una búsqueda completamente distinta.
  medicamentos: (
    <>
      <path d="M8 3h8" />
      <path d="M9 3v3l-2 3v11h10V9l-2-3V3" />
      <path d="M9 13h6" />
      <path d="M12 10v6" />
    </>
  ),
  rescate: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  agua: (
    <>
      <path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3Z" />
    </>
  ),
  refugio: (
    <>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  transporte: (
    <>
      <path d="M2 8h11v9H2z" />
      <path d="M13 11h4l4 3.5V17h-8" />
      <circle cx="7" cy="18.5" r="2" />
      <circle cx="17" cy="18.5" r="2" />
    </>
  ),
  // Silueta de persona dentro de una lupa: se busca a alguien, no una cosa.
  personas: (
    <>
      <circle cx="11" cy="9" r="3" />
      <path d="M6 17c0-2.5 2.2-4 5-4s5 1.5 5 4" />
      <circle cx="11" cy="12" r="8.5" />
      <path d="M17.5 18.5 22 22" />
    </>
  ),
  // Tres puntos: lo que no cabe en las otras casillas. Deliberadamente neutro,
  // porque aquí entran cosas muy distintas —peritar una casa, un funeral, un
  // veterinario— y cualquier dibujo concreto excluiría a las demás.
  otro: (
    <>
      <path d="M5 12h.01" />
      <path d="M12 12h.01" />
      <path d="M19 12h.01" />
    </>
  ),
};

export default function CategoryIcon({
  category,
  size = 44,
}: {
  category: Category;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[category]}
    </svg>
  );
}
