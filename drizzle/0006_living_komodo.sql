CREATE TABLE "payment_settings" (
	"provider" "payment_provider" PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"mode" varchar(16) DEFAULT 'sandbox' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
