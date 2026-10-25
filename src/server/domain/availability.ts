import { sql, type SQL } from "drizzle-orm";
import type { LatLng } from "@/lib/geo";
import { geog } from "@/lib/geo-sql";

type Aliases = { offer?: "o" | "o2"; seller?: "s" | "s2" };

/**
 * SQL predicate for an offer that someone at `loc` can buy right now: active with enough stock,
 * store approved, open and accepting orders, and `loc` inside the store's service radius.
 * Written against table aliases (default `o` = offers, `s` = sellers).
 */
export function offerAvailableAt(loc: LatLng, opts: Aliases & { minStock?: number } = {}): SQL {
  const o = sql.raw(opts.offer ?? "o");
  const s = sql.raw(opts.seller ?? "s");
  return sql`${o}.active and ${o}.stock >= ${opts.minStock ?? 1}
    and ${s}.status = 'APPROVED' and ${s}.is_accepting_orders
    and (now() at time zone 'Asia/Kolkata')::time between ${s}.opens_at and ${s}.closes_at
    and ST_DWithin(${s}.location::geography, ${geog(loc)}, ${s}.service_radius_m)`;
}

export function distanceFrom(loc: LatLng, seller: "s" | "s2" = "s"): SQL<number> {
  return sql<number>`ST_Distance(${sql.raw(seller)}.location::geography, ${geog(loc)})`;
}
