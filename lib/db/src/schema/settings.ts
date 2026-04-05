import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { adminUsersTable } from "./admin";

export const platformSettingsTable = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  encryptedValue: text("encrypted_value"),
  label: text("label").notNull(),
  description: text("description").notNull(),
  helpUrl: text("help_url"),
  category: text("category").notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  isRequired: boolean("is_required").notNull().default(false),
  isConfigured: boolean("is_configured").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  updatedBy: integer("updated_by").references(() => adminUsersTable.id),
});

export const insertPlatformSettingSchema = createInsertSchema(platformSettingsTable).omit({ id: true });
export const selectPlatformSettingSchema = createSelectSchema(platformSettingsTable);

export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;
export type PlatformSetting = typeof platformSettingsTable.$inferSelect;
