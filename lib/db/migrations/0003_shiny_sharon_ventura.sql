CREATE TYPE "public"."competition_status" AS ENUM('active', 'closed', 'drawn');--> statement-breakpoint
CREATE TABLE "competition_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"facebook_user_id" text NOT NULL,
	"facebook_user_name" text NOT NULL,
	"comment_id" text NOT NULL,
	"comment_text" text,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competition_entries_comment_id_unique" UNIQUE("comment_id")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"prize" text NOT NULL,
	"facebook_post_id" text NOT NULL,
	"facebook_post_url" text,
	"status" "competition_status" DEFAULT 'active' NOT NULL,
	"closing_date" timestamp with time zone,
	"winner_entry_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;