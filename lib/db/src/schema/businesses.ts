import { pgTable, serial, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { submissionsTable } from "./submissions";
import { contributorsTable } from "./contributors";

export const businessStatusEnum = pgEnum("business_status", [
  "pending_review",
  "active",
  "inactive",
  "rejected",
]);

export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ownerName: text("owner_name"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  description: text("description"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  address: text("address"),
  area: text("area"),
  logoUrl: text("logo_url"),
  facebookPostId: text("facebook_post_id"),
  facebookPostText: text("facebook_post_text"),
  status: businessStatusEnum("status").notNull().default("pending_review"),
  isFeatured: boolean("is_featured").notNull().default(false),
  isSponsored: boolean("is_sponsored").notNull().default(false),
  sourceSubmissionId: integer("source_submission_id").references(() => submissionsTable.id),
  contributorId: integer("contributor_id").references(() => contributorsTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectBusinessSchema = createSelectSchema(businessesTable);

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
