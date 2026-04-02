import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { submissionsTable } from "./submissions";
import { jobQueueTable } from "./queue";

export const aiUsageLogTable = pgTable("ai_usage_log", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").references(() => submissionsTable.id),
  jobId: integer("job_id").references(() => jobQueueTable.id),
  model: text("model").notNull(),
  stage: text("stage").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiUsageSchema = createInsertSchema(aiUsageLogTable).omit({ id: true, createdAt: true });
export const selectAiUsageSchema = createSelectSchema(aiUsageLogTable);

export type InsertAiUsage = z.infer<typeof insertAiUsageSchema>;
export type AiUsageLog = typeof aiUsageLogTable.$inferSelect;
