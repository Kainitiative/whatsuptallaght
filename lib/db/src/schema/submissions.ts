import { pgTable, serial, text, integer, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contributorsTable } from "./contributors";

export const submissionSourceEnum = pgEnum("submission_source", ["whatsapp", "rss"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "processing",
  "processed",
  "rejected",
  "failed",
]);

export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  contributorId: integer("contributor_id").references(() => contributorsTable.id),
  source: submissionSourceEnum("source").notNull(),
  rawText: text("raw_text"),
  mediaUrls: jsonb("media_urls").$type<string[]>(),
  voiceTranscript: text("voice_transcript"),
  rssItemId: integer("rss_item_id"),
  status: submissionStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  safetyCheckPassed: text("safety_check_passed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSubmissionSchema = createSelectSchema(submissionsTable);

export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;
