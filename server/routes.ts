import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStudentSchema } from "@shared/schema";
import { z } from "zod";
import { generateInvoicePdf } from "./pdf";
import { seedDatabase } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await seedDatabase();

  app.get("/api/students", async (_req, res) => {
    try {
      const students = await storage.getStudents();
      res.json(students);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/students", async (req, res) => {
    try {
      const parsed = insertStudentSchema.parse(req.body);
      const student = await storage.createStudent(parsed);
      res.status(201).json(student);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid student ID" });
      }
      const student = await storage.updateStudent(id, req.body);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json(student);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid student ID" });
      }
      const deleted = await storage.deleteStudent(id);
      if (!deleted) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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

  const generateSchema = z.object({
    studentName: z.string().min(1),
    classDayTime: z.string().min(1),
    ratePerClass: z.string(),
    attendanceDates: z.array(z.string()).min(1),
    comments: z.string().nullable().optional(),
  });

  app.post("/api/invoices/generate", async (req, res) => {
    try {
      const data = generateSchema.parse(req.body);

      await storage.createInvoice({
        studentId: 0,
        studentName: data.studentName,
        classDayTime: data.classDayTime,
        ratePerClass: data.ratePerClass,
        attendanceDates: data.attendanceDates,
        comments: data.comments || null,
      });

      const pdfBuffer = await generateInvoicePdf({
        studentName: data.studentName,
        classDayTime: data.classDayTime,
        ratePerClass: parseFloat(data.ratePerClass),
        attendanceDates: data.attendanceDates,
        comments: data.comments || null,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="invoice.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return httpServer;
}
