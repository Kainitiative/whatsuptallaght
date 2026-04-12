import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rssFeedsTable = pgTable("rss_feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  checkIntervalMinutes: integer("check_interval_minutes").notNull().default(60),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // "events_only" = skip items that don't describe a real upcoming event with a date
  filterMode: text("filter_mode"),
  // "rss" (default) | "eventbrite" — controls which fetcher strategy is used
  feedType: text("feed_type").notNull().default("rss"),
});

export const rssItemsTable = pgTable("rss_items", {
  id: serial("id").primaryKey(),
  feedId: integer("feed_id").notNull().references(() => rssFeedsTable.id),
  guid: text("guid").notNull().unique(),
  title: text("title"),
  link: text("link"),
  content: text("content"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  isRelevant: boolean("is_relevant"),
  postId: integer("post_id"),
});

export const insertRssFeedSchema = createInsertSchema(rssFeedsTable).omit({ id: true, createdAt: true });
export const selectRssFeedSchema = createSelectSchema(rssFeedsTable);
export const insertRssItemSchema = createInsertSchema(rssItemsTable).omit({ id: true, fetchedAt: true });
export const selectRssItemSchema = createSelectSchema(rssItemsTable);

export type InsertRssFeed = z.infer<typeof insertRssFeedSchema>;
export type RssFeed = typeof rssFeedsTable.$inferSelect;
export type InsertRssItem = z.infer<typeof insertRssItemSchema>;
export type RssItem = typeof rssItemsTable.$inferSelect;
