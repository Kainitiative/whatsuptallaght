import { pgTable, serial, text, integer, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobStatusEnum = pgEnum("job_status", ["pending", "processing", "done", "failed"]);

export const jobQueueTable = pgTable("job_queue", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  status: jobStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobQueueTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectJobSchema = createSelectSchema(jobQueueTable);

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobQueueTable.$inferSelect;
