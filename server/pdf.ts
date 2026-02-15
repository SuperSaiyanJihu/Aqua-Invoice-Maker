import PDFDocument from "pdfkit";
import { format, parseISO } from "date-fns";
import path from "path";
import fs from "fs";

interface InvoiceData {
  studentName: string;
  classDayTime: string;
  ratePerClass: number;
  attendanceDates: string[];
  comments: string | null;
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
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 80 });
    }

    doc.fontSize(20).font("Helvetica-Bold").fillColor("#1a5276");
    doc.text("Excel Aquatics", 140, 50);
    doc.fontSize(10).font("Helvetica").fillColor("#555555");
    doc.text("Colonie, NY", 140, 75);

    doc.fontSize(22).font("Helvetica-Bold").fillColor("#1a5276");
    doc.text("INVOICE", doc.page.width - 200, 50, { width: 150, align: "right" });

    doc.fontSize(9).font("Helvetica").fillColor("#666666");
    doc.text(`Date: ${format(new Date(), "MMMM d, yyyy")}`, doc.page.width - 200, 78, { width: 150, align: "right" });

    doc.moveTo(50, 110).lineTo(doc.page.width - 50, 110).strokeColor("#1a5276").lineWidth(2).stroke();

    let y = 130;

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333");
    doc.text("Bill To:", 50, y);
    y += 18;

    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(`Student: ${data.studentName}`, 50, y);
    y += 16;
    doc.text(`Class: ${data.classDayTime}`, 50, y);
    y += 16;
    doc.text(`Rate per Class: $${data.ratePerClass.toFixed(2)}`, 50, y);
    y += 30;

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
    const colDesc = tableLeft + 160;
    const colRate = tableLeft + 380;
    const tableRight = doc.page.width - 50;

    doc.rect(tableLeft, y, pageWidth, 22).fill("#1a5276");
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text("Date", colDate + 8, y + 6, { width: 150 });
    doc.text("Description", colDesc + 8, y + 6, { width: 200 });
    doc.text("Amount", colRate + 8, y + 6, { width: 80, align: "right" });
    y += 22;

    let totalClasses = 0;
    let rowIndex = 0;

    for (const month of sortedMonths) {
      const dates = datesByMonth[month];

      doc.rect(tableLeft, y, pageWidth, 22).fill("#e8f0f8");
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a5276");
      doc.text(month, colDate + 8, y + 6, { width: pageWidth - 16 });
      y += 22;

      for (const dateStr of dates) {
        const d = parseISO(dateStr);

        if (rowIndex % 2 === 1) {
          doc.rect(tableLeft, y, pageWidth, 20).fill("#f8f9fa");
        }

        doc.fontSize(9).font("Helvetica").fillColor("#333333");
        doc.text(format(d, "EEEE, MMMM d, yyyy"), colDate + 8, y + 5, { width: 150 });
        doc.text("Swimming Lesson", colDesc + 8, y + 5, { width: 200 });
        doc.text(`$${data.ratePerClass.toFixed(2)}`, colRate + 8, y + 5, { width: 80, align: "right" });

        y += 20;
        totalClasses++;
        rowIndex++;

        if (y > doc.page.height - 150) {
          doc.addPage();
          y = 50;

          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 40, { width: 40 });
          }
          doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a5276");
          doc.text("Excel Aquatics — Invoice (continued)", 100, 50);
          y = 80;
        }
      }
    }

    doc.moveTo(tableLeft, y).lineTo(tableRight, y).strokeColor("#cccccc").lineWidth(0.5).stroke();
    y += 8;

    doc.rect(colRate - 80, y, 168, 24).fill("#1a5276");
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text(`Total (${totalClasses} classes):`, colRate - 72, y + 6, { width: 80 });
    doc.text(`$${(totalClasses * data.ratePerClass).toFixed(2)}`, colRate + 8, y + 6, { width: 80, align: "right" });
    y += 40;

    if (data.comments) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333");
      doc.text("Comments:", 50, y);
      y += 18;

      doc.rect(50, y, pageWidth, 2).fill("#e0e0e0");
      y += 8;

      doc.fontSize(10).font("Helvetica").fillColor("#555555");
      doc.text(data.comments, 50, y, { width: pageWidth });
      y += doc.heightOfString(data.comments, { width: pageWidth }) + 20;
    }

    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }

    const footerY = doc.page.height - 60;
    doc.moveTo(50, footerY - 10).lineTo(doc.page.width - 50, footerY - 10).strokeColor("#dddddd").lineWidth(0.5).stroke();
    doc.fontSize(8).font("Helvetica").fillColor("#999999");
    doc.text("Excel Aquatics — Colonie, NY", 50, footerY, { width: pageWidth, align: "center" });
    doc.text("Thank you for choosing Excel Aquatics!", 50, footerY + 12, { width: pageWidth, align: "center" });

    doc.end();
  });
}
