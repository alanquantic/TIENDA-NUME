DROP INDEX "ux_generated_reports_order_report";--> statement-breakpoint
ALTER TABLE "generated_reports" ADD COLUMN "order_item_id" uuid;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_generated_reports_order_item_report" ON "generated_reports" USING btree ("order_id","order_item_id","report_key");