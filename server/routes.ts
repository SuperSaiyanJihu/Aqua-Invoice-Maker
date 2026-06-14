import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, requireAdmin } from "./auth";
import { z } from "zod";
import { db } from "./db";
import { billingPeriods } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateInvoicePdf } from "./pdf";
import { sendInvoiceEmail, buildInvoiceEmail, isEmailConfigured } from "./email";
import { validateStudentNames } from "@shared/validation";
import { deriveMonthYearFromDates } from "@shared/email-template";
import type { Invoice } from "@shared/schema";

// Resolve the "smart" billing period (month/year) for an invoice email:
// explicit label > linked billing period's label > monthly fields > attendance dates.
async function resolveMonthYear(
  invoice: Invoice,
  billingPeriodId?: number | null,
  explicitLabel?: string | null,
): Promise<{ month: string; year: string; monthYear: string }> {
  if (explicitLabel) {
    return { month: "", year: "", monthYear: explicitLabel };
  }
  if (billingPeriodId) {
    const period = await storage.getBillingPeriod(billingPeriodId);
    if (period?.periodLabel) {
      const derived = deriveMonthYearFromDates([period.periodStart, period.periodEnd]);
      return { month: derived.month, year: derived.year, monthYear: period.periodLabel };
    }
  }
  if (invoice.invoiceType === "monthly" && invoice.monthlyMonth && invoice.monthlyYear) {
    return {
      month: invoice.monthlyMonth,
      year: invoice.monthlyYear,
      monthYear: `${invoice.monthlyMonth} ${invoice.monthlyYear}`,
    };
  }
  return deriveMonthYearFromDates(invoice.attendanceDates);
}

// Zod helper: a student name field that requires a first and last name.
const fullStudentName = (max: number, label: string) =>
  z
    .string()
    .min(1)
    .max(max, label)
    .refine((v) => validateStudentNames(v) === null, {
      message: "Please enter both a first and last name for each student.",
    });

