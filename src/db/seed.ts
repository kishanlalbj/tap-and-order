import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, schema } from "./index";
import { BENGALURU_AREAS, toPoint } from "@/lib/geo";
import { redis } from "@/lib/redis";

const PASSWORD = "password123";

const CATEGORIES = [
  { name: "Fruits & Vegetables", slug: "fruits-vegetables", icon: "🥦" },
  { name: "Dairy, Bread & Eggs", slug: "dairy-bread-eggs", icon: "🥛" },
  { name: "Snacks & Munchies", slug: "snacks", icon: "🍿" },
  { name: "Cold Drinks & Juices", slug: "beverages", icon: "🧃" },
  { name: "Atta, Rice & Dal", slug: "staples", icon: "🌾" },
  { name: "Instant & Frozen", slug: "instant-food", icon: "🍜" },
  { name: "Personal Care", slug: "personal-care", icon: "🧴" },
  { name: "Cleaning Essentials", slug: "household", icon: "🧽" },
];

// [name, brand, unit, base price in rupees]
const PRODUCTS: Record<string, [string, string | null, string, number][]> = {
  "fruits-vegetables": [
    ["Banana Robusta", null, "6 pcs", 45],
    ["Onion", null, "1 kg", 38],
    ["Tomato Hybrid", null, "500 g", 24],
    ["Potato", null, "1 kg", 35],
    ["Apple Shimla", null, "4 pcs", 140],
    ["Coriander Leaves", null, "100 g", 12],
    ["Green Chilli", null, "100 g", 10],
    ["Carrot Ooty", null, "500 g", 42],
  ],
  "dairy-bread-eggs": [
    ["Toned Milk", "Nandini", "500 ml", 24],
    ["Taaza Toned Milk", "Amul", "500 ml", 28],
    ["Curd", "Nandini", "500 g", 30],
    ["Salted Butter", "Amul", "100 g", 58],
    ["Brown Bread", "Modern", "400 g", 50],
    ["White Eggs", null, "6 pcs", 48],
    ["Paneer", "Milky Mist", "200 g", 95],
    ["Cheese Slices", "Amul", "200 g", 140],
  ],
  snacks: [
    ["Classic Salted Chips", "Lay's", "52 g", 20],
    ["Aloo Bhujia", "Haldiram's", "200 g", 55],
    ["Dark Fantasy Choco Fills", "Sunfeast", "75 g", 40],
    ["Good Day Cashew Cookies", "Britannia", "200 g", 45],
    ["Dairy Milk Silk", "Cadbury", "60 g", 85],
    ["Kurkure Masala Munch", "Kurkure", "90 g", 20],
    ["Marie Gold", "Britannia", "250 g", 35],
    ["Roasted Peanuts", "Haldiram's", "200 g", 60],
  ],
  beverages: [
    ["Coca-Cola", "Coca-Cola", "750 ml", 40],
    ["Thums Up", "Thums Up", "750 ml", 40],
    ["Real Mixed Fruit Juice", "Real", "1 L", 120],
    ["Packaged Drinking Water", "Bisleri", "1 L", 20],
    ["Red Bull Energy Drink", "Red Bull", "250 ml", 125],
    ["Tender Coconut Water", "Paper Boat", "200 ml", 50],
    ["Cold Coffee", "Starbucks", "180 ml", 99],
  ],
  staples: [
    ["Whole Wheat Atta", "Aashirvaad", "5 kg", 260],
    ["Basmati Rice", "India Gate", "1 kg", 145],
    ["Toor Dal", "Tata Sampann", "1 kg", 180],
    ["Sunflower Oil", "Fortune", "1 L", 155],
    ["Iodised Salt", "Tata", "1 kg", 28],
    ["Sugar", "Madhur", "1 kg", 52],
    ["Moong Dal", "Tata Sampann", "500 g", 82],
  ],
  "instant-food": [
    ["Masala Noodles", "Maggi", "4 x 70 g", 56],
    ["Cup Noodles Mazedaar Masala", "Yippee", "70 g", 50],
    ["Frozen Green Peas", "Safal", "500 g", 85],
    ["Aloo Tikki", "McCain", "400 g", 110],
    ["Poha Mix", "MTR", "180 g", 65],
    ["Instant Oats", "Quaker", "500 g", 99],
    ["Tomato Ketchup", "Kissan", "850 g", 115],
  ],
  "personal-care": [
    ["Toothpaste Strong Teeth", "Colgate", "200 g", 110],
    ["Bathing Soap", "Dove", "3 x 100 g", 165],
    ["Shampoo Anti-Dandruff", "Head & Shoulders", "180 ml", 199],
    ["Hand Wash Refill", "Dettol", "750 ml", 99],
    ["Face Wash", "Himalaya", "100 ml", 150],
    ["Sanitary Pads XL", "Whisper", "15 pcs", 210],
    ["Shaving Foam", "Gillette", "200 g", 220],
  ],
  household: [
    ["Dishwash Liquid", "Vim", "500 ml", 115],
    ["Detergent Powder", "Surf Excel", "1 kg", 140],
    ["Floor Cleaner", "Lizol", "975 ml", 210],
    ["Toilet Cleaner", "Harpic", "500 ml", 98],
    ["Garbage Bags Medium", "Ezee", "30 pcs", 95],
    ["Scrub Pad", "Scotch-Brite", "3 pcs", 60],
    ["Kitchen Towel", "Origami", "2 rolls", 120],
  ],
};

