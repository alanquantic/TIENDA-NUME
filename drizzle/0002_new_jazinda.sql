CREATE TABLE "generated_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"report_key" text NOT NULL,
	"product_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"url" text,
	"error" text,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_generated_reports_order_report" ON "generated_reports" USING btree ("order_id","report_key");--> statement-breakpoint
CREATE INDEX "idx_generated_reports_status" ON "generated_reports" USING btree ("status");