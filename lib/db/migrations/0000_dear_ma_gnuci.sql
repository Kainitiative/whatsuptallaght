CREATE TYPE "public"."submission_source" AS ENUM('whatsapp', 'rss');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'processing', 'processed', 'rejected', 'failed', 'awaiting_consent');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'held', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."distribution_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('facebook', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('upcoming', 'past', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."social_caption_status" AS ENUM('draft', 'posted', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."social_slot" AS ENUM('morning', 'lunchtime', 'evening');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('organisation', 'person', 'venue', 'team', 'event');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#C0392B' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "contributor_bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"contributor_id" integer NOT NULL,
	"reason" text NOT NULL,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"banned_by" integer
);
--> statement-breakpoint
CREATE TABLE "contributors" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_hash" text NOT NULL,
	"phone_number" text,
	"display_name" text,
	"area" text,
	"bio" text,
	"profile_image_url" text,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"published_count" integer DEFAULT 0 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"consent_status" text DEFAULT 'pending' NOT NULL,
	"consent_given_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributors_phone_hash_unique" UNIQUE("phone_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"created_by" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"contributor_id" integer,
	"source" "submission_source" NOT NULL,
	"raw_text" text,
	"media_urls" jsonb,
	"voice_transcript" text,
	"rss_item_id" integer,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"safety_check_passed" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_categories" (
	"post_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"body" text NOT NULL,
	"excerpt" text,
	"header_image_url" text,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"confidence_score" numeric(5, 2),
	"word_count" integer,
	"primary_category_id" integer,
	"source_submission_id" integer,
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"star_rating" integer,
	"image_prompt" text,
	"matched_entity_id" integer,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rss_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"check_interval_minutes" integer DEFAULT 60 NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rss_feeds_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "rss_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"guid" text NOT NULL,
	"title" text,
	"link" text,
	"content" text,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_relevant" boolean,
	"post_id" integer,
	CONSTRAINT "rss_items_guid_unique" UNIQUE("guid")
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "golden_examples" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"input_text" text NOT NULL,
	"output_text" text NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distribution_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"platform" "platform" NOT NULL,
	"status" "distribution_status" DEFAULT 'pending' NOT NULL,
	"platform_post_id" text,
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"encrypted_value" text,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"help_url" text,
	"category" text NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_configured" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone,
	"updated_by" integer,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ai_usage_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer,
	"job_id" integer,
	"model" text NOT NULL,
	"stage" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer,
	"title" text NOT NULL,
	"event_date" date NOT NULL,
	"event_time" text,
	"end_date" date,
	"end_time" text,
	"location" text,
	"description" text,
	"organiser" text,
	"contact_info" text,
	"website_url" text,
	"price" text,
	"status" "event_status" DEFAULT 'upcoming' NOT NULL,
	"article_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_captions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"caption_facebook" text,
	"caption_instagram" text,
	"caption_twitter" text,
	"hashtags" text,
	"social_score" integer,
	"recommended_slot" "social_slot",
	"is_social_worthy" boolean DEFAULT true NOT NULL,
	"status" "social_caption_status" DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"type" "entity_type" NOT NULL,
	"image_url" text,
	"website" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributor_bans" ADD CONSTRAINT "contributor_bans_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_source_submission_id_submissions_id_fk" FOREIGN KEY ("source_submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_matched_entity_id_entities_id_fk" FOREIGN KEY ("matched_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_items" ADD CONSTRAINT "rss_items_feed_id_rss_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."rss_feeds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_examples" ADD CONSTRAINT "golden_examples_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_examples" ADD CONSTRAINT "golden_examples_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_log" ADD CONSTRAINT "distribution_log_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_job_id_job_queue_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_article_id_posts_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_captions" ADD CONSTRAINT "social_captions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;