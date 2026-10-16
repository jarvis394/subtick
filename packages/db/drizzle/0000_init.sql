CREATE TYPE "public"."sync_state" AS ENUM('idle', 'syncing', 'needs_auth', 'error');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('queued', 'resolving', 'downloading', 'parsing', 'recording', 'ready', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('T', 'CT');--> statement-breakpoint
CREATE TYPE "public"."highlight_kind" AS ENUM('ace', 'clutch', 'quad', 'triple', 'collateral', 'double', 'special', 'single');--> statement-breakpoint
CREATE TYPE "public"."highlight_status" AS ENUM('candidate', 'queued', 'recorded', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steam_link" (
	"steam_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"persona_name" text NOT NULL,
	"avatar_url" text,
	"auth_code" text,
	"last_share_code" text,
	"sync_state" "sync_state" DEFAULT 'idle' NOT NULL,
	"last_error" text,
	"next_sync_at" timestamp,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kill" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"round" smallint NOT NULL,
	"tick" integer NOT NULL,
	"attacker_steam_id" text,
	"victim_steam_id" text NOT NULL,
	"assister_steam_id" text,
	"weapon" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"distance" real
);
--> statement-breakpoint
CREATE TABLE "match" (
	"id" text PRIMARY KEY NOT NULL,
	"share_code" text,
	"demo_url" text,
	"status" "match_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"map" text,
	"server_name" text,
	"tickrate" smallint,
	"duration_ticks" integer,
	"rounds_played" smallint,
	"score_started_ct" smallint,
	"score_started_t" smallint,
	"demo_key" text,
	"demo_expires_at" timestamp,
	"parser_version" smallint,
	"played_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "match_shareCode_unique" UNIQUE("share_code")
);
--> statement-breakpoint
CREATE TABLE "match_player" (
	"match_id" text NOT NULL,
	"steam_id" text NOT NULL,
	"name" text NOT NULL,
	"starting_side" "side" NOT NULL,
	"stats" jsonb NOT NULL,
	CONSTRAINT "match_player_match_id_steam_id_pk" PRIMARY KEY("match_id","steam_id")
);
--> statement-breakpoint
CREATE TABLE "round" (
	"match_id" text NOT NULL,
	"number" smallint NOT NULL,
	"winner" "side" NOT NULL,
	"reason" text NOT NULL,
	"start_tick" integer NOT NULL,
	"freeze_end_tick" integer NOT NULL,
	"end_tick" integer NOT NULL,
	"ct_equip_value" integer NOT NULL,
	"t_equip_value" integer NOT NULL,
	CONSTRAINT "round_match_id_number_pk" PRIMARY KEY("match_id","number")
);
--> statement-breakpoint
CREATE TABLE "user_match" (
	"user_id" text NOT NULL,
	"match_id" text NOT NULL,
	"steam_id" text NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_match_user_id_match_id_pk" PRIMARY KEY("user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "clip" (
	"highlight_id" uuid PRIMARY KEY NOT NULL,
	"video_key" text NOT NULL,
	"thumbnail_key" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"width" smallint NOT NULL,
	"height" smallint NOT NULL,
	"recorder_version" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "highlight" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" text NOT NULL,
	"steam_id" text NOT NULL,
	"round" smallint NOT NULL,
	"kind" "highlight_kind" NOT NULL,
	"title" text NOT NULL,
	"score" real NOT NULL,
	"start_tick" integer NOT NULL,
	"end_tick" integer NOT NULL,
	"kills" jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"clutch" jsonb,
	"status" "highlight_status" DEFAULT 'candidate' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steam_link" ADD CONSTRAINT "steam_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kill" ADD CONSTRAINT "kill_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player" ADD CONSTRAINT "match_player_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_match" ADD CONSTRAINT "user_match_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_match" ADD CONSTRAINT "user_match_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip" ADD CONSTRAINT "clip_highlight_id_highlight_id_fk" FOREIGN KEY ("highlight_id") REFERENCES "public"."highlight"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlight" ADD CONSTRAINT "highlight_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "steam_link_user_id_index" ON "steam_link" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "steam_link_next_sync_at_index" ON "steam_link" USING btree ("next_sync_at");--> statement-breakpoint
CREATE INDEX "kill_match_id_round_index" ON "kill" USING btree ("match_id","round");--> statement-breakpoint
CREATE INDEX "match_status_index" ON "match" USING btree ("status");--> statement-breakpoint
CREATE INDEX "match_player_steam_id_index" ON "match_player" USING btree ("steam_id");--> statement-breakpoint
CREATE INDEX "user_match_match_id_index" ON "user_match" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "highlight_match_id_steam_id_index" ON "highlight" USING btree ("match_id","steam_id");--> statement-breakpoint
CREATE INDEX "highlight_steam_id_score_index" ON "highlight" USING btree ("steam_id","score");