import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { generateInvoicePdf } from "./pdf";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/invoices", async (_req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
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

  const attendanceSchema = z.object({
    invoiceType: z.literal("attendance"),
    studentName: z.string().min(1),
    classDayTime: z.string().min(1),
    ratePerClass: z.string(),
    attendanceDates: z.array(z.string()).min(1),
    comments: z.string().nullable().optional(),
  });

  const monthlySchema = z.object({
    invoiceType: z.literal("monthly"),
    studentName: z.string().min(1),
    classDayTime: z.string().min(1),
    monthlyMonth: z.string().min(1),
    monthlyYear: z.string().min(1),
    monthlyDay: z.string().min(1),
    monthlyTotal: z.string(),
    comments: z.string().nullable().optional(),
  });

  const generateSchema = z.discriminatedUnion("invoiceType", [attendanceSchema, monthlySchema]);

  app.post("/api/invoices/generate", async (req, res) => {
    try {
      const data = generateSchema.parse(req.body);

      if (data.invoiceType === "attendance") {
        await storage.createInvoice({
          invoiceType: "attendance",
          studentName: data.studentName,
          classDayTime: data.classDayTime,
          ratePerClass: data.ratePerClass,
          attendanceDates: data.attendanceDates,
          comments: data.comments || null,
        });

        const pdfBuffer = await generateInvoicePdf({
          invoiceType: "attendance",
          studentName: data.studentName,
          classDayTime: data.classDayTime,
          ratePerClass: parseFloat(data.ratePerClass),
          attendanceDates: data.attendanceDates,
          comments: data.comments || null,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="invoice.pdf"`);
        res.send(pdfBuffer);
      } else {
        await storage.createInvoice({
          invoiceType: "monthly",
          studentName: data.studentName,
          classDayTime: data.classDayTime,
          ratePerClass: "0",
          attendanceDates: [],
          monthlyMonth: data.monthlyMonth,
          monthlyYear: data.monthlyYear,
          monthlyDay: data.monthlyDay,
          monthlyTotal: data.monthlyTotal,
          comments: data.comments || null,
        });

        const pdfBuffer = await generateInvoicePdf({
          invoiceType: "monthly",
          studentName: data.studentName,
          classDayTime: data.classDayTime,
          monthlyMonth: data.monthlyMonth,
          monthlyYear: data.monthlyYear,
          monthlyDay: data.monthlyDay,
          monthlyTotal: parseFloat(data.monthlyTotal),
          comments: data.comments || null,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="invoice.pdf"`);
        res.send(pdfBuffer);
      }
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return httpServer;
}
