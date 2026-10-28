CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resend_id" text,
	"kind" text NOT NULL,
	"order_id" uuid,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"open_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"last_clicked_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_messages_resend_id_unique" UNIQUE("resend_id")
);
--> statement-breakpoint
ALTER TABLE "generated_reports" ADD COLUMN "usage" jsonb;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_messages_order" ON "email_messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_sent" ON "email_messages" USING btree ("sent_at");