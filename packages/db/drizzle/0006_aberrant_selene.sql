CREATE TYPE "public"."recorder_state" AS ENUM('starting', 'idle', 'signing_in', 'needs_guard_code', 'recording', 'error');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "recorder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_hint" text NOT NULL,
	"steam_account_id" uuid,
	"paused" boolean DEFAULT false NOT NULL,
	"guard_code" text,
	"state" "recorder_state",
	"signed_in_as" text,
	"current_match_id" text,
	"last_error" text,
	"hostname" text,
	"gpu" text,
	"version" text,
	"clips_recorded" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recorder_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "recorder_steamAccountId_unique" UNIQUE("steam_account_id")
);
--> statement-breakpoint
CREATE TABLE "recorder_steam_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"shared_secret" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recorder_steam_account_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "recorder" ADD CONSTRAINT "recorder_steam_account_id_recorder_steam_account_id_fk" FOREIGN KEY ("steam_account_id") REFERENCES "public"."recorder_steam_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recorder" ADD CONSTRAINT "recorder_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;