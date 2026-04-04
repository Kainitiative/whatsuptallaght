import { pgTable, serial, text, integer, boolean, date, time, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { postsTable } from "./posts";

export const eventStatusEnum = pgEnum("event_status", ["upcoming", "past", "cancelled"]);

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => postsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  eventDate: date("event_date").notNull(),
  eventTime: text("event_time"),
  endDate: date("end_date"),
  endTime: text("end_time"),
  location: text("location"),
  description: text("description"),
  organiser: text("organiser"),
  contactInfo: text("contact_info"),
  websiteUrl: text("website_url"),
  price: text("price"),
  status: eventStatusEnum("status").notNull().default("upcoming"),
  articleDeleted: boolean("article_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectEventSchema = createSelectSchema(eventsTable);

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
