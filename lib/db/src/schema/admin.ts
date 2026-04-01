import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const adminInvitationsTable = pgTable("admin_invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  createdBy: integer("created_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({ id: true, createdAt: true });
export const selectAdminUserSchema = createSelectSchema(adminUsersTable);
export const insertAdminInvitationSchema = createInsertSchema(adminInvitationsTable).omit({ id: true, createdAt: true });
export const selectAdminInvitationSchema = createSelectSchema(adminInvitationsTable);

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsersTable.$inferSelect;
export type InsertAdminInvitation = z.infer<typeof insertAdminInvitationSchema>;
export type AdminInvitation = typeof adminInvitationsTable.$inferSelect;
