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
} from "./tiles";
import { CATEGORY_GLYPH, isClaimExpired, type GeoPoint, type Need } from "@/lib/types";

function pinIcon(need: Need) {
  const claimed = need.status === "comprometida" && !isClaimExpired(need);
  return L.divIcon({
    className: "",
    html: `<div class="pin${claimed ? " pin--claimed" : ""}">${CATEGORY_GLYPH[need.category]}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/**
 * Mapa de necesidades. Se monta una sola vez y después solo sincroniza
 * marcadores, para que redibujar la lista no cueste una recarga de teselas
 * en una conexión lenta.
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
    // El contenedor a veces mide 0 en el primer pintado dentro de un flex.
    setTimeout(() => m.invalidateSize(), 50);
    return () => {
      m.remove();
      map.current = null;
      markers.current.clear();
      meMarker.current = null;
    };
  }, []);

  // Sincroniza marcadores: añade los nuevos, actualiza los cambiados, quita los idos.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();

    for (const need of needs) {
      if (!need.location) continue;
      seen.add(need.id);
      const existing = markers.current.get(need.id);
      if (existing) {
        existing.setLatLng([need.location.lat, need.location.lng]);
        existing.setIcon(pinIcon(need));
      } else {
        const marker = L.marker([need.location.lat, need.location.lng], {
          icon: pinIcon(need),
          keyboard: true,
          title: need.description,
          alt: need.description,
        })
          .addTo(m)
          .on("click", () => select.current(need.id));
        markers.current.set(need.id, marker);
      }
    }

    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }

    if (!fitted.current && markers.current.size > 0) {
      const bounds = L.latLngBounds(
        [...markers.current.values()].map((mk) => mk.getLatLng()),
      );
      if (me) bounds.extend([me.lat, me.lng]);
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [needs, me]);

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
        className="map"
        ref={holder}
        role="application"
        aria-label="Mapa de necesidades"
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
