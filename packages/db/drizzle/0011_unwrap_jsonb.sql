-- jsonb used to be written as JSON strings ("{...}") by drizzle's jsonb() under Bun's SQL driver.
UPDATE "match" SET "parties" = ("parties" #>> '{}')::jsonb WHERE jsonb_typeof("parties") = 'string';--> statement-breakpoint
UPDATE "match_player" SET "stats" = ("stats" #>> '{}')::jsonb WHERE jsonb_typeof("stats") = 'string';--> statement-breakpoint
UPDATE "match_player" SET "rank" = ("rank" #>> '{}')::jsonb WHERE jsonb_typeof("rank") = 'string';--> statement-breakpoint
UPDATE "highlight" SET "segments" = ("segments" #>> '{}')::jsonb WHERE jsonb_typeof("segments") = 'string';--> statement-breakpoint
UPDATE "highlight" SET "kills" = ("kills" #>> '{}')::jsonb WHERE jsonb_typeof("kills") = 'string';--> statement-breakpoint
UPDATE "highlight" SET "clutch" = ("clutch" #>> '{}')::jsonb WHERE jsonb_typeof("clutch") = 'string';
