import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { postsTable } from "./posts";

export const socialSlotEnum = pgEnum("social_slot", ["morning", "lunchtime", "evening"]);
export const socialCaptionStatusEnum = pgEnum("social_caption_status", ["draft", "posted", "skipped"]);

export const socialCaptionsTable = pgTable("social_captions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  captionFacebook: text("caption_facebook"),
  captionInstagram: text("caption_instagram"),
  captionTwitter: text("caption_twitter"),
  hashtags: text("hashtags"),
  socialScore: integer("social_score"),
  recommendedSlot: socialSlotEnum("recommended_slot"),
  isSocialWorthy: boolean("is_social_worthy").notNull().default(true),
  status: socialCaptionStatusEnum("status").notNull().default("draft"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialCaptionSchema = createInsertSchema(socialCaptionsTable).omit({ id: true, generatedAt: true, updatedAt: true });
export const selectSocialCaptionSchema = createSelectSchema(socialCaptionsTable);

export type InsertSocialCaption = z.infer<typeof insertSocialCaptionSchema>;
export type SocialCaption = typeof socialCaptionsTable.$inferSelect;
