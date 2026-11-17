ALTER TABLE "match" ADD COLUMN "demo_stored_at" timestamp with time zone;--> statement-breakpoint
UPDATE "match" SET "demo_stored_at" = "created_at" WHERE "demo_key" IS NOT NULL;
