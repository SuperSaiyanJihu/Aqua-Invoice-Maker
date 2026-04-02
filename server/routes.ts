import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import { z } from "zod";
import { generateInvoicePdf } from "./pdf";

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

  // Protect all invoice routes with authentication
  app.use("/api/invoices", requireAuth);

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
      let pdfBuffer: Buffer;

      if (invoice.invoiceType === "monthly") {
        pdfBuffer = await generateInvoicePdf({
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
      } else {
        pdfBuffer = await generateInvoicePdf({
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

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${docType}-${invoice.invoiceNumber}.pdf"`);
      res.send(pdfBuffer);
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
    studentName: z.string().min(1).max(MAX_NAME_LENGTH, `Student name must be ${MAX_NAME_LENGTH} characters or less`),
    classDayTime: z.string().min(1).max(MAX_CLASS_LENGTH, `Class info must be ${MAX_CLASS_LENGTH} characters or less`),
    ratePerClass: z.string(),
    attendanceDates: z.array(z.string()).min(1).max(366, "Cannot select more than 366 dates"),
    comments: z.string().max(MAX_COMMENTS_LENGTH, `Comments must be ${MAX_COMMENTS_LENGTH} characters or less`).nullable().optional(),
  });

  const monthlySchema = z.object({
    invoiceType: z.literal("monthly"),
    documentType: documentTypeSchema,
    studentName: z.string().min(1).max(MAX_NAME_LENGTH, `Student name must be ${MAX_NAME_LENGTH} characters or less`),
    classDayTime: z.string().min(1).max(MAX_CLASS_LENGTH, `Class info must be ${MAX_CLASS_LENGTH} characters or less`),
    monthlyMonth: z.string().min(1),
    monthlyYear: z.string().min(1),
    monthlyDay: z.string().min(1),
    monthlyTotal: z.string(),
    attendanceDates: z.array(z.string()).max(366, "Cannot select more than 366 dates").optional().default([]),
    comments: z.string().max(MAX_COMMENTS_LENGTH, `Comments must be ${MAX_COMMENTS_LENGTH} characters or less`).nullable().optional(),
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
        });

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
        });

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
