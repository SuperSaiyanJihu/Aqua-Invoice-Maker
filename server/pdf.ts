import PDFDocument from "pdfkit";
import { format, parseISO } from "date-fns";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

interface AttendanceInvoiceData {
  invoiceType: "attendance";
  documentType: "invoice" | "receipt";
  invoiceNumber: string;
  studentName: string;
  classDayTime: string;
  ratePerClass: number;
  attendanceDates: string[];
  comments: string | null;
}

interface MonthlyInvoiceData {
  invoiceType: "monthly";
  documentType: "invoice" | "receipt";
  invoiceNumber: string;
  studentName: string;
  classDayTime: string;
  monthlyMonth: string;
  monthlyYear: string;
  monthlyDay: string;
  monthlyTotal: number;
  attendanceDates?: string[];
  comments: string | null;
}

type InvoiceData = AttendanceInvoiceData | MonthlyInvoiceData;

// Sanitize text to prevent PDF issues with special characters
function sanitizeText(text: string, maxLength: number = 500): string {
  if (!text) return "";
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters
    .slice(0, maxLength)
    .trim();
}

function renderHeader(
  doc: PDFKit.PDFDocument, 
  logoPath: string, 
  documentType: "invoice" | "receipt",
  invoiceNumber: string
) {
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 30, { width: 70 });
  }

  doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a5276");
  doc.text("Excel Aquatics", 130, 38, { lineBreak: false });
  doc.fontSize(9).font("Helvetica").fillColor("#555555");
  doc.text("Colonie, NY", 130, 60, { lineBreak: false });

  const headerLabel = documentType === "receipt" ? "RECEIPT" : "INVOICE";
  doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a5276");
  doc.text(headerLabel, doc.page.width - 200, 38, { width: 150, align: "right", lineBreak: false });

  doc.fontSize(9).font("Helvetica").fillColor("#666666");
  doc.text(`#${invoiceNumber}`, doc.page.width - 200, 58, { width: 150, align: "right", lineBreak: false });
  doc.text(`Date: ${format(new Date(), "MMMM d, yyyy")}`, doc.page.width - 200, 72, { width: 150, align: "right", lineBreak: false });

  doc.moveTo(50, 92).lineTo(doc.page.width - 50, 92).strokeColor("#1a5276").lineWidth(1.5).stroke();
}

function renderStudentInfo(doc: PDFKit.PDFDocument, data: InvoiceData, startY: number): number {
  let y = startY;

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333");
  doc.text("Bill To:", 50, y, { lineBreak: false });
  y += 15;

  doc.fontSize(9).font("Helvetica").fillColor("#333333");
  doc.text(`Student: ${sanitizeText(data.studentName, 100)}`, 50, y, { lineBreak: false });
  y += 14;
  doc.text(`Class: ${sanitizeText(data.classDayTime, 100)}`, 50, y, { lineBreak: false });
  y += 14;

  if (data.invoiceType === "attendance") {
    doc.text(`Rate per Class: $${data.ratePerClass.toFixed(2)}`, 50, y, { lineBreak: false });
    y += 20;
  } else {
    doc.text(`Lesson Day: ${data.monthlyDay}s`, 50, y, { lineBreak: false });
    y += 14;
    doc.text(`Period: ${data.monthlyMonth} ${data.monthlyYear}`, 50, y, { lineBreak: false });
    y += 20;
  }

  return y;
}

function renderComments(doc: PDFKit.PDFDocument, comments: string | null, y: number, pageWidth: number): number {
  if (!comments) return y;

  const sanitizedComments = sanitizeText(comments, 500);

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333");
  doc.text("Comments:", 50, y, { lineBreak: false });
  y += 14;

  doc.rect(50, y, pageWidth, 1.5).fill("#e0e0e0");
  y += 6;

  doc.fontSize(9).font("Helvetica").fillColor("#555555");
  doc.text(sanitizedComments, 50, y, { width: pageWidth, lineBreak: false });
  y += doc.heightOfString(sanitizedComments, { width: pageWidth }) + 12;

  return y;
}

