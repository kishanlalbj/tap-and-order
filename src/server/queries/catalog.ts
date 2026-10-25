import "server-only";
import { asc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cached } from "@/lib/cache";
import type { LatLng } from "@/lib/geo";
import { geog } from "@/lib/geo-sql";
import { snapForCache } from "@/server/location";
import { distanceFrom, offerAvailableAt } from "@/server/domain/availability";

export type ProductCardData = {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  imageUrl: string | null;
  categoryIcon: string;
  categorySlug: string;
  categoryName: string;
  bestOfferId: string;
  bestPricePaise: number;
  bestMrpPaise: number;
  bestStoreName: string;
  sellerCount: number;
  maxPricePaise: number;
};

export type OfferRow = {
  offerId: string;
  sellerId: string;
  storeName: string;
  pricePaise: number;
  mrpPaise: number;
  stock: number;
  distanceM: number;
};

export function getCategories() {
  return cached("categories", 300, () =>
    db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder)),
  );
}

type ListArgs = { loc: LatLng; categorySlug?: string; q?: string; limit?: number };

/** Products that at least one nearby seller can deliver now, with the cheapest offer for each. */
export function listProductsNearby({ loc, categorySlug, q, limit = 60 }: ListArgs) {
  const { hash, point } = snapForCache(loc);
  const term = q?.trim().toLowerCase() || undefined;
  const key = `products:${hash}:${categorySlug ?? "*"}:${term ?? ""}:${limit}`;

  return cached(key, 30, async () => {
    const rows = await db.execute<ProductCardData>(sql`
      with nearby as (
        select o.id as offer_id, o.product_id, o.price_paise, o.mrp_paise,
               s.store_name, ${distanceFrom(point)} as dist
        from offers o join sellers s on s.id = o.seller_id
        where ${offerAvailableAt(point)}
      )
      select p.id, p.name, p.brand, p.unit, p.image_url as "imageUrl", c.icon as "categoryIcon",
             c.slug as "categorySlug", c.name as "categoryName",
             best.offer_id as "bestOfferId", best.price_paise as "bestPricePaise",
             best.mrp_paise as "bestMrpPaise", best.store_name as "bestStoreName",
             agg.seller_count::int as "sellerCount", agg.max_price::int as "maxPricePaise"
      from products p
      join categories c on c.id = p.category_id
      join lateral (
        select * from nearby n where n.product_id = p.id order by n.price_paise, n.dist limit 1
      ) best on true
      join lateral (
        select count(*) as seller_count, max(n.price_paise) as max_price
        from nearby n where n.product_id = p.id
      ) agg on true
      where p.active
        ${categorySlug ? sql`and c.slug = ${categorySlug}` : sql``}
        ${
          term
            ? sql`and (p.name ilike ${"%" + term + "%"} or p.brand ilike ${"%" + term + "%"}
                     or similarity(p.name, ${term}) > 0.2)`
            : sql``
        }
      order by ${term ? sql`similarity(p.name, ${term}) desc,` : sql``} c.sort_order, p.name
      limit ${limit}
    `);
    return [...rows];
  });
}

export async function getProduct(productId: string) {
  const [row] = await db
    .select({
      product: schema.products,
      category: schema.categories,
    })
    .from(schema.products)
    .innerJoin(schema.categories, sql`${schema.categories.id} = ${schema.products.categoryId}`)
    .where(sql`${schema.products.id} = ${productId}`);
  return row ?? null;
}

/** Every nearby offer for a product, cheapest first (ties broken by distance). */
export async function getOffersForProduct(productId: string, loc: LatLng) {
  const rows = await db.execute<OfferRow>(sql`
    select o.id as "offerId", s.id as "sellerId", s.store_name as "storeName",
           o.price_paise as "pricePaise", o.mrp_paise as "mrpPaise", o.stock,
           ${distanceFrom(loc)} as "distanceM"
    from offers o join sellers s on s.id = o.seller_id
    where o.product_id = ${productId} and ${offerAvailableAt(loc)}
    order by o.price_paise, "distanceM"
  `);
  return [...rows];
}

export async function countNearbySellers(loc: LatLng) {
  const { hash, point } = snapForCache(loc);
  return cached(`seller-count:${hash}`, 30, async () => {
    const [row] = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from sellers s
      where s.status = 'APPROVED' and s.is_accepting_orders
        and (now() at time zone 'Asia/Kolkata')::time between s.opens_at and s.closes_at
        and ST_DWithin(s.location::geography, ${geog(point)}, s.service_radius_m)
    `);
    return row?.n ?? 0;
  });
}
