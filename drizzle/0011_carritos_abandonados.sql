CREATE TABLE "abandoned_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_amount" numeric(10, 2),
	"currency" varchar(3),
	"status" text DEFAULT 'open' NOT NULL,
	"order_id" uuid,
	"notified_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"purchased_at" timestamp with time zone,
	"purchased_order_id" uuid,
	"purchased_amount" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abandoned_carts_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "abandoned_carts" ADD CONSTRAINT "abandoned_carts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abandoned_carts" ADD CONSTRAINT "abandoned_carts_purchased_order_id_orders_id_fk" FOREIGN KEY ("purchased_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_abandoned_carts_status_updated" ON "abandoned_carts" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_abandoned_carts_email" ON "abandoned_carts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_abandoned_carts_order" ON "abandoned_carts" USING btree ("order_id");