CREATE TABLE "header_image_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"tone" text NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"prompt" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "body_images" text[] DEFAULT '{}';