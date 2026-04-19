import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { postsTable } from "./posts";

export const entityPagesTable = pgTable("entity_pages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  entityType: text("entity_type").notNull(),
  aliases: text("aliases").array().notNull().default([]),
  shortDescription: text("short_description"),
  generatedBody: text("generated_body"),
  address: text("address"),
  directions: text("directions"),
  website: text("website"),
  phone: text("phone"),
  openingHours: text("opening_hours"),
  photos: text("photos").array().notNull().default([]),
  aiContext: jsonb("ai_context"),
  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  trendsData: jsonb("trends_data"),
  trendsSummary: text("trends_summary"),
  status: text("status").notNull().default("draft"),
  primaryCategoryId: integer("primary_category_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entityPageArticlesTable = pgTable("entity_page_articles", {
  entityPageId: integer("entity_page_id")
    .notNull()
    .references(() => entityPagesTable.id, { onDelete: "cascade" }),
  postId: integer("post_id")
    .notNull()
    .references(() => postsTable.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entityPageRelationsTable = pgTable("entity_page_relations", {
  id: serial("id").primaryKey(),
  entityPageId: integer("entity_page_id")
    .notNull()
    .references(() => entityPagesTable.id, { onDelete: "cascade" }),
  relatedEntityPageId: integer("related_entity_page_id")
    .notNull()
    .references(() => entityPagesTable.id, { onDelete: "cascade" }),
  relationLabel: text("relation_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEntityPageSchema = createInsertSchema(entityPagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectEntityPageSchema = createSelectSchema(entityPagesTable);

export type InsertEntityPage = z.infer<typeof insertEntityPageSchema>;
export type EntityPage = typeof entityPagesTable.$inferSelect;
export type EntityPageArticle = typeof entityPageArticlesTable.$inferSelect;
export type EntityPageRelation = typeof entityPageRelationsTable.$inferSelect;
