import { Resend } from "resend";
import type { Invoice, Family } from "@shared/schema";
import { renderTemplate, type EmailTemplate, type TemplateVars } from "@shared/email-template";

const BUSINESS_NAME = "Excel Aquatics";

// Resend API key is provided via the Railway variable `Invoice_Email`.
const RESEND_API_KEY = process.env.Invoice_Email;

// From address must be on a domain verified in Resend. Override via EMAIL_FROM.
const EMAIL_FROM = process.env.EMAIL_FROM || "Excel Aquatics <invoices@goswimexcel.com>";
// Replies go here. Override via EMAIL_REPLY_TO.
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "info@goswimexcel.com";

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error(
      "Email is not configured: the Resend API key (Railway variable Invoice_Email) is missing.",
    );
  }
  if (!resendClient) {
    resendClient = new Resend(RESEND_API_KEY);
  }
  return resendClient;
}

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

/** Split a full student name into first and last for personalization. */
export function splitStudentName(fullName: string): { first: string; last: string } {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface BuildEmailArgs {
  invoice: Invoice;
  family: Family | null;
  to: string[];
  cc?: string[];
  replyTo?: string;
  from?: string;
  template: EmailTemplate;
  period: { month: string; year: string; monthYear: string };
  pdfBuffer: Buffer;
}

/** Render a plain-text template body into a styled HTML email body. */
function renderHtmlBody(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`)
    .join("\n    ");
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5;">
    ${paragraphs}
  </div>`;
}

export interface BuiltEmail {
  from: string;
  to: string[];
  cc?: string[];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  attachments: { filename: string; content: Buffer }[];
}

/**
 * Builds the full email payload (subject, body, attachment) without sending it.
 * Exposed separately so it can be unit-tested without hitting the network.
 */
export function buildInvoiceEmail(args: BuildEmailArgs): BuiltEmail {
  const { invoice, to, cc, pdfBuffer, template, period } = args;
  const docLabel = invoice.documentType === "receipt" ? "Receipt" : "Invoice";
  const { first, last } = splitStudentName(invoice.studentName);

  const amount =
    invoice.invoiceType === "monthly"
      ? invoice.monthlyTotal
        ? `$${parseFloat(invoice.monthlyTotal).toFixed(2)}`
        : ""
      : invoice.ratePerClass
        ? `$${parseFloat(invoice.ratePerClass).toFixed(2)}/class`
        : "";

  const vars: TemplateVars = {
    firstName: first,
    lastName: last,
    studentName: invoice.studentName,
    documentType: docLabel.toLowerCase(),
    DocumentType: docLabel,
    invoiceNumber: invoice.invoiceNumber,
    amount,
    classDayTime: invoice.classDayTime || "",
    month: period.month,
    year: period.year,
    monthYear: period.monthYear,
    period: period.monthYear,
    businessName: BUSINESS_NAME,
  };

  const subject = renderTemplate(template.subject, vars).trim();
  const text = renderTemplate(template.body, vars);
  const html = renderHtmlBody(text);

  const filename = `${invoice.documentType === "receipt" ? "receipt" : "invoice"}-${invoice.invoiceNumber}.pdf`;

  return {
    from: args.from || EMAIL_FROM,
    to,
    cc: cc && cc.length > 0 ? cc : undefined,
    replyTo: args.replyTo || EMAIL_REPLY_TO,
    subject,
    html,
    text,
    attachments: [{ filename, content: pdfBuffer }],
  };
}

export interface SendResult {
  messageId: string | null;
  email: BuiltEmail;
}

/** Builds and sends the invoice email via Resend. Throws on failure. */
export async function sendInvoiceEmail(args: BuildEmailArgs): Promise<SendResult> {
  const email = buildInvoiceEmail(args);
  const client = getClient();

  const { data, error } = await client.emails.send({
    from: email.from,
    to: email.to,
    cc: email.cc,
    replyTo: email.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: email.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send the email");
  }

  return { messageId: data?.id ?? null, email };
}