const SELLERS = [
  { email: "freshmart@tap.dev", name: "Ravi Kumar", store: "FreshMart Indiranagar", area: "Indiranagar", radius: 5000, status: "APPROVED", priceBias: 1.02, coverage: 0.85 },
  { email: "dailyneeds@tap.dev", name: "Priya Shah", store: "Daily Needs Koramangala", area: "Koramangala", radius: 6000, status: "APPROVED", priceBias: 0.97, coverage: 0.8 },
  { email: "quickbasket@tap.dev", name: "Arjun Rao", store: "QuickBasket HSR", area: "HSR Layout", radius: 5000, status: "APPROVED", priceBias: 0.99, coverage: 0.75 },
  { email: "jayanagarstores@tap.dev", name: "Meena Iyer", store: "Jayanagar Super Stores", area: "Jayanagar", radius: 5000, status: "APPROVED", priceBias: 1.0, coverage: 0.7 },
  { email: "whitefieldmart@tap.dev", name: "Sameer Khan", store: "Whitefield Mart", area: "Whitefield", radius: 5000, status: "PENDING", priceBias: 1.0, coverage: 0.6 },
] as const;

const RIDERS = [
  { email: "rider1@tap.dev", name: "Manju", vehicle: "bike" },
  { email: "rider2@tap.dev", name: "Suresh", vehicle: "scooter" },
  { email: "rider3@tap.dev", name: "Karthik", vehicle: "bike" },
];

// Deterministic PRNG so every seed produces the same prices.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  console.log("Resetting data…");
  await db.execute(sql`
    truncate ledger_entries, order_events, deliveries, order_items, seller_orders, orders,
             offers, product_requests, products, categories, riders, sellers, addresses, users
    restart identity cascade
  `);
  await redis.flushdb();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const area = (label: string) => BENGALURU_AREAS.find((a) => a.label === label)!;

  await db.insert(schema.users).values([
    { name: "Platform Admin", email: "admin@tap.dev", passwordHash, role: "admin" },
    { name: "Asha Customer", email: "asha@tap.dev", passwordHash, role: "customer", phone: "9800000001" },
    { name: "Vikram Customer", email: "vikram@tap.dev", passwordHash, role: "customer", phone: "9800000002" },
  ]);

  const categories = await db
    .insert(schema.categories)
    .values(CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
    .returning();

  const products = await db
    .insert(schema.products)
    .values(
      categories.flatMap((c) =>
        PRODUCTS[c.slug].map(([name, brand, unit]) => ({ name, brand, unit, categoryId: c.id })),
      ),
    )
    .returning();
  const basePrice = new Map(
    Object.values(PRODUCTS)
      .flat()
      .map(([name, , , price]) => [name, price]),
  );

  const rand = mulberry32(42);
  for (const s of SELLERS) {
    const [user] = await db
      .insert(schema.users)
      .values({ name: s.name, email: s.email, passwordHash, role: "seller" })
      .returning();
    const loc = area(s.area);
    const [seller] = await db
      .insert(schema.sellers)
      .values({
        userId: user.id,
        storeName: s.store,
        description: `Your neighbourhood store in ${s.area}`,
        addressLine: `12, Main Road, ${s.area}, Bengaluru`,
        location: toPoint(loc),
        serviceRadiusM: s.radius,
        opensAt: "00:00",
        closesAt: "23:59",
        status: s.status,
        commissionBps: Number(process.env.COMMISSION_DEFAULT_BPS ?? 1500),
      })
      .returning();

    const offers = products
      .filter(() => rand() < s.coverage)
      .map((p) => {
        const base = basePrice.get(p.name)!;
        const mrp = Math.round(base * 1.1);
        // Each store prices within roughly -8%..+6% of base, nudged by its overall bias.
        const price = Math.min(mrp, Math.max(1, Math.round(base * s.priceBias * (0.92 + rand() * 0.14))));
        return {
          sellerId: seller.id,
          productId: p.id,
          pricePaise: price * 100,
          mrpPaise: mrp * 100,
          stock: 5 + Math.floor(rand() * 55),
        };
      });
    await db.insert(schema.offers).values(offers);
    console.log(`  ${s.store}: ${offers.length} offers (${s.status})`);
  }

  for (const r of RIDERS) {
    const [user] = await db
      .insert(schema.users)
      .values({ name: r.name, email: r.email, passwordHash, role: "rider", phone: "9900000000" })
      .returning();
    await db.insert(schema.riders).values({
      userId: user.id,
      vehicle: r.vehicle,
      approval: "APPROVED",
      lastLocation: toPoint(area("Koramangala")),
    });
  }

  console.log(`\nSeeded ${categories.length} categories, ${products.length} products.`);
  console.log(`All accounts use password "${PASSWORD}":`);
  console.log("  admin@tap.dev · asha@tap.dev · vikram@tap.dev");
  console.log(`  sellers: ${SELLERS.map((s) => s.email).join(", ")}`);
  console.log(`  riders: ${RIDERS.map((r) => r.email).join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
