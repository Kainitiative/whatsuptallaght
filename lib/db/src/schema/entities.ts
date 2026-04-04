import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const entityTypeEnum = pgEnum("entity_type", [
  "organisation",
  "person",
  "venue",
  "team",
  "event",
]);

export const entitiesTable = pgTable("entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  aliases: text("aliases").array().notNull().default([]),
  type: entityTypeEnum("type").notNull(),
  imageUrl: text("image_url"),
  website: text("website"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEntitySchema = createInsertSchema(entitiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectEntitySchema = createSelectSchema(entitiesTable);

export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entitiesTable.$inferSelect;
