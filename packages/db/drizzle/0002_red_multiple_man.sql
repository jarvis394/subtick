CREATE TABLE "steam_profile" (
	"steam_id" text PRIMARY KEY NOT NULL,
	"persona_name" text NOT NULL,
	"avatar_url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
