import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { adminUsersTable } from "./admin";

export const goldenExamplesTable = pgTable("golden_examples", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  inputText: text("input_text").notNull(),
  outputText: text("output_text").notNull(),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => adminUsersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGoldenExampleSchema = createInsertSchema(goldenExamplesTable).omit({ id: true, createdAt: true });
export const selectGoldenExampleSchema = createSelectSchema(goldenExamplesTable);

export type InsertGoldenExample = z.infer<typeof insertGoldenExampleSchema>;
export type GoldenExample = typeof goldenExamplesTable.$inferSelect;
