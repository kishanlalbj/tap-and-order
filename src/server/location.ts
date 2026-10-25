import "server-only";
import { cookies } from "next/headers";
import geohash from "ngeohash";
import { z } from "zod";
import { DEFAULT_LOCATION, type LatLng } from "@/lib/geo";

export const LOCATION_COOKIE = "loc";

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(80),
  line: z.string().max(200).optional(),
  addressId: z.string().uuid().optional(),
});

export type DeliveryLocation = z.infer<typeof locationSchema>;

export async function getLocation(): Promise<DeliveryLocation & { isDefault: boolean }> {
  const raw = (await cookies()).get(LOCATION_COOKIE)?.value;
  if (raw) {
    try {
      const parsed = locationSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return { ...parsed.data, isDefault: false };
    } catch {}
  }
  return { ...DEFAULT_LOCATION, isDefault: true };
}

export async function setLocation(loc: DeliveryLocation) {
  const value = locationSchema.parse(loc);
  (await cookies()).set(LOCATION_COOKIE, JSON.stringify(value), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

/**
 * Catalog reads snap the location to the centre of its geohash cell (~1.2 x 0.6 km) so that
 * nearby users share cache entries. Checkout always re-validates against the exact point.
 */
export function snapForCache(loc: LatLng) {
  const hash = geohash.encode(loc.lat, loc.lng, 6);
  const { latitude, longitude } = geohash.decode(hash);
  return { hash, point: { lat: latitude, lng: longitude } };
}
