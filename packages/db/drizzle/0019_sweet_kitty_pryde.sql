ALTER TABLE "user" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
-- Everyone who signed up before invite-only stays in.
UPDATE "user" SET "approved_at" = "created_at";--> statement-breakpoint
-- Email sign-in now requires a verified address; accounts from before had no way to verify one.
UPDATE "user" SET "email_verified" = true WHERE "email" NOT LIKE '%@steam.invalid';
