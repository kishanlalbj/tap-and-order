import { sql } from "drizzle-orm";
import {
  boolean,
  geometry,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Points are stored as geometry(Point, 4326) with x = longitude, y = latitude.
// Distance checks cast to geography so radii are in metres.
const point = (name: string) => geometry(name, { type: "point", mode: "xy", srid: 4326 });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["customer", "seller", "rider", "admin"]);
export const approvalEnum = pgEnum("approval_status", ["PENDING", "APPROVED", "SUSPENDED"]);
export const requestStatusEnum = pgEnum("request_status", ["PENDING", "APPROVED", "REJECTED"]);
export const orderStatusEnum = pgEnum("order_status", [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
]);
export const sellerOrderStatusEnum = pgEnum("seller_order_status", [
  "PENDING",
  "ACCEPTED",
  "PACKED",
  "PICKED_UP",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
]);
export const orderItemStatusEnum = pgEnum("order_item_status", ["ACTIVE", "REASSIGNED", "REFUNDED"]);
export const riderStatusEnum = pgEnum("rider_status", ["OFFLINE", "ONLINE", "BUSY"]);
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "SEARCHING",
  "ASSIGNED",
  "PICKING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
]);
export const ledgerTypeEnum = pgEnum("ledger_type", ["SALE", "COMMISSION", "PAYOUT"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("customer"),
  createdAt: createdAt(),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  line: text("line").notNull(),
  location: point("location").notNull(),
  createdAt: createdAt(),
});

export const sellers = pgTable(
  "sellers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    storeName: text("store_name").notNull(),
    description: text("description"),
    addressLine: text("address_line").notNull(),
    location: point("location").notNull(),
    serviceRadiusM: integer("service_radius_m").notNull().default(5000),
    opensAt: time("opens_at").notNull().default("06:00"),
    closesAt: time("closes_at").notNull().default("23:59"),
    isAcceptingOrders: boolean("is_accepting_orders").notNull().default(true),
    status: approvalEnum("status").notNull().default("PENDING"),
    commissionBps: integer("commission_bps").notNull().default(1500),
    createdAt: createdAt(),
  },
  (t) => [index("sellers_location_idx").using("gist", t.location)],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull().default("🛒"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    brand: text("brand"),
    unit: text("unit").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("products_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const productRequests = pgTable("product_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => sellers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  brand: text("brand"),
  unit: text("unit").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  note: text("note"),
  status: requestStatusEnum("status").notNull().default("PENDING"),
  productId: uuid("product_id").references(() => products.id),
  createdAt: createdAt(),
});

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    pricePaise: integer("price_paise").notNull(),
    mrpPaise: integer("mrp_paise").notNull(),
    stock: integer("stock").notNull().default(0),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("offers_seller_product_idx").on(t.sellerId, t.productId),
    index("offers_product_price_idx").on(t.productId, t.pricePaise),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id),
    addressLabel: text("address_label").notNull(),
    addressLine: text("address_line").notNull(),
    deliveryLocation: point("delivery_location").notNull(),
    subtotalPaise: integer("subtotal_paise").notNull(),
    deliveryFeePaise: integer("delivery_fee_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    refundedPaise: integer("refunded_paise").notNull().default(0),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
    status: orderStatusEnum("status").notNull().default("PLACED"),
    createdAt: createdAt(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [index("orders_customer_idx").on(t.customerId, t.createdAt)],
);

export const sellerOrders = pgTable(
  "seller_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    status: sellerOrderStatusEnum("status").notNull().default("PENDING"),
    subtotalPaise: integer("subtotal_paise").notNull().default(0),
    commissionPaise: integer("commission_paise").notNull().default(0),
    acceptBy: timestamp("accept_by", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("seller_orders_order_idx").on(t.orderId),
    index("seller_orders_seller_idx").on(t.sellerId, t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    sellerOrderId: uuid("seller_order_id")
      .notNull()
      .references(() => sellerOrders.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    productName: text("product_name").notNull(),
    unit: text("unit").notNull(),
    qty: integer("qty").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    status: orderItemStatusEnum("status").notNull().default("ACTIVE"),
  },
  (t) => [index("order_items_seller_order_idx").on(t.sellerOrderId)],
);

export const riders = pgTable("riders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  vehicle: text("vehicle").notNull().default("bike"),
  approval: approvalEnum("approval").notNull().default("PENDING"),
  status: riderStatusEnum("status").notNull().default("OFFLINE"),
  lastLocation: point("last_location"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  riderId: uuid("rider_id").references(() => riders.id),
  status: deliveryStatusEnum("status").notNull().default("SEARCHING"),
  feePaise: integer("fee_paise").notNull().default(0),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    actor: roleEnum("actor"),
    message: text("message").notNull(),
    payload: jsonb("payload"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: serial("id").primaryKey(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => sellers.id),
    sellerOrderId: uuid("seller_order_id").references(() => sellerOrders.id),
    type: ledgerTypeEnum("type").notNull(),
    // Signed: SALE is positive, COMMISSION and PAYOUT are negative. Balance = SUM(amount).
    amountPaise: integer("amount_paise").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_seller_idx").on(t.sellerId, t.createdAt),
    uniqueIndex("ledger_seller_order_type_idx")
      .on(t.sellerOrderId, t.type)
      .where(sql`${t.sellerOrderId} is not null`),
  ],
);

export type User = typeof users.$inferSelect;
export type Seller = typeof sellers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type SellerOrder = typeof sellerOrders.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
