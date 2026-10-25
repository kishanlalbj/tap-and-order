# Tap & Order

Hyperlocal quick-commerce marketplace. Neighbourhood stores list products with their own prices, customers see
the **cheapest nearby store for every item**, and the platform's own riders pick up from each store and deliver
everything in one trip.

**Stack:** Next.js 15 (App Router, Server Actions), Tailwind v4, shadcn/ui (Base UI), Postgres 16 + PostGIS
(Drizzle ORM), Redis 7, BullMQ, Auth.js v5.

## Run it

```bash
docker compose up -d          # Postgres (localhost:5433) + Redis (localhost:6380)
pnpm install
cp .env.example .env          # then set AUTH_SECRET (e.g. `npx auth secret`)
pnpm db:migrate
pnpm db:seed                  # resets all data
pnpm dev                      # terminal 1: http://localhost:3000
pnpm worker                   # terminal 2: queue worker (required for timeouts, dispatch, ledger)
```

`pnpm smoke` runs an end-to-end check of the whole order lifecycle against the running worker.

### Demo accounts (password `password123`)

| Role     | Email                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Customer | `asha@tap.dev`, `vikram@tap.dev`                                          |
| Seller   | `freshmart@tap.dev`, `dailyneeds@tap.dev`, `quickbasket@tap.dev`, `jayanagarstores@tap.dev` |
| Seller (pending approval) | `whitefieldmart@tap.dev`                                 |
| Rider    | `rider1@tap.dev`, `rider2@tap.dev`, `rider3@tap.dev`                      |
| Admin    | `admin@tap.dev`                                                           |

### Demo walkthrough

Use separate browsers or profiles for each role.

1. **Rider** (`rider1`): tap **Go online**. Location is simulated by default, starting at Koramangala.
2. **Customer** (`asha`): delivery location is Koramangala, where all 4 stores are in range. Add a few items. The
   cart groups them by store, and product pages compare every store's price. Check out.
3. **Sellers** (`dailyneeds`, `freshmart`, …): a toast announces the new order. **Accept**, then **Mark packed**.
   Reject one to watch its items move to the next-cheapest store. Ignore one for 2 minutes to see the timeout do
   the same.
4. Once every store has accepted, the worker assigns the nearest online rider. The rider app lists each pickup and
   then the drop, and the simulated rider drives toward each stop. The customer's tracking page shows the
   distance live.
5. Deliver the order, then open **Seller → Earnings** and **Admin → Payouts** to settle the balance.
6. **Admin**: approve **Whitefield Mart**, then set the customer's location to Whitefield. That store now serves
   the area.

## How it works

```
Browser ──Server Actions──▶ Next.js ──▶ Postgres/PostGIS (source of truth)
   ▲                           │
   │ SSE /api/stream           ├──▶ Redis: carts, catalog cache, rider GEO set
   └────── Redis pub/sub ◀─────┤
                               └──▶ BullMQ queues ──▶ worker/index.ts
```

- **Catalog model:** one master `products` table; each seller has `offers` (price, MRP, stock). Customers only see
  offers from stores that are approved, open, accepting orders, and within `service_radius_m` of them
  (`ST_DWithin` on geography, see `src/server/domain/availability.ts`). Catalog reads are cached in Redis per
  geohash cell, and a version counter invalidates the cache whenever an offer or store changes.
- **Cart:** Redis hash `cart:{userId}` → `offerId: qty`. Each product comes from one store; switching stores moves
  the quantity.
- **Checkout** (`src/server/domain/checkout.ts`): one transaction re-validates availability, reserves stock with
  conditional `UPDATE … WHERE stock >= qty`, and creates one `order` plus one `seller_order` per store. Payment is
  mocked.
- **Order state machine** (`src/server/domain/orders.ts`): the customer-facing status is always derived from the
  seller orders and the delivery in `recomputeOrder()`.
  - Seller order: `PENDING → ACCEPTED → PACKED → PICKED_UP → DELIVERED` (or `REJECTED`)
  - Order: `PLACED → CONFIRMED → PACKED → OUT_FOR_DELIVERY → DELIVERED` (or `CANCELLED`)
- **Queues** (`worker/index.ts`):
  - `seller-orders`: a delayed accept-timeout per seller order. Rejected or timed-out items are reassigned to the
    next-cheapest nearby store, or refunded if no store has them.
  - `dispatch`: once all stores have confirmed, claims the nearest online rider (`GEOSEARCH riders:online`) and
    retries every 15 s until one is free.
  - `ledger`: on delivery, posts `SALE` and `COMMISSION` rows per seller. Admin payouts post `PAYOUT`, so the
    balance is the sum of a seller's rows.
  - `notifications`: stub SMS/push log lines.
- **Realtime:** every state change publishes to Redis channels (`order:<id>`, `seller:<id>`, `rider:<id>`,
  `admin`). `/api/stream` checks access and relays them as Server-Sent Events, and pages call `router.refresh()`.

## Scripts

| Script             | What it does                                 |
| ------------------ | -------------------------------------------- |
| `pnpm dev`         | Next.js dev server                           |
| `pnpm worker`      | BullMQ worker (watch mode)                   |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate`  | Apply migrations                             |
| `pnpm db:seed`     | Reset and seed demo data                     |
| `pnpm db:studio`   | Drizzle Studio                               |
| `pnpm smoke`       | End-to-end order lifecycle check             |
| `pnpm typecheck`   | `tsc --noEmit`                               |

## Not production-ready yet

- Payments and payouts are simulated. Plug in Razorpay/Stripe at `placeOrder` and `settleSeller`.
- Open hours don't support stores that close after midnight.
- Product images are category emoji unless an `imageUrl` is set.
- The SSE route opens one Redis subscriber per connection. Fine for a demo; fan out from a shared subscriber at
  scale.
