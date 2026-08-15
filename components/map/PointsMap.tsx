"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  TILE_ATTRIBUTION,
  TILE_URL,
  FALLBACK_CENTER,
  FALLBACK_ZOOM,
  TILE_MAX_ZOOM,
  mapClass,
} from "./tiles";
import type { GeoPoint } from "@/lib/types";

/**
 * Un punto pintable. Deliberadamente no sabe nada de necesidades ni de
 * albergues: el mapa es el mismo trabajo —montar una vez, sincronizar
 * marcadores, no recargar teselas en una conexión lenta— y tenerlo dos veces
 * garantizaba que un arreglo se aplicara solo a la mitad.
 */
export type MapMarker = {
  id: string;
  point: GeoPoint;
  /** Una letra o símbolo, legible a 30px. */
  glyph: string;
  title: string;
  /** Atenuado: ya tomado, ya cerrado. Sigue en el mapa pero no compite. */
  dimmed?: boolean;
};

export default function PointsMap({
  markers: entrada,
  me,
  onSelect,
  ariaLabel,
}: {
  markers: MapMarker[];
  me: GeoPoint | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const meMarker = useRef<L.Marker | null>(null);
  const fitted = useRef(false);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [sinTeselas, setSinTeselas] = useState(false);

  useEffect(() => {
    if (!holder.current || map.current) return;
    const m = L.map(holder.current, {
      center: [FALLBACK_CENTER.lat, FALLBACK_CENTER.lng],
      zoom: FALLBACK_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });
    const capa = L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: TILE_MAX_ZOOM,
      crossOrigin: true,
    }).addTo(m);

    // Que el fondo no cargue deja rectángulos grises y la sensación de que la
    // app se rompió. Los marcadores siguen siendo correctos, así que se dice
    // qué pasó y se apunta a la lista, que no depende de ningún proveedor.
    let fallos = 0;
    capa.on("tileerror", () => {
      fallos++;
      if (fallos >= 4) setSinTeselas(true);
    });
    capa.on("tileload", () => setSinTeselas(false));

    map.current = m;

    // Leaflet mide el contenedor una vez y no vuelve a mirar. Dentro de un flex
    // —o al montarse mientras la vista de lista todavía ocupa el ancho— mide de
    // menos y solo pide teselas para ese trozo: el resto queda gris y parece que
    // el mapa se rompió. Un timeout fijo acierta a veces; observar el tamaño
    // acierta siempre, y también cubre el giro del teléfono.
    const observer = new ResizeObserver(() => m.invalidateSize({ pan: false }));
    observer.observe(holder.current);

    // Se captura aquí: en la limpieza, `markers.current` podría apuntar ya a
    // otro mapa y dejaríamos marcadores vivos del anterior.
    const marcadores = markers.current;
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
      marcadores.clear();
      meMarker.current = null;
    };
  }, []);

  // Sincroniza marcadores: añade los nuevos, actualiza los cambiados, quita los idos.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();

    for (const entry of entrada) {
      seen.add(entry.id);
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin${entry.dimmed ? " pin--claimed" : ""}">${entry.glyph}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const existing = markers.current.get(entry.id);
      if (existing) {
        existing.setLatLng([entry.point.lat, entry.point.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([entry.point.lat, entry.point.lng], {
          icon,
          keyboard: true,
          title: entry.title,
          alt: entry.title,
        })
          .addTo(m)
          .on("click", () => select.current(entry.id));
        markers.current.set(entry.id, marker);
      }
    }

    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }

    if (!fitted.current && markers.current.size > 0) {
      // El tamaño se recalcula ANTES de encuadrar. Si se encuadra con la medida
      // vieja, Leaflet centra sobre un contenedor que ya no existe y deja el
      // mapa desplazado: se ven teselas en una franja y gris alrededor, que
      // parece un mapa roto aunque los puntos estén bien.
      m.invalidateSize({ pan: false });
      const bounds = L.latLngBounds(
        [...markers.current.values()].map((mk) => mk.getLatLng()),
      );
      if (me) bounds.extend([me.lat, me.lng]);
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [entrada, me]);

  useEffect(() => {
    const m = map.current;
    if (!m || !me) return;
    const icon = L.divIcon({
      className: "",
      html: '<div class="pin pin--me"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    if (meMarker.current) {
      meMarker.current.setLatLng([me.lat, me.lng]);
    } else {
      meMarker.current = L.marker([me.lat, me.lng], {
        icon,
        interactive: false,
        title: "Tu ubicación",
      }).addTo(m);
      if (!fitted.current) {
        m.setView([me.lat, me.lng], 14);
        fitted.current = true;
      }
    }
  }, [me]);

  return (
    <div className="map-wrap">
      <div
        className={mapClass("map")}
        ref={holder}
        role="application"
        aria-label={ariaLabel}
      />
      {sinTeselas && (
        <p className="map-aviso" role="status">
          El fondo del mapa no cargó. Los puntos siguen siendo correctos; si no
          los ves bien, usa la vista de lista.
        </p>
      )}
    </div>
  );
}
