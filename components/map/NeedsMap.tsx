"use client";

import { useMemo } from "react";
import PointsMap, { type MapMarker } from "./PointsMap";
import { CATEGORY_GLYPH, isClaimExpired, type GeoPoint, type Need } from "@/lib/types";

/**
 * Mapa de necesidades. Solo traduce necesidades a marcadores; el mapa en sí es
 * PointsMap, compartido con los puntos a donde ir.
 *
 * Las necesidades sin coordenadas no se pintan, y es a propósito. Deducir el
 * departamento por la referencia escrita sirve para filtrar la lista, pero no da
 * un punto: clavar un pin en el centro del departamento mentiría con la
 * precisión que da un mapa y mandaría gente a una dirección que nadie dio.
 */
export default function NeedsMap({
  needs,
  me,
  onSelect,
}: {
  needs: Need[];
  me: GeoPoint | null;
  onSelect: (id: string) => void;
}) {
  const markers = useMemo<MapMarker[]>(
    () =>
      needs
        .filter((n) => n.location)
        .map((n) => ({
          id: n.id,
          point: n.location!,
          glyph: CATEGORY_GLYPH[n.category],
          title: n.description,
          dimmed: n.status === "comprometida" && !isClaimExpired(n),
        })),
    [needs],
  );

  return (
    <PointsMap
      markers={markers}
      me={me}
      onSelect={onSelect}
      ariaLabel="Mapa de necesidades"
    />
  );
}
