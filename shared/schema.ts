import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, date, numeric, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  classDayTime: text("class_day_time").notNull(),
  ratePerClass: numeric("rate_per_class", { precision: 10, scale: 2 }).notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceType: text("invoice_type").notNull().default("attendance"),
  studentId: integer("student_id").notNull(),
  studentName: text("student_name").notNull(),
  classDayTime: text("class_day_time").notNull(),
  ratePerClass: numeric("rate_per_class", { precision: 10, scale: 2 }).notNull(),
  attendanceDates: text("attendance_dates").array().notNull(),
  monthlyMonth: text("monthly_month"),
  monthlyYear: text("monthly_year"),
  monthlyDay: text("monthly_day"),
  monthlyTotal: numeric("monthly_total", { precision: 10, scale: 2 }),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
