CREATE TYPE "public"."match_mode" AS ENUM('premier', 'competitive', 'wingman', 'other');--> statement-breakpoint
ALTER TABLE "match" ADD COLUMN "mode" "match_mode";--> statement-breakpoint
ALTER TABLE "match_player" ADD COLUMN "rank" jsonb;