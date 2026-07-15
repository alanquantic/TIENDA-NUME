ALTER TABLE "orders" ADD COLUMN "requires_invoice" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_info" jsonb;