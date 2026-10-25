import { redis } from "./redis";

const VERSION_KEY = "catalog:version";

/**
 * Catalog reads are cached under a global version number. Any offer/seller/product change bumps
 * the version, which invalidates every cached entry at once without scanning keys.
 */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const version = (await redis.get(VERSION_KEY)) ?? "0";
  const fullKey = `cache:v${version}:${key}`;
  const hit = await redis.get(fullKey);
  if (hit) return JSON.parse(hit) as T;
  const value = await load();
  await redis.set(fullKey, JSON.stringify(value), "EX", ttlSeconds);
  return value;
}

export async function invalidateCatalog() {
  await redis.incr(VERSION_KEY);
}
