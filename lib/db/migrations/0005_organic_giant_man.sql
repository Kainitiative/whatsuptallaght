CREATE TYPE "public"."business_status" AS ENUM('pending_review', 'active', 'inactive', 'rejected');--> statement-breakpoint
CREATE TABLE "entity_page_articles" (
	"entity_page_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_page_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_page_id" integer NOT NULL,
	"related_entity_page_id" integer NOT NULL,
	"relation_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"entity_type" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"short_description" text,
	"generated_body" text,
	"address" text,
	"directions" text,
	"website" text,
	"phone" text,
	"opening_hours" text,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"ai_context" jsonb,
	"seo_title" text,
	"meta_description" text,
	"trends_data" jsonb,
	"trends_summary" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"primary_category_id" integer,
	"use_as_article_header" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"source" text DEFAULT 'footer_widget' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner_name" text,
	"category" text NOT NULL,
	"subcategory" text,
	"description" text,
	"phone" text,
	"email" text,
	"website" text,
	"address" text,
	"area" text,
	"logo_url" text,
	"facebook_post_id" text,
	"facebook_post_text" text,
	"status" "business_status" DEFAULT 'pending_review' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"source_submission_id" integer,
	"contributor_id" integer,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "tone" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "weather_quip" text;--> statement-breakpoint
ALTER TABLE "rss_feeds" ADD COLUMN "keyword_filters" json;--> statement-breakpoint
ALTER TABLE "entity_page_articles" ADD CONSTRAINT "entity_page_articles_entity_page_id_entity_pages_id_fk" FOREIGN KEY ("entity_page_id") REFERENCES "public"."entity_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_page_articles" ADD CONSTRAINT "entity_page_articles_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_page_relations" ADD CONSTRAINT "entity_page_relations_entity_page_id_entity_pages_id_fk" FOREIGN KEY ("entity_page_id") REFERENCES "public"."entity_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_page_relations" ADD CONSTRAINT "entity_page_relations_related_entity_page_id_entity_pages_id_fk" FOREIGN KEY ("related_entity_page_id") REFERENCES "public"."entity_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_source_submission_id_submissions_id_fk" FOREIGN KEY ("source_submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributors"("id") ON DELETE no action ON UPDATE no action;