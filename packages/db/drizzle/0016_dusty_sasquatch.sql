ALTER TABLE "steam_profile" ADD COLUMN "vanity" text;--> statement-breakpoint
CREATE INDEX "steam_profile_vanity_lower_idx" ON "steam_profile" USING btree (lower("vanity"));--> statement-breakpoint
-- Refetch every cached profile so existing players get their vanity URL.
UPDATE "steam_profile" SET "fetched_at" = 'epoch';
