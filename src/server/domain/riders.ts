import { redis } from "@/lib/redis";
import type { LatLng } from "@/lib/geo";

/** Redis GEO set of riders who are online and free; dispatch searches it by distance. */
const ONLINE_KEY = "riders:online";

export async function markRiderAvailable(riderId: string, loc: LatLng) {
  await redis.geoadd(ONLINE_KEY, loc.lng, loc.lat, riderId);
}

export async function markRiderUnavailable(riderId: string) {
  await redis.zrem(ONLINE_KEY, riderId);
}

export async function nearestAvailableRiders(loc: LatLng, radiusKm = 10, count = 5) {
  const res = (await redis.geosearch(
    ONLINE_KEY,
    "FROMLONLAT",
    loc.lng,
    loc.lat,
    "BYRADIUS",
    radiusKm,
    "km",
    "ASC",
    "COUNT",
    count,
  )) as string[];
  return res;
}
