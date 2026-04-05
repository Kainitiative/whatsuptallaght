import { pgTable, serial, text, integer, boolean, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { submissionsTable } from "./submissions";
import { entitiesTable } from "./entities";

export const postStatusEnum = pgEnum("post_status", ["draft", "held", "published", "rejected"]);

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  body: text("body").notNull(),
  excerpt: text("excerpt"),
  headerImageUrl: text("header_image_url"),
  status: postStatusEnum("status").notNull().default("draft"),
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
  wordCount: integer("word_count"),
  primaryCategoryId: integer("primary_category_id").references(() => categoriesTable.id),
  sourceSubmissionId: integer("source_submission_id").references(() => submissionsTable.id),
  isSponsored: boolean("is_sponsored").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  starRating: integer("star_rating"),
  imagePrompt: text("image_prompt"),
  bodyImages: text("body_images").array().default([]),
  matchedEntityId: integer("matched_entity_id").references(() => entitiesTable.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const postCategoriesTable = pgTable("post_categories", {
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectPostSchema = createSelectSchema(postsTable);
export const insertPostCategorySchema = createInsertSchema(postCategoriesTable);

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
export type PostCategory = typeof postCategoriesTable.$inferSelect;
