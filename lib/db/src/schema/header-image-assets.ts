import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const headerImageAssetsTable = pgTable("header_image_assets", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  tone: text("tone").notNull(),
  keywords: text("keywords").array().notNull().default([]),
  prompt: text("prompt").notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHeaderImageAssetSchema = createInsertSchema(headerImageAssetsTable).omit({ id: true, createdAt: true });
export const selectHeaderImageAssetSchema = createSelectSchema(headerImageAssetsTable);

export type InsertHeaderImageAsset = z.infer<typeof insertHeaderImageAssetSchema>;
export type HeaderImageAsset = typeof headerImageAssetsTable.$inferSelect;
