ALTER TABLE "product_variants" ADD COLUMN "sale_price_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "sale_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "sale_ends_at" timestamp with time zone;