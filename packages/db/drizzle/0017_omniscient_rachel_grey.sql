ALTER TABLE "recorder" ADD COLUMN "fail_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recorder" ADD COLUMN "hlae_version" text;--> statement-breakpoint
ALTER TABLE "recorder" ADD COLUMN "hlae_pov_release" text;--> statement-breakpoint
ALTER TABLE "recorder" ADD COLUMN "hlae_target" jsonb;