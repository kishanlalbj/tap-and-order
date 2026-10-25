CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('SEARCHING', 'ASSIGNED', 'PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('SALE', 'COMMISSION', 'PAYOUT');--> statement-breakpoint
CREATE TYPE "public"."order_item_status" AS ENUM('ACTIVE', 'REASSIGNED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."rider_status" AS ENUM('OFFLINE', 'ONLINE', 'BUSY');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('customer', 'seller', 'rider', 'admin');--> statement-breakpoint
CREATE TYPE "public"."seller_order_status" AS ENUM('PENDING', 'ACCEPTED', 'PACKED', 'PICKED_UP', 'DELIVERED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"line" text NOT NULL,
	"location" geometry(point) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text DEFAULT '🛒' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"rider_id" uuid,
	"status" "delivery_status" DEFAULT 'SEARCHING' NOT NULL,
	"fee_paise" integer DEFAULT 0 NOT NULL,
	"assigned_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" uuid NOT NULL,
	"seller_order_id" uuid,
	"type" "ledger_type" NOT NULL,
	"amount_paise" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price_paise" integer NOT NULL,
	"mrp_paise" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"actor" "role",
	"message" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_order_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"status" "order_item_status" DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_label" text NOT NULL,
	"address_line" text NOT NULL,
	"delivery_location" geometry(point) NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"delivery_fee_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"refunded_paise" integer DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"status" "order_status" DEFAULT 'PLACED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "product_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"unit" text NOT NULL,
	"category_id" integer NOT NULL,
	"note" text,
	"status" "request_status" DEFAULT 'PENDING' NOT NULL,
	"product_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"unit" text NOT NULL,
	"description" text,
	"image_url" text,
	"category_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vehicle" text DEFAULT 'bike' NOT NULL,
	"approval" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"status" "rider_status" DEFAULT 'OFFLINE' NOT NULL,
	"last_location" geometry(point),
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "riders_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "seller_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"status" "seller_order_status" DEFAULT 'PENDING' NOT NULL,
	"subtotal_paise" integer DEFAULT 0 NOT NULL,
	"commission_paise" integer DEFAULT 0 NOT NULL,
	"accept_by" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"store_name" text NOT NULL,
	"description" text,
	"address_line" text NOT NULL,
	"location" geometry(point) NOT NULL,
	"service_radius_m" integer DEFAULT 5000 NOT NULL,
	"opens_at" time DEFAULT '06:00' NOT NULL,
	"closes_at" time DEFAULT '23:59' NOT NULL,
	"is_accepting_orders" boolean DEFAULT true NOT NULL,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"commission_bps" integer DEFAULT 1500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'customer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_order_id_seller_orders_id_fk" FOREIGN KEY ("seller_order_id") REFERENCES "public"."seller_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_seller_idx" ON "ledger_entries" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_seller_order_type_idx" ON "ledger_entries" USING btree ("seller_order_id","type") WHERE "ledger_entries"."seller_order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "offers_seller_product_idx" ON "offers" USING btree ("seller_id","product_id");--> statement-breakpoint
CREATE INDEX "offers_product_price_idx" ON "offers" USING btree ("product_id","price_paise");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_seller_order_idx" ON "order_items" USING btree ("seller_order_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "seller_orders_order_idx" ON "seller_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "seller_orders_seller_idx" ON "seller_orders" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "sellers_location_idx" ON "sellers" USING gist ("location");