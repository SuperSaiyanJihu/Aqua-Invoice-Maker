import PDFDocument from "pdfkit";
import { format, parseISO } from "date-fns";
import path from "path";
import fs from "fs";

interface AttendanceInvoiceData {
  invoiceType: "attendance";
  studentName: string;
  classDayTime: string;
  ratePerClass: number;
  attendanceDates: string[];
  comments: string | null;
}

interface MonthlyInvoiceData {
  invoiceType: "monthly";
  studentName: string;
  classDayTime: string;
  monthlyMonth: string;
  monthlyYear: string;
  monthlyDay: string;
  monthlyTotal: number;
  comments: string | null;
}

type InvoiceData = AttendanceInvoiceData | MonthlyInvoiceData;

function renderHeader(doc: PDFKit.PDFDocument, logoPath: string) {
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 30, { width: 70 });
  }

  doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a5276");
  doc.text("Excel Aquatics", 130, 38);
  doc.fontSize(9).font("Helvetica").fillColor("#555555");
  doc.text("Colonie, NY", 130, 60);

  doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a5276");
  doc.text("INVOICE", doc.page.width - 200, 38, { width: 150, align: "right" });

  doc.fontSize(9).font("Helvetica").fillColor("#666666");
  doc.text(`Date: ${format(new Date(), "MMMM d, yyyy")}`, doc.page.width - 200, 60, { width: 150, align: "right" });

  doc.moveTo(50, 85).lineTo(doc.page.width - 50, 85).strokeColor("#1a5276").lineWidth(1.5).stroke();
}

function renderStudentInfo(doc: PDFKit.PDFDocument, data: InvoiceData, startY: number): number {
  let y = startY;

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333");
  doc.text("Bill To:", 50, y);
  y += 15;

  doc.fontSize(9).font("Helvetica").fillColor("#333333");
  doc.text(`Student: ${data.studentName}`, 50, y);
  y += 14;
  doc.text(`Class: ${data.classDayTime}`, 50, y);
  y += 14;

  if (data.invoiceType === "attendance") {
    doc.text(`Rate per Class: $${data.ratePerClass.toFixed(2)}`, 50, y);
    y += 20;
  } else {
    doc.text(`Lesson Day: ${data.monthlyDay}s`, 50, y);
    y += 14;
    doc.text(`Period: ${data.monthlyMonth} ${data.monthlyYear}`, 50, y);
    y += 20;
  }

  return y;
}

function renderComments(doc: PDFKit.PDFDocument, comments: string | null, y: number, pageWidth: number): number {
  if (!comments) return y;

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333");
  doc.text("Comments:", 50, y);
  y += 14;

  doc.rect(50, y, pageWidth, 1.5).fill("#e0e0e0");
  y += 6;

  doc.fontSize(9).font("Helvetica").fillColor("#555555");
  doc.text(comments, 50, y, { width: pageWidth });
  y += doc.heightOfString(comments, { width: pageWidth }) + 12;

  return y;
}

function renderFooter(doc: PDFKit.PDFDocument, pageWidth: number) {
  const footerY = doc.page.height - 50;
  doc.moveTo(50, footerY - 8).lineTo(doc.page.width - 50, footerY - 8).strokeColor("#dddddd").lineWidth(0.5).stroke();
  doc.fontSize(8).font("Helvetica").fillColor("#999999");
  doc.text("Excel Aquatics — Colonie, NY", 50, footerY, { width: pageWidth, align: "center" });
  doc.text("Thank you for choosing Excel Aquatics!", 50, footerY + 11, { width: pageWidth, align: "center" });
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100;
    const logoPath = path.join(process.cwd(), "client", "public", "images", "excel-aquatics-logo.png");

    renderHeader(doc, logoPath);
    let y = renderStudentInfo(doc, data, 98);

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
      doc.text("Date", colDate + 8, y + 4, { width: 350 });
      doc.text("Amount", colRate + 8, y + 4, { width: 80, align: "right" });
      y += 18;

      let totalClasses = 0;
      let rowIndex = 0;

      for (const month of sortedMonths) {
        const dates = datesByMonth[month];

        doc.rect(tableLeft, y, pageWidth, 18).fill("#e8f0f8");
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a5276");
        doc.text(month, colDate + 8, y + 4, { width: pageWidth - 16 });
        y += 18;

        for (const dateStr of dates) {
          const d = parseISO(dateStr);

          if (rowIndex % 2 === 1) {
            doc.rect(tableLeft, y, pageWidth, 16).fill("#f8f9fa");
          }

          doc.fontSize(8).font("Helvetica").fillColor("#333333");
          doc.text(format(d, "EEEE, MMMM d, yyyy"), colDate + 8, y + 4, { width: 350 });
          doc.text(`$${data.ratePerClass.toFixed(2)}`, colRate + 8, y + 4, { width: 80, align: "right" });

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
      doc.text(totalLabel, colRate - 112, y + 5, { width: 120 });
      doc.text(totalAmount, colRate + 8, y + 5, { width: 80, align: "right" });
      y += 32;
    } else {
      const tableLeft = 50;
      const colLabel = tableLeft;
      const colValue = tableLeft + 380;

      doc.rect(tableLeft, y, pageWidth, 18).fill("#1a5276");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Description", colLabel + 8, y + 4, { width: 350 });
      doc.text("Amount", colValue + 8, y + 4, { width: 80, align: "right" });
      y += 18;

      doc.rect(tableLeft, y, pageWidth, 22).fill("#f8f9fa");
      doc.fontSize(9).font("Helvetica").fillColor("#333333");
      doc.text(`${data.monthlyDay} lessons — ${data.monthlyMonth} ${data.monthlyYear}`, colLabel + 8, y + 6, { width: 350 });
      doc.text(`$${data.monthlyTotal.toFixed(2)}`, colValue + 8, y + 6, { width: 80, align: "right" });
      y += 22;

      doc.moveTo(tableLeft, y).lineTo(doc.page.width - 50, y).strokeColor("#cccccc").lineWidth(0.5).stroke();
      y += 6;

      doc.rect(colValue - 120, y, 208, 22).fill("#1a5276");
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff");
      doc.text("Total:", colValue - 112, y + 5, { width: 120 });
      doc.text(`$${data.monthlyTotal.toFixed(2)}`, colValue + 8, y + 5, { width: 80, align: "right" });
      y += 32;
    }

    y = renderComments(doc, data.comments, y, pageWidth);
    renderFooter(doc, pageWidth);
    doc.end();
  });
}
