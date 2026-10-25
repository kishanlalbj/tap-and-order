export type LatLng = { lat: number; lng: number };

export const BENGALURU_AREAS: (LatLng & { label: string })[] = [
  { label: "Indiranagar", lat: 12.9719, lng: 77.6412 },
  { label: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { label: "HSR Layout", lat: 12.9116, lng: 77.6474 },
  { label: "Jayanagar", lat: 12.925, lng: 77.5938 },
  { label: "Whitefield", lat: 12.9698, lng: 77.75 },
  { label: "Malleshwaram", lat: 13.0035, lng: 77.5709 },
];

export const DEFAULT_LOCATION = BENGALURU_AREAS[1];

/** Haversine distance in metres; used where we already have both points in memory. */
export function distanceM(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/** Drizzle geometry columns in "xy" mode use x = lng, y = lat. */
export const toPoint = ({ lat, lng }: LatLng) => ({ x: lng, y: lat });
export const fromPoint = (p: { x: number; y: number }): LatLng => ({ lat: p.y, lng: p.x });
