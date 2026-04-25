import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, date, numeric, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  mustChangePin: boolean("must_change_pin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const families = pgTable("families", {
  id: serial("id").primaryKey(),
  familyName: text("family_name").notNull(),
  studentNames: text("student_names").notNull(),
  classDayTime: text("class_day_time").notNull(),
  billingType: text("billing_type").notNull().default("attendance"), // "attendance" | "monthly"
  documentType: text("document_type").notNull().default("invoice"), // "invoice" | "receipt"
  ratePerClass: numeric("rate_per_class", { precision: 10, scale: 2 }),
  monthlyTotal: numeric("monthly_total", { precision: 10, scale: 2 }),
  emailAddresses: text("email_addresses").array().notNull().default([]),
  brokerEmails: text("broker_emails").array().notNull().default([]),
  notes: text("notes"),
  reminderFrequency: text("reminder_frequency").notNull().default("none"), // "monthly" | "biweekly" | "weekly" | "none"
  reminderDayOfMonth: integer("reminder_day_of_month"), // 1-28 for monthly
  reminderDayOfWeek: integer("reminder_day_of_week"), // 0=Sun, 1=Mon, ..., 6=Sat
  reminderAnchorDate: date("reminder_anchor_date"), // reference date for biweekly
  reminderTargetOffset: text("reminder_target_offset").notNull().default("previous"), // "previous" | "current" | "next"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const billingPeriods = pgTable("billing_periods", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  periodLabel: text("period_label").notNull(),
  invoiceCreated: boolean("invoice_created").notNull().default(false),
  invoiceSent: boolean("invoice_sent").notNull().default(false),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  notes: text("notes"),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  invoiceType: text("invoice_type").notNull().default("attendance"),
  documentType: text("document_type").notNull().default("invoice"),
  studentName: text("student_name").notNull(),
  classDayTime: text("class_day_time").notNull(),
  ratePerClass: numeric("rate_per_class", { precision: 10, scale: 2 }).notNull(),
  attendanceDates: text("attendance_dates").array().notNull(),
  monthlyMonth: text("monthly_month"),
  monthlyYear: text("monthly_year"),
  monthlyDay: text("monthly_day"),
  monthlyTotal: numeric("monthly_total", { precision: 10, scale: 2 }),
  comments: text("comments"),
  familyId: integer("family_id").references(() => families.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, passwordHash: true, createdAt: true, updatedAt: true, mustChangePin: true })
  .extend({ password: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits").optional() });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = typeof users.$inferSelect;

export const insertFamilySchema = createInsertSchema(families).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBillingPeriodSchema = createInsertSchema(billingPeriods).omit({ id: true, createdAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;
export type InsertBillingPeriod = z.infer<typeof insertBillingPeriodSchema>;
export type BillingPeriod = typeof billingPeriods.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
