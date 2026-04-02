import {
  type Invoice, type InsertInvoice, invoices,
  type Family, type InsertFamily, families,
  type BillingPeriod, type InsertBillingPeriod, billingPeriods,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, and, sql } from "drizzle-orm";

export interface IStorage {
  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  deleteInvoice(id: number): Promise<boolean>;

  // Families
  getFamilies(): Promise<Family[]>;
  getFamily(id: number): Promise<Family | undefined>;
  createFamily(family: InsertFamily): Promise<Family>;
  updateFamily(id: number, family: Partial<InsertFamily>): Promise<Family | undefined>;
  deleteFamily(id: number): Promise<boolean>;

  // Billing Periods
  getBillingPeriods(familyId: number): Promise<BillingPeriod[]>;
  getAllPendingPeriods(): Promise<(BillingPeriod & { familyName: string; emailAddresses: string[]; billingType: string; ratePerClass: string | null; monthlyTotal: string | null; studentNames: string; classDayTime: string })[]>;
  createBillingPeriod(period: InsertBillingPeriod): Promise<BillingPeriod>;
  updateBillingPeriod(id: number, updates: Partial<InsertBillingPeriod>): Promise<BillingPeriod | undefined>;
  generateUpcomingPeriods(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // --- Invoices ---
  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(invoice).returning();
    return created;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id)).returning();
    return result.length > 0;
  }

  // --- Families ---
  async getFamilies(): Promise<Family[]> {
    return await db.select().from(families).orderBy(families.familyName);
  }

  async getFamily(id: number): Promise<Family | undefined> {
    const [family] = await db.select().from(families).where(eq(families.id, id));
    return family;
  }

  async createFamily(family: InsertFamily): Promise<Family> {
    const [created] = await db.insert(families).values(family).returning();
    return created;
  }

  async updateFamily(id: number, updates: Partial<InsertFamily>): Promise<Family | undefined> {
    const [updated] = await db
      .update(families)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(families.id, id))
      .returning();
    return updated;
  }

  async deleteFamily(id: number): Promise<boolean> {
    const result = await db.delete(families).where(eq(families.id, id)).returning();
    return result.length > 0;
  }

  // --- Billing Periods ---
  async getBillingPeriods(familyId: number): Promise<BillingPeriod[]> {
    return await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.familyId, familyId))
      .orderBy(desc(billingPeriods.periodStart));
  }

  async getAllPendingPeriods() {
    return await db
      .select({
        id: billingPeriods.id,
        familyId: billingPeriods.familyId,
        periodStart: billingPeriods.periodStart,
        periodEnd: billingPeriods.periodEnd,
        periodLabel: billingPeriods.periodLabel,
        invoiceCreated: billingPeriods.invoiceCreated,
        invoiceSent: billingPeriods.invoiceSent,
        invoiceId: billingPeriods.invoiceId,
        notes: billingPeriods.notes,
        createdAt: billingPeriods.createdAt,
        familyName: families.familyName,
        emailAddresses: families.emailAddresses,
        billingType: families.billingType,
        ratePerClass: families.ratePerClass,
        monthlyTotal: families.monthlyTotal,
        studentNames: families.studentNames,
        classDayTime: families.classDayTime,
      })
      .from(billingPeriods)
      .innerJoin(families, eq(billingPeriods.familyId, families.id))
      .where(
        or(
          eq(billingPeriods.invoiceCreated, false),
          eq(billingPeriods.invoiceSent, false)
        )
      )
      .orderBy(billingPeriods.periodStart);
  }

  async createBillingPeriod(period: InsertBillingPeriod): Promise<BillingPeriod> {
    const [created] = await db.insert(billingPeriods).values(period).returning();
    return created;
  }

  async updateBillingPeriod(id: number, updates: Partial<InsertBillingPeriod>): Promise<BillingPeriod | undefined> {
    const [updated] = await db
      .update(billingPeriods)
      .set(updates)
      .where(eq(billingPeriods.id, id))
      .returning();
    return updated;
  }

  async generateUpcomingPeriods(): Promise<void> {
    const allFamilies = await db
      .select()
      .from(families)
      .where(and(eq(families.isActive, true), sql`${families.reminderFrequency} != 'none'`));

    const today = new Date();

    for (const family of allFamilies) {
      const periods = this.computePeriodsForFamily(family, today);

      for (const period of periods) {
        // Check if period already exists
        const existing = await db
          .select()
          .from(billingPeriods)
          .where(
            and(
              eq(billingPeriods.familyId, family.id),
              eq(billingPeriods.periodStart, period.periodStart),
              eq(billingPeriods.periodEnd, period.periodEnd)
            )
          );

        if (existing.length === 0) {
          await db.insert(billingPeriods).values({
            familyId: family.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            periodLabel: period.periodLabel,
          });
        }
      }
    }
  }

  private computePeriodsForFamily(family: Family, today: Date): { periodStart: string; periodEnd: string; periodLabel: string }[] {
    const periods: { periodStart: string; periodEnd: string; periodLabel: string }[] = [];

    if (family.reminderFrequency === "monthly") {
      // Generate current month and next month periods
      for (let offset = 0; offset <= 1; offset++) {
        const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const start = formatDate(new Date(year, month, 1));
        const end = formatDate(new Date(year, month + 1, 0)); // last day of month
        periods.push({
          periodStart: start,
          periodEnd: end,
          periodLabel: `${monthNames[month]} ${year}`,
        });
      }
    } else if (family.reminderFrequency === "biweekly") {
      // Use anchor date to compute biweekly periods
      const anchor = family.reminderAnchorDate ? new Date(family.reminderAnchorDate + "T00:00:00") : new Date(today.getFullYear(), 0, 1);
      const msPerDay = 86400000;
      const daysSinceAnchor = Math.floor((today.getTime() - anchor.getTime()) / msPerDay);
      const periodIndex = Math.floor(daysSinceAnchor / 14);

      for (let offset = 0; offset <= 1; offset++) {
        const idx = periodIndex + offset;
        const start = new Date(anchor.getTime() + idx * 14 * msPerDay);
        const end = new Date(start.getTime() + 13 * msPerDay);
        const formatShort = (d: Date) => `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
        periods.push({
          periodStart: formatDate(start),
          periodEnd: formatDate(end),
          periodLabel: `${formatShort(start)} - ${formatShort(end)}, ${end.getFullYear()}`,
        });
      }
    } else if (family.reminderFrequency === "weekly") {
      // Current week and next week (week starts on the configured day or Monday)
      const dayOfWeek = family.reminderDayOfWeek ?? 1; // default Monday
      const currentDay = today.getDay();
      const diff = (currentDay - dayOfWeek + 7) % 7;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - diff);

      for (let offset = 0; offset <= 1; offset++) {
        const start = new Date(weekStart);
        start.setDate(weekStart.getDate() + offset * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const formatShort = (d: Date) => `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
        periods.push({
          periodStart: formatDate(start),
          periodEnd: formatDate(end),
          periodLabel: `${formatShort(start)} - ${formatShort(end)}, ${end.getFullYear()}`,
        });
      }
    }

    return periods;
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const storage = new DatabaseStorage();
