import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const competitionStatusEnum = pgEnum("competition_status", ["active", "closed", "drawn"]);

export const competitionsTable = pgTable("competitions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  prize: text("prize").notNull(),
  facebookPostId: text("facebook_post_id").notNull(),
  facebookPostUrl: text("facebook_post_url"),
  status: competitionStatusEnum("status").notNull().default("active"),
  closingDate: timestamp("closing_date", { withTimezone: true }),
  winnerEntryId: integer("winner_entry_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const competitionEntriesTable = pgTable("competition_entries", {
  id: serial("id").primaryKey(),
  competitionId: integer("competition_id").notNull().references(() => competitionsTable.id, { onDelete: "cascade" }),
  facebookUserId: text("facebook_user_id").notNull(),
  facebookUserName: text("facebook_user_name").notNull(),
  commentId: text("comment_id").notNull().unique(),
  commentText: text("comment_text"),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompetitionSchema = createInsertSchema(competitionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCompetitionSchema = createSelectSchema(competitionsTable);
export const insertCompetitionEntrySchema = createInsertSchema(competitionEntriesTable).omit({ id: true, enteredAt: true });
export const selectCompetitionEntrySchema = createSelectSchema(competitionEntriesTable);

export type Competition = typeof competitionsTable.$inferSelect;
export type CompetitionEntry = typeof competitionEntriesTable.$inferSelect;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type InsertCompetitionEntry = z.infer<typeof insertCompetitionEntrySchema>;
