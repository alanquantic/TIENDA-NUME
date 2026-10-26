CREATE TABLE "admin_two_factor" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"secret_encrypted" text NOT NULL,
	"enabled_at" timestamp with time zone,
	"recovery_code_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_step" integer,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