// Generate the PDF buffer for a stored invoice record.
async function buildPdfForInvoice(invoice: Invoice): Promise<Buffer> {
  const docType = (invoice.documentType as "invoice" | "receipt") || "invoice";
  if (invoice.invoiceType === "monthly") {
    return generateInvoicePdf({
      invoiceType: "monthly",
      documentType: docType,
      invoiceNumber: invoice.invoiceNumber,
      studentName: invoice.studentName,
      classDayTime: invoice.classDayTime,
      monthlyMonth: invoice.monthlyMonth || "",
      monthlyYear: invoice.monthlyYear || "",
      monthlyDay: invoice.monthlyDay || "",
      monthlyTotal: parseFloat(invoice.monthlyTotal || "0"),
      attendanceDates: invoice.attendanceDates,
      comments: invoice.comments,
    });
  }
  return generateInvoicePdf({
    invoiceType: "attendance",
    documentType: docType,
    invoiceNumber: invoice.invoiceNumber,
    studentName: invoice.studentName,
    classDayTime: invoice.classDayTime,
    ratePerClass: parseFloat(invoice.ratePerClass),
    attendanceDates: invoice.attendanceDates,
    comments: invoice.comments,
  });
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// Generate invoice number: EA-YYYYMMDD-XXXX
function generateInvoiceNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EA-${dateStr}-${random}`;
}

// Input length limits
const MAX_NAME_LENGTH = 100;
const MAX_CLASS_LENGTH = 100;
const MAX_COMMENTS_LENGTH = 500;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Rate limiting middleware for API routes
  app.use("/api/", (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!rateLimit(ip)) {
      return res.status(429).json({
        error: "Too many requests. Please try again later."
      });
    }
    next();
  });

  // Protect all API routes with authentication
  app.use("/api/families", requireAuth);
  app.use("/api/billing", requireAuth);
  app.use("/api/invoices", requireAuth);
  app.use("/api/settings", requireAuth);
  // Admin routes are protected in auth.ts with both requireAuth + requireAdmin

  // =====================
  // SETTINGS ROUTES
  // =====================

  const emailTemplateSchema = z.object({
    subject: z.string().min(1).max(300),
    body: z.string().min(1).max(5000),
  });

  app.get("/api/settings/email-template", async (_req, res) => {
    try {
      res.json(await storage.getEmailTemplate());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/settings/email-template", requireAdmin, async (req, res) => {
    try {
      const data = emailTemplateSchema.parse(req.body);
      res.json(await storage.updateEmailTemplate(data));
    } catch (err: any) {
      if (err.name === "ZodError") {
        const messages = err.errors.map((e: any) => e.message).join(", ");
        return res.status(400).json({ error: messages });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // =====================
  // FAMILY ROUTES
  // =====================

  const familySchema = z.object({
    familyName: z.string().min(1).max(MAX_NAME_LENGTH),
    studentNames: fullStudentName(200, "Student names must be 200 characters or less"),
    classDayTime: z.string().min(1).max(MAX_CLASS_LENGTH),
    billingType: z.enum(["attendance", "monthly"]).default("attendance"),
    documentType: z.enum(["invoice", "receipt"]).default("invoice"),
    ratePerClass: z.string().nullable().optional(),
    monthlyTotal: z.string().nullable().optional(),
    emailAddresses: z.array(z.string().email()).default([]),
    brokerEmails: z.array(z.string().email()).default([]),
    notes: z.string().max(1000).nullable().optional(),
    reminderFrequency: z.enum(["monthly", "biweekly", "weekly", "none"]).default("none"),
    reminderDayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
    reminderDayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    reminderAnchorDate: z.string().nullable().optional(),
    reminderTargetOffset: z.enum(["previous", "current", "next"]).default("previous"),
    isActive: z.boolean().default(true),
  });

  app.get("/api/families", async (_req, res) => {
    try {
      const result = await storage.getFamilies();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/families/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const family = await storage.getFamily(id);
      if (!family) return res.status(404).json({ error: "Family not found" });
      res.json(family);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/families", async (req, res) => {
    try {
      const data = familySchema.parse(req.body);
      const family = await storage.createFamily(data as any);
      res.status(201).json(family);
    } catch (err: any) {
      if (err.name === "ZodError") {
        const messages = err.errors.map((e: any) => e.message).join(", ");
        return res.status(400).json({ error: messages });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/families/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const data = familySchema.partial().parse(req.body);
      const family = await storage.updateFamily(id, data as any);
      if (!family) return res.status(404).json({ error: "Family not found" });
      res.json(family);
    } catch (err: any) {
      if (err.name === "ZodError") {
        const messages = err.errors.map((e: any) => e.message).join(", ");
        return res.status(400).json({ error: messages });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/families/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const deleted = await storage.deleteFamily(id);
      if (!deleted) return res.status(404).json({ error: "Family not found" });
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================
  // BILLING PERIOD ROUTES
  // =====================

  app.get("/api/billing/debug", async (_req, res) => {
    try {
      const allFamilies = await storage.getFamilies();
      const today = new Date();
      const report = await Promise.all(
        allFamilies.map(async (f) => {
          const wouldGenerate = (storage as any).computePeriodsForFamily(f, today) as { periodStart: string; periodEnd: string; periodLabel: string }[];
          const existingPeriods = await storage.getBillingPeriods(f.id);
          return {
            id: f.id,
            name: f.familyName,
            isActive: f.isActive,
            reminderFrequency: f.reminderFrequency,
            reminderDayOfMonth: f.reminderDayOfMonth,
            reminderTargetOffset: f.reminderTargetOffset,
            createdAt: f.createdAt,
            wouldGeneratePeriods: wouldGenerate.map(p => p.periodLabel),
            existingPeriods: (await db.select().from(billingPeriods).where(eq(billingPeriods.familyId, f.id))).map(p => ({
              label: p.periodLabel,
              start: p.periodStart,
              end: p.periodEnd,
              invoiceCreated: p.invoiceCreated,
              invoiceSent: p.invoiceSent,
              isArchived: p.isArchived,
              isDeleted: p.isDeleted,
            })),
          };
        })
      );
      res.json({
        serverTime: today.toISOString(),
        totalFamilies: allFamilies.length,
        eligibleForReminders: allFamilies.filter(f => f.isActive && f.reminderFrequency !== "none").length,
        families: report,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/billing/dashboard", async (_req, res) => {
    try {
      await storage.generateUpcomingPeriods();
      const pending = await storage.getAllPendingPeriods();
      res.json(pending);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/billing/archived", async (_req, res) => {
    try {
      const archived = await storage.getArchivedPeriods();
      res.json(archived);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/families/:id/periods", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const periods = await storage.getBillingPeriods(id);
      res.json(periods);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

  const updatePeriodSchema = z.object({
    invoiceCreated: z.boolean().optional(),
    invoiceSent: z.boolean().optional(),
    invoiceId: z.number().int().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    periodLabel: z.string().min(1).max(100).optional(),
    periodStart: isoDate.optional(),
    periodEnd: isoDate.optional(),
    isArchived: z.boolean().optional(),
    documentType: z.enum(["invoice", "receipt"]).optional(),
  });

  app.patch("/api/billing/periods/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const data = updatePeriodSchema.parse(req.body);

      const updates: Record<string, unknown> = { ...data };
      if (data.invoiceSent === true) {
        updates.isArchived = true;
        updates.archivedAt = new Date();
      } else if (data.isArchived === false) {
        updates.archivedAt = null;
      } else if (data.isArchived === true) {
        updates.archivedAt = new Date();
      }

      const period = await storage.updateBillingPeriod(id, updates as any);
      if (!period) return res.status(404).json({ error: "Billing period not found" });
      res.json(period);
    } catch (err: any) {
      if (err.name === "ZodError") {
        const messages = err.errors.map((e: any) => e.message).join(", ");
        return res.status(400).json({ error: messages });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/billing/periods/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const deleted = await storage.deleteBillingPeriod(id);
      if (!deleted) return res.status(404).json({ error: "Billing period not found" });
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =====================
  // INVOICE ROUTES
  // =====================

  app.get("/api/invoices", async (_req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // New endpoint: Get PDF for existing invoice (no duplicate creation)
  app.get("/api/invoices/:id/pdf", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice ID" });
      }

      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const docType = invoice.documentType as "invoice" | "receipt" || "invoice";
      const pdfBuffer = await buildPdfForInvoice(invoice);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${docType}-${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send an existing invoice by email (with PDF attached) and log the result.
  const sendEmailSchema = z.object({
    to: z.array(z.string().email()).optional(),
    cc: z.array(z.string().email()).optional(),
    billingPeriodId: z.number().int().nullable().optional(),
    periodLabel: z.string().max(100).nullable().optional(),
    markSent: z.boolean().optional().default(true),
  });

  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid invoice ID" });

      if (!isEmailConfigured()) {
        return res.status(503).json({
          error: "Email is not configured. The Resend API key (Invoice_Email) is missing.",
        });
      }

      const body = sendEmailSchema.parse(req.body);

      const invoice = await storage.getInvoice(id);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      const family = invoice.familyId ? await storage.getFamily(invoice.familyId) : null;

      // Recipients: explicit override, otherwise parents (to) + brokers (cc).
      const to = body.to ?? family?.emailAddresses ?? [];
      const cc = body.cc ?? family?.brokerEmails ?? [];

      if (to.length === 0) {
        return res.status(400).json({
          error: "No recipient email addresses. Add a parent email to the family, or pass `to`.",
        });
      }

      const pdfBuffer = await buildPdfForInvoice(invoice);

      const template = await storage.getEmailTemplate();
      const period = await resolveMonthYear(invoice, body.billingPeriodId, body.periodLabel);

      // Build once so the same rendered subject is logged on both success and failure.
      const built = buildInvoiceEmail({ invoice, family: family ?? null, to, cc, template, period, pdfBuffer });

      try {
        const { messageId, email } = await sendInvoiceEmail({
          invoice,
          family: family ?? null,
          to,
          cc,
          template,
          period,
          pdfBuffer,
        });

        const log = await storage.createEmailLog({
          invoiceId: invoice.id,
          billingPeriodId: body.billingPeriodId ?? null,
          familyId: invoice.familyId ?? null,
          toAddresses: email.to,
          ccAddresses: email.cc ?? [],
          replyTo: email.replyTo,
          fromAddress: email.from,
          subject: email.subject,
          status: "sent",
          providerMessageId: messageId,
          errorMessage: null,
        });

        // Mark the billing period as sent (which archives it), mirroring the checkbox flow.
        if (body.markSent && body.billingPeriodId) {
          await storage.updateBillingPeriod(body.billingPeriodId, {
            invoiceSent: true,
            isArchived: true,
            archivedAt: new Date(),
          } as any);
        }

        res.json({
          success: true,
          messageId,
          to: email.to,
          cc: email.cc ?? [],
          subject: email.subject,
          log,
        });
      } catch (sendErr: any) {
        // Document the failed attempt too.
        await storage.createEmailLog({
          invoiceId: invoice.id,
          billingPeriodId: body.billingPeriodId ?? null,
          familyId: invoice.familyId ?? null,
          toAddresses: to,
          ccAddresses: cc,
          replyTo: null,
          fromAddress: null,
          subject: built.subject,
          status: "failed",
          providerMessageId: null,
          errorMessage: sendErr.message?.slice(0, 500) || "Unknown error",
        });
        res.status(502).json({ error: `Failed to send email: ${sendErr.message}` });
      }
    } catch (err: any) {
      if (err.name === "ZodError") {
        const messages = err.errors.map((e: any) => e.message).join(", ");
        return res.status(400).json({ error: messages });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Email send history for an invoice (documentation).
  app.get("/api/invoices/:id/emails", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid invoice ID" });
      const logs = await storage.getEmailLogsForInvoice(id);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid invoice ID" });
      }
      const deleted = await storage.deleteInvoice(id);
      if (!deleted) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const documentTypeSchema = z.enum(["invoice", "receipt"]).default("invoice");

  const attendanceSchema = z.object({
    invoiceType: z.literal("attendance"),
    documentType: documentTypeSchema,
    studentName: fullStudentName(MAX_NAME_LENGTH, `Student name must be ${MAX_NAME_LENGTH} characters or less`),
    classDayTime: z.string().min(1).max(MAX_CLASS_LENGTH, `Class info must be ${MAX_CLASS_LENGTH} characters or less`),
    ratePerClass: z.string(),
    attendanceDates: z.array(z.string()).min(1).max(366, "Cannot select more than 366 dates"),
    comments: z.string().max(MAX_COMMENTS_LENGTH, `Comments must be ${MAX_COMMENTS_LENGTH} characters or less`).nullable().optional(),
    familyId: z.number().int().nullable().optional(),
    billingPeriodId: z.number().int().nullable().optional(),
  });

  const monthlySchema = z.object({
    invoiceType: z.literal("monthly"),
    documentType: documentTypeSchema,
    studentName: fullStudentName(MAX_NAME_LENGTH, `Student name must be ${MAX_NAME_LENGTH} characters or less`),
    classDayTime: z.string().min(1).max(MAX_CLASS_LENGTH, `Class info must be ${MAX_CLASS_LENGTH} characters or less`),
    monthlyMonth: z.string().min(1),
    monthlyYear: z.string().min(1),
    monthlyDay: z.string().min(1),
    monthlyTotal: z.string(),
    attendanceDates: z.array(z.string()).max(366, "Cannot select more than 366 dates").optional().default([]),
    comments: z.string().max(MAX_COMMENTS_LENGTH, `Comments must be ${MAX_COMMENTS_LENGTH} characters or less`).nullable().optional(),
    familyId: z.number().int().nullable().optional(),
    billingPeriodId: z.number().int().nullable().optional(),
  });

  const generateSchema = z.discriminatedUnion("invoiceType", [attendanceSchema, monthlySchema]);

  app.post("/api/invoices/generate", async (req, res) => {
    try {
      const data = generateSchema.parse(req.body);
      const docType = data.documentType || "invoice";
      const invoiceNumber = generateInvoiceNumber();

      if (data.invoiceType === "attendance") {
        const invoice = await storage.createInvoice({
          invoiceNumber,
          invoiceType: "attendance",
          documentType: docType,
          studentName: data.studentName,
          classDayTime: data.classDayTime,
          ratePerClass: data.ratePerClass,
          attendanceDates: data.attendanceDates,
          comments: data.comments || null,
          familyId: data.familyId || null,
        });

        // Auto-mark billing period as created
        if (data.billingPeriodId) {
          await storage.updateBillingPeriod(data.billingPeriodId, {
            invoiceCreated: true,
            invoiceId: invoice.id,
          });
        }

        const pdfBuffer = await generateInvoicePdf({
          invoiceType: "attendance",
          documentType: docType,
          invoiceNumber,
          studentName: data.studentName,
          classDayTime: data.classDayTime,
          ratePerClass: parseFloat(data.ratePerClass),
          attendanceDates: data.attendanceDates,
          comments: data.comments || null,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${docType}-${invoiceNumber}.pdf"`);
        res.setHeader("X-Invoice-Id", invoice.id.toString());
        res.send(pdfBuffer);
      } else {
        const invoice = await storage.createInvoice({
          invoiceNumber,
          invoiceType: "monthly",
          documentType: docType,
          studentName: data.studentName,
          classDayTime: data.classDayTime,
          ratePerClass: "0",
          attendanceDates: data.attendanceDates,
          monthlyMonth: data.monthlyMonth,
          monthlyYear: data.monthlyYear,
          monthlyDay: data.monthlyDay,
          monthlyTotal: data.monthlyTotal,
          comments: data.comments || null,
          familyId: data.familyId || null,
        });

        // Auto-mark billing period as created
        if (data.billingPeriodId) {
          await storage.updateBillingPeriod(data.billingPeriodId, {
            invoiceCreated: true,
            invoiceId: invoice.id,
          });
        }

        const pdfBuffer = await generateInvoicePdf({
          invoiceType: "monthly",
          documentType: docType,
          invoiceNumber,
          studentName: data.studentName,
          classDayTime: data.classDayTime,
          monthlyMonth: data.monthlyMonth,
          monthlyYear: data.monthlyYear,
          monthlyDay: data.monthlyDay,
          monthlyTotal: parseFloat(data.monthlyTotal),
          attendanceDates: data.attendanceDates,
          comments: data.comments || null,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${docType}-${invoiceNumber}.pdf"`);
        res.setHeader("X-Invoice-Id", invoice.id.toString());
        res.send(pdfBuffer);
      }
    } catch (err: any) {
      if (err.name === "ZodError") {
        const messages = err.errors.map((e: any) => e.message).join(", ");
        return res.status(400).json({ error: messages });
      }
      console.error("Invoice generation error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}
