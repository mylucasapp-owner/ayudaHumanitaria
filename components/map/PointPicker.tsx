"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_ATTRIBUTION, TILE_URL, FALLBACK_CENTER } from "./tiles";
import type { GeoPoint } from "@/lib/types";

/**
 * Mapa para marcar un punto a mano. Es la salida cuando el GPS falla: bajo
 * escombros o entre muros gruesos casi nunca hay fix, pero la gente sí sabe
 * señalar dónde está.
 */
export default function PointPicker({
  value,
  onChange,
}: {
  value: GeoPoint | null;
  onChange: (point: GeoPoint) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!holder.current || map.current) return;
    const start = value ?? FALLBACK_CENTER;
    const m = L.map(holder.current, {
      center: [start.lat, start.lng],
      zoom: value ? 16 : 12,
    });
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) =>
      change.current({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // El punto inicial solo importa al montar; después manda `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !value) return;
    const icon = L.divIcon({
      className: "",
      html: '<div class="pin">×</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    if (marker.current) {
      marker.current.setLatLng([value.lat, value.lng]);
    } else {
      marker.current = L.marker([value.lat, value.lng], {
        icon,
        draggable: true,
      })
        .addTo(m)
        .on("dragend", (e) => {
          const p = (e.target as L.Marker).getLatLng();
          change.current({ lat: p.lat, lng: p.lng });
        });
    }
    m.setView([value.lat, value.lng], Math.max(m.getZoom(), 15));
  }, [value]);

  return (
    <div
      className="map map--picker"
      ref={holder}
      role="application"
      aria-label="Toca el mapa para marcar la ubicación"
    />
  );
}
