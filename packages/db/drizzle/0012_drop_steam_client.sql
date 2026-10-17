-- Recorders run CS2 on gbe_fork only: no Steam client, accounts, sign-ins or Steam Guard codes.
ALTER TABLE "recorder" DROP CONSTRAINT "recorder_steamAccountId_unique";--> statement-breakpoint
ALTER TABLE "recorder" DROP CONSTRAINT "recorder_steam_account_id_recorder_steam_account_id_fk";--> statement-breakpoint
DROP TABLE "recorder_steam_account";--> statement-breakpoint
ALTER TABLE "recorder" ALTER COLUMN "state" SET DATA TYPE text;--> statement-breakpoint
-- The states that went away: the next heartbeat reports the real one.
UPDATE "recorder" SET "state" = 'idle' WHERE "state" IN ('signing_in', 'needs_guard_code', 'error');--> statement-breakpoint
DROP TYPE "public"."recorder_state";--> statement-breakpoint
CREATE TYPE "public"."recorder_state" AS ENUM('starting', 'idle', 'recording');--> statement-breakpoint
ALTER TABLE "recorder" ALTER COLUMN "state" SET DATA TYPE "public"."recorder_state" USING "state"::"public"."recorder_state";--> statement-breakpoint
ALTER TABLE "recorder" DROP COLUMN "steam_account_id";--> statement-breakpoint
ALTER TABLE "recorder" DROP COLUMN "guard_code";--> statement-breakpoint
ALTER TABLE "recorder" DROP COLUMN "signed_in_as";--> statement-breakpoint
ALTER TABLE "recorder" DROP COLUMN "steam_mode";
