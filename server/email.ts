import { Resend } from "resend";
import type { Invoice, Family } from "@shared/schema";

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
  periodLabel?: string | null;
  pdfBuffer: Buffer;
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
  const { invoice, to, cc, pdfBuffer, periodLabel } = args;
  const docLabel = invoice.documentType === "receipt" ? "Receipt" : "Invoice";
  const { first, last } = splitStudentName(invoice.studentName);
  const greetingName = [first, last].filter(Boolean).join(" ") || "there";

  const amount =
    invoice.invoiceType === "monthly"
      ? invoice.monthlyTotal
        ? `$${parseFloat(invoice.monthlyTotal).toFixed(2)}`
        : null
      : invoice.ratePerClass
        ? `$${parseFloat(invoice.ratePerClass).toFixed(2)}/class`
        : null;

  const periodText = periodLabel ? ` for ${periodLabel}` : "";
  const subject = `Excel Aquatics ${docLabel} ${invoice.invoiceNumber} — ${first} ${last}`.trim();

  const filename = `${invoice.documentType === "receipt" ? "receipt" : "invoice"}-${invoice.invoiceNumber}.pdf`;

  const lines = [
    `Hello,`,
    ``,
    `Please find attached the ${docLabel.toLowerCase()} for ${greetingName}${periodText}.`,
    invoice.classDayTime ? `Class: ${invoice.classDayTime}` : "",
    amount ? `Amount: ${amount}` : "",
    `${docLabel} number: ${invoice.invoiceNumber}`,
    ``,
    `If you have any questions, simply reply to this email.`,
    ``,
    `Thank you,`,
    `Excel Aquatics`,
    `Colonie, NY`,
  ].filter((l) => l !== "" || true);

  const text = lines.join("\n");

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <p>Hello,</p>
    <p>Please find attached the ${escapeHtml(docLabel.toLowerCase())} for
      <strong>${escapeHtml(greetingName)}</strong>${escapeHtml(periodText)}.</p>
    <table style="border-collapse: collapse; margin: 12px 0;">
      ${invoice.classDayTime ? `<tr><td style="padding:2px 12px 2px 0; color:#555;">Class</td><td style="padding:2px 0;"><strong>${escapeHtml(invoice.classDayTime)}</strong></td></tr>` : ""}
      ${amount ? `<tr><td style="padding:2px 12px 2px 0; color:#555;">Amount</td><td style="padding:2px 0;"><strong>${escapeHtml(amount)}</strong></td></tr>` : ""}
      <tr><td style="padding:2px 12px 2px 0; color:#555;">${escapeHtml(docLabel)} #</td><td style="padding:2px 0;"><strong>${escapeHtml(invoice.invoiceNumber)}</strong></td></tr>
    </table>
    <p>If you have any questions, simply reply to this email.</p>
    <p style="margin-top:20px;">Thank you,<br/>
      <strong style="color:#1a5276;">Excel Aquatics</strong><br/>
      <span style="color:#555;">Colonie, NY</span>
    </p>
  </div>`;

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
