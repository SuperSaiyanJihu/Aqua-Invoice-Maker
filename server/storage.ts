import {
  type Invoice, type InsertInvoice, invoices,
  type Family, type InsertFamily, families,
  type BillingPeriod, type InsertBillingPeriod, billingPeriods,
  type SelectUser, users,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(username: string): Promise<SelectUser | undefined>;
  getUserById(id: number): Promise<SelectUser | undefined>;
  getAllUsers(): Promise<SelectUser[]>;
  createUser(username: string, passwordHash: string, isAdmin: boolean, mustChangePin?: boolean): Promise<SelectUser>;
  updateUser(id: number, updates: { username?: string; passwordHash?: string; isAdmin?: boolean; mustChangePin?: boolean }): Promise<SelectUser | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAdminCount(): Promise<number>;
  ensureAdminUser(): Promise<void>;
  backfillArchivedPeriods(): Promise<void>;

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
  getAllPendingPeriods(): Promise<(BillingPeriod & { familyName: string; emailAddresses: string[]; brokerEmails: string[]; billingType: string; ratePerClass: string | null; monthlyTotal: string | null; studentNames: string; classDayTime: string; documentType: string })[]>;
  getArchivedPeriods(): Promise<(BillingPeriod & { familyName: string; emailAddresses: string[]; brokerEmails: string[]; billingType: string; ratePerClass: string | null; monthlyTotal: string | null; studentNames: string; classDayTime: string; documentType: string })[]>;
  createBillingPeriod(period: InsertBillingPeriod): Promise<BillingPeriod>;
  updateBillingPeriod(id: number, updates: Partial<InsertBillingPeriod> & { archivedAt?: Date | null }): Promise<BillingPeriod | undefined>;
  deleteBillingPeriod(id: number): Promise<boolean>;
  generateUpcomingPeriods(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // --- Users ---
  async getUser(username: string): Promise<SelectUser | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserById(id: number): Promise<SelectUser | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<SelectUser[]> {
    return await db.select().from(users).orderBy(users.username);
  }

  async createUser(username: string, passwordHash: string, isAdmin: boolean, mustChangePin = false): Promise<SelectUser> {
    const [created] = await db.insert(users).values({ username, passwordHash, isAdmin, mustChangePin }).returning();
    return created;
  }

  async updateUser(id: number, updates: { username?: string; passwordHash?: string; isAdmin?: boolean }): Promise<SelectUser | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAdminCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isAdmin, true));
    return Number(result[0].count);
  }

  async ensureAdminUser(): Promise<void> {
    const allUsers = await db.select().from(users);
    if (allUsers.length === 0) {
      const username = process.env.LOGIN_USERNAME || "admin";
      const password = process.env.LOGIN_PASSWORD || "admin123";
      const hash = await bcrypt.hash(password, 10);
      await db.insert(users).values({ username, passwordHash: hash, isAdmin: true });
      console.log(`Admin user "${username}" created from environment variables`);
    }
  }

  // Idempotent: archive any already-sent period that predates the archive feature.
  async backfillArchivedPeriods(): Promise<void> {
    const result = await db
      .update(billingPeriods)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(and(eq(billingPeriods.invoiceSent, true), eq(billingPeriods.isArchived, false)))
      .returning({ id: billingPeriods.id });
    if (result.length > 0) {
      console.log(`Backfilled ${result.length} sent billing period(s) into archive`);
    }
  }

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
      .where(and(eq(billingPeriods.familyId, familyId), eq(billingPeriods.isDeleted, false)))
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
        isArchived: billingPeriods.isArchived,
        archivedAt: billingPeriods.archivedAt,
        isDeleted: billingPeriods.isDeleted,
        deletedAt: billingPeriods.deletedAt,
        createdAt: billingPeriods.createdAt,
        familyName: families.familyName,
        emailAddresses: families.emailAddresses,
        brokerEmails: families.brokerEmails,
        billingType: families.billingType,
        ratePerClass: families.ratePerClass,
        monthlyTotal: families.monthlyTotal,
        studentNames: families.studentNames,
        classDayTime: families.classDayTime,
        documentType: families.documentType,
      })
      .from(billingPeriods)
      .innerJoin(families, eq(billingPeriods.familyId, families.id))
      .where(and(eq(billingPeriods.isArchived, false), eq(billingPeriods.isDeleted, false)))
      .orderBy(billingPeriods.periodStart);
  }

  async getArchivedPeriods() {
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
        isArchived: billingPeriods.isArchived,
        archivedAt: billingPeriods.archivedAt,
        isDeleted: billingPeriods.isDeleted,
        deletedAt: billingPeriods.deletedAt,
        createdAt: billingPeriods.createdAt,
        familyName: families.familyName,
        emailAddresses: families.emailAddresses,
        brokerEmails: families.brokerEmails,
        billingType: families.billingType,
        ratePerClass: families.ratePerClass,
        monthlyTotal: families.monthlyTotal,
        studentNames: families.studentNames,
        classDayTime: families.classDayTime,
        documentType: families.documentType,
      })
      .from(billingPeriods)
      .innerJoin(families, eq(billingPeriods.familyId, families.id))
      .where(and(eq(billingPeriods.isArchived, true), eq(billingPeriods.isDeleted, false)))
      .orderBy(desc(billingPeriods.archivedAt));
  }

  async createBillingPeriod(period: InsertBillingPeriod): Promise<BillingPeriod> {
    const [created] = await db.insert(billingPeriods).values(period).returning();
    return created;
  }

  async updateBillingPeriod(id: number, updates: Partial<InsertBillingPeriod> & { archivedAt?: Date | null }): Promise<BillingPeriod | undefined> {
    const [updated] = await db
      .update(billingPeriods)
      .set(updates)
      .where(eq(billingPeriods.id, id))
      .returning();
    return updated;
  }

  async deleteBillingPeriod(id: number): Promise<boolean> {
    // Soft delete — leaves a tombstone so generateUpcomingPeriods won't re-create
    // the same (familyId, periodStart, periodEnd) tuple.
    const result = await db
      .update(billingPeriods)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(billingPeriods.id, id))
      .returning({ id: billingPeriods.id });
    return result.length > 0;
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
    const offsetMap: Record<string, number> = { previous: -1, current: 0, next: 1 };
    const offset = offsetMap[family.reminderTargetOffset] ?? -1;
    const familyCreated = new Date(family.createdAt);

    if (family.reminderFrequency === "monthly") {
      const dayOfMonth = family.reminderDayOfMonth ?? 1;
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const results: { periodStart: string; periodEnd: string; periodLabel: string }[] = [];

      // Walk every calendar month from family creation through today and fire
      // on each month whose trigger day has already passed.
      const startYear = familyCreated.getFullYear();
      const startMonth = familyCreated.getMonth();

      for (let y = startYear; y <= today.getFullYear(); y++) {
        const mStart = y === startYear ? startMonth : 0;
        const mEnd = y === today.getFullYear() ? today.getMonth() : 11;

        for (let m = mStart; m <= mEnd; m++) {
          const fireDate = new Date(y, m, dayOfMonth);
          if (today < fireDate) continue;

          const d = new Date(y, m + offset, 1);
          const periodYear = d.getFullYear();
          const periodMonth = d.getMonth();

          // Skip periods that predate the family's creation
          if (new Date(periodYear, periodMonth, 1) < new Date(startYear, startMonth, 1)) continue;

          const start = formatDate(new Date(periodYear, periodMonth, 1));
          const end = formatDate(new Date(periodYear, periodMonth + 1, 0));
          results.push({
            periodStart: start,
            periodEnd: end,
            periodLabel: `${monthNames[periodMonth]} ${periodYear}`,
          });
        }
      }

      return results;
    }

    if (family.reminderFrequency === "biweekly") {
      const msPerDay = 86400000;
      const anchor = family.reminderAnchorDate ? new Date(family.reminderAnchorDate + "T00:00:00") : new Date(today.getFullYear(), 0, 1);
      const daysSinceAnchor = Math.floor((today.getTime() - anchor.getTime()) / msPerDay);
      const currentPeriodIndex = Math.floor(daysSinceAnchor / 14);

      // Earliest period index to generate: whichever 2-week window contains the family's creation date
      const daysSinceAnchorAtCreation = Math.floor((familyCreated.getTime() - anchor.getTime()) / msPerDay);
      const firstPeriodIndex = Math.max(0, Math.floor(daysSinceAnchorAtCreation / 14));

      const formatShort = (d: Date) => `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
      const results: { periodStart: string; periodEnd: string; periodLabel: string }[] = [];

      for (let pi = firstPeriodIndex; pi <= currentPeriodIndex; pi++) {
        const fireDate = new Date(anchor.getTime() + pi * 14 * msPerDay);
        if (today < fireDate) continue;

        const idx = pi + offset;
        const start = new Date(anchor.getTime() + idx * 14 * msPerDay);
        const end = new Date(start.getTime() + 13 * msPerDay);

        // Skip periods that predate the family's creation
        if (start < familyCreated) continue;

        results.push({
          periodStart: formatDate(start),
          periodEnd: formatDate(end),
          periodLabel: `${formatShort(start)} - ${formatShort(end)}, ${end.getFullYear()}`,
        });
      }

      return results;
    }

    if (family.reminderFrequency === "weekly") {
      const dayOfWeek = family.reminderDayOfWeek ?? 1;
      const msPerDay = 86400000;

      // Find the most recent occurrence of dayOfWeek on or before today
      const currentDay = today.getDay();
      const diffToCurrentWeekStart = (currentDay - dayOfWeek + 7) % 7;
      const currentWeekFireDate = new Date(today);
      currentWeekFireDate.setDate(today.getDate() - diffToCurrentWeekStart);
      currentWeekFireDate.setHours(0, 0, 0, 0);

      // Find the fire date of the week that contains the family's creation date
      const creationDay = familyCreated.getDay();
      const diffToCreationWeekStart = (creationDay - dayOfWeek + 7) % 7;
      const firstWeekFireDate = new Date(familyCreated);
      firstWeekFireDate.setDate(familyCreated.getDate() - diffToCreationWeekStart);
      firstWeekFireDate.setHours(0, 0, 0, 0);

      const formatShort = (d: Date) => `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
      const results: { periodStart: string; periodEnd: string; periodLabel: string }[] = [];

      const totalWeeks = Math.round((currentWeekFireDate.getTime() - firstWeekFireDate.getTime()) / (7 * msPerDay));

      for (let w = 0; w <= totalWeeks; w++) {
        const weekFireDate = new Date(firstWeekFireDate.getTime() + w * 7 * msPerDay);
        if (today < weekFireDate) continue;

        const start = new Date(weekFireDate.getTime() + offset * 7 * msPerDay);
        const end = new Date(start.getTime() + 6 * msPerDay);

        // Skip periods that predate the family's creation
        if (start < new Date(familyCreated.getFullYear(), familyCreated.getMonth(), familyCreated.getDate())) continue;

        results.push({
          periodStart: formatDate(start),
          periodEnd: formatDate(end),
          periodLabel: `${formatShort(start)} - ${formatShort(end)}, ${end.getFullYear()}`,
        });
      }

      return results;
    }

    return [];
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const storage = new DatabaseStorage();
