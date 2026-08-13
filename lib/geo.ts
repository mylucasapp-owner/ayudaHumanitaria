import type { GeoPoint } from "./types";

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export type GeoResult =
  | { ok: true; point: GeoPoint; accuracy: number }
  | { ok: false; message: string };

export function getCurrentPosition(timeoutMs = 15000): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, message: "Este dispositivo no entrega ubicación." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
        }),
      (err) => resolve({ ok: false, message: geoMessage(err) }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

function geoMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Permiso de ubicación denegado. Escribe una referencia o marca el punto en el mapa.";
    case err.POSITION_UNAVAILABLE:
      return "No hay señal GPS. Escribe una referencia o marca el punto en el mapa.";
    case err.TIMEOUT:
      return "El GPS tardó demasiado. Reintenta o marca el punto en el mapa.";
    default:
      return "No se pudo obtener la ubicación.";
  }
}

export function formatAgo(ms: number | null): string {
  if (!ms) return "recién";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "recién";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function formatCountdown(untilMs: number): string {
  const s = Math.max(0, Math.floor((untilMs - Date.now()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