function renderFooter(doc: PDFKit.PDFDocument, pageWidth: number) {
  const footerY = doc.page.height - 50;
  doc.moveTo(50, footerY - 8).lineTo(doc.page.width - 50, footerY - 8).strokeColor("#dddddd").lineWidth(0.5).stroke();
  doc.fontSize(8).font("Helvetica").fillColor("#999999");
  doc.text("Excel Aquatics — Colonie, NY", 50, footerY, { width: pageWidth, align: "center", lineBreak: false });
  doc.text("Thank you for choosing Excel Aquatics!", 50, footerY + 11, { width: pageWidth, align: "center", lineBreak: false });
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.addPage = (() => doc) as any;

    const pageWidth = doc.page.width - 100;
    const logoPath = path.join(process.cwd(), "client", "public", "images", "excel-aquatics-logo.png");

    renderHeader(doc, logoPath, data.documentType, data.invoiceNumber);
    let y = renderStudentInfo(doc, data, 105);

    if (data.invoiceType === "attendance") {
      const datesByMonth: Record<string, string[]> = {};
      for (const dateStr of data.attendanceDates) {
        const d = parseISO(dateStr);
        const monthKey = format(d, "MMMM yyyy");
        if (!datesByMonth[monthKey]) datesByMonth[monthKey] = [];
        datesByMonth[monthKey].push(dateStr);
      }

      for (const [, dates] of Object.entries(datesByMonth)) {
        dates.sort();
      }

      const sortedMonths = Object.keys(datesByMonth).sort((a, b) => {
        const da = parseISO(datesByMonth[a][0]);
        const db = parseISO(datesByMonth[b][0]);
        return da.getTime() - db.getTime();
      });

      const tableLeft = 50;
      const colDate = tableLeft;
      const colRate = tableLeft + 380;
      const tableRight = doc.page.width - 50;

      doc.rect(tableLeft, y, pageWidth, 18).fill("#1a5276");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Date", colDate + 8, y + 4, { width: 350, lineBreak: false });
      doc.text("Amount", colRate + 8, y + 4, { width: 80, align: "right", lineBreak: false });
      y += 18;

      let totalClasses = 0;
      let rowIndex = 0;

      for (const month of sortedMonths) {
        const dates = datesByMonth[month];

        doc.rect(tableLeft, y, pageWidth, 18).fill("#e8f0f8");
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a5276");
        doc.text(month, colDate + 8, y + 4, { width: pageWidth - 16, lineBreak: false });
        y += 18;

        for (const dateStr of dates) {
          const d = parseISO(dateStr);

          if (rowIndex % 2 === 1) {
            doc.rect(tableLeft, y, pageWidth, 16).fill("#f8f9fa");
          }

          doc.fontSize(8).font("Helvetica").fillColor("#333333");
          doc.text(format(d, "EEEE, MMMM d, yyyy"), colDate + 8, y + 4, { width: 350, lineBreak: false });
          doc.text(`$${data.ratePerClass.toFixed(2)}`, colRate + 8, y + 4, { width: 80, align: "right", lineBreak: false });

          y += 16;
          totalClasses++;
          rowIndex++;
        }
      }

      doc.moveTo(tableLeft, y).lineTo(tableRight, y).strokeColor("#cccccc").lineWidth(0.5).stroke();
      y += 6;

      const totalLabel = `Total (${totalClasses} ${totalClasses === 1 ? "class" : "classes"}):`;
      const totalAmount = `$${(totalClasses * data.ratePerClass).toFixed(2)}`;
      doc.rect(colRate - 120, y, 208, 22).fill("#1a5276");
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text(totalLabel, colRate - 112, y + 5, { width: 120, lineBreak: false });
      doc.text(totalAmount, colRate + 8, y + 5, { width: 80, align: "right", lineBreak: false });
      y += 32;
    } else if (data.attendanceDates && data.attendanceDates.length > 0) {
      // Monthly with specific lesson dates
      const datesByMonth: Record<string, string[]> = {};
      for (const dateStr of data.attendanceDates) {
        const d = parseISO(dateStr);
        const monthKey = format(d, "MMMM yyyy");
        if (!datesByMonth[monthKey]) datesByMonth[monthKey] = [];
        datesByMonth[monthKey].push(dateStr);
      }

      for (const [, dates] of Object.entries(datesByMonth)) {
        dates.sort();
      }

      const sortedMonths = Object.keys(datesByMonth).sort((a, b) => {
        const da = parseISO(datesByMonth[a][0]);
        const db = parseISO(datesByMonth[b][0]);
        return da.getTime() - db.getTime();
      });

      const tableLeft = 50;
      const colDate = tableLeft;
      const colValue = tableLeft + 380;
      const tableRight = doc.page.width - 50;

      doc.rect(tableLeft, y, pageWidth, 18).fill("#1a5276");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Date", colDate + 8, y + 4, { width: 350, lineBreak: false });
      doc.text("", colValue + 8, y + 4, { width: 80, align: "right", lineBreak: false });
      y += 18;

      let rowIndex = 0;

      for (const month of sortedMonths) {
        const dates = datesByMonth[month];

        doc.rect(tableLeft, y, pageWidth, 18).fill("#e8f0f8");
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a5276");
        doc.text(month, colDate + 8, y + 4, { width: pageWidth - 16, lineBreak: false });
        y += 18;

        for (const dateStr of dates) {
          const d = parseISO(dateStr);

          if (rowIndex % 2 === 1) {
            doc.rect(tableLeft, y, pageWidth, 16).fill("#f8f9fa");
          }

          doc.fontSize(8).font("Helvetica").fillColor("#333333");
          doc.text(format(d, "EEEE, MMMM d, yyyy"), colDate + 8, y + 4, { width: 350, lineBreak: false });

          y += 16;
          rowIndex++;
        }
      }

      doc.moveTo(tableLeft, y).lineTo(tableRight, y).strokeColor("#cccccc").lineWidth(0.5).stroke();
      y += 6;

      const totalDates = data.attendanceDates.length;
      const totalLabel = `Total (${totalDates} ${totalDates === 1 ? "lesson" : "lessons"}):`;
      doc.rect(colValue - 120, y, 208, 22).fill("#1a5276");
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text(totalLabel, colValue - 112, y + 5, { width: 120, lineBreak: false });
      doc.text(`$${data.monthlyTotal.toFixed(2)}`, colValue + 8, y + 5, { width: 80, align: "right", lineBreak: false });
      y += 32;
    } else {
      // Monthly without specific dates (simple table)
      const tableLeft = 50;
      const colLabel = tableLeft;
      const colValue = tableLeft + 380;

      doc.rect(tableLeft, y, pageWidth, 18).fill("#1a5276");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Description", colLabel + 8, y + 4, { width: 350, lineBreak: false });
      doc.text("Amount", colValue + 8, y + 4, { width: 80, align: "right", lineBreak: false });
      y += 18;

      doc.rect(tableLeft, y, pageWidth, 22).fill("#f8f9fa");
      doc.fontSize(9).font("Helvetica").fillColor("#333333");
      doc.text(`${data.monthlyDay} lessons — ${data.monthlyMonth} ${data.monthlyYear}`, colLabel + 8, y + 6, { width: 350, lineBreak: false });
      doc.text(`$${data.monthlyTotal.toFixed(2)}`, colValue + 8, y + 6, { width: 80, align: "right", lineBreak: false });
      y += 22;

      doc.moveTo(tableLeft, y).lineTo(doc.page.width - 50, y).strokeColor("#cccccc").lineWidth(0.5).stroke();
      y += 6;

      doc.rect(colValue - 120, y, 208, 22).fill("#1a5276");
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Total:", colValue - 112, y + 5, { width: 120, lineBreak: false });
      doc.text(`$${data.monthlyTotal.toFixed(2)}`, colValue + 8, y + 5, { width: 80, align: "right", lineBreak: false });
      y += 32;
    }

    y = renderComments(doc, data.comments, y, pageWidth);
    renderFooter(doc, pageWidth);
    doc.end();
  });
}
