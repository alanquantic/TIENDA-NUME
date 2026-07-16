CREATE TYPE "public"."discount_scope" AS ENUM('cart', 'product');--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "scope" "discount_scope" DEFAULT 'cart' NOT NULL;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "max_per_order" integer;--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;