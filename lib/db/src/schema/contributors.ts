import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contributorsTable = pgTable("contributors", {
  id: serial("id").primaryKey(),
  phoneHash: text("phone_hash").notNull().unique(),
  phoneNumber: text("phone_number"),
  displayName: text("display_name"),
  area: text("area"),
  bio: text("bio"),
  profileImageUrl: text("profile_image_url"),
  submissionCount: integer("submission_count").notNull().default(0),
  publishedCount: integer("published_count").notNull().default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  consentStatus: text("consent_status").notNull().default("pending"),
  consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contributorBansTable = pgTable("contributor_bans", {
  id: serial("id").primaryKey(),
  contributorId: integer("contributor_id").notNull().references(() => contributorsTable.id),
  reason: text("reason").notNull(),
  bannedAt: timestamp("banned_at", { withTimezone: true }).notNull().defaultNow(),
  bannedBy: integer("banned_by"),
});

export const insertContributorSchema = createInsertSchema(contributorsTable).omit({ id: true, firstSeenAt: true, updatedAt: true });
export const selectContributorSchema = createSelectSchema(contributorsTable);
export const insertContributorBanSchema = createInsertSchema(contributorBansTable).omit({ id: true, bannedAt: true });

export type InsertContributor = z.infer<typeof insertContributorSchema>;
export type Contributor = typeof contributorsTable.$inferSelect;
export type InsertContributorBan = z.infer<typeof insertContributorBanSchema>;
export type ContributorBan = typeof contributorBansTable.$inferSelect;
