import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { postsTable } from "./posts";

export const platformEnum = pgEnum("platform", ["facebook", "instagram"]);
export const distributionStatusEnum = pgEnum("distribution_status", ["pending", "succeeded", "failed"]);

export const distributionLogTable = pgTable("distribution_log", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  platform: platformEnum("platform").notNull(),
  status: distributionStatusEnum("status").notNull().default("pending"),
  platformPostId: text("platform_post_id"),
  errorMessage: text("error_message"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  succeededAt: timestamp("succeeded_at", { withTimezone: true }),
});

export const insertDistributionLogSchema = createInsertSchema(distributionLogTable).omit({ id: true, attemptedAt: true });
export const selectDistributionLogSchema = createSelectSchema(distributionLogTable);

export type InsertDistributionLog = z.infer<typeof insertDistributionLogSchema>;
export type DistributionLog = typeof distributionLogTable.$inferSelect;
