// Shared, dependency-free email-template helpers used by BOTH the server (when
// actually sending an invoice email) and the client (live preview in Settings).
// Keeping rendering here guarantees the preview matches exactly what is sent.

export interface TemplateVars {
  firstName: string;
  lastName: string;
  studentName: string;
  documentType: string; // "invoice" | "receipt" (lowercase)
  DocumentType: string; // "Invoice" | "Receipt" (capitalized)
  invoiceNumber: string;
  amount: string; // e.g. "$120.00" or "$30.00/class"
  classDayTime: string;
  month: string; // e.g. "April" or "April–June"
  year: string; // e.g. "2026" or "2025–2026"
  monthYear: string; // smart label, e.g. "April 2026"
  period: string; // alias of monthYear
  businessName: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

/**
 * Default template. Reproduces the historical hardcoded wording but adds the
 * billing period (`{monthYear}`) to the body sentence. The period is kept out of
 * the subject so a missing period never leaves a dangling artifact there.
 */
export const DEFAULT_EMAIL_TEMPLATE: EmailTemplate = {
  subject: "Excel Aquatics {DocumentType} {invoiceNumber} — {studentName}",
  body: [
    "Hello,",
    "",
    "Please find attached the {documentType} for {studentName} for {monthYear}.",
    "Class: {classDayTime}",
    "Amount: {amount}",
    "{DocumentType} number: {invoiceNumber}",
    "",
    "If you have any questions, simply reply to this email.",
    "",
    "Thank you,",
    "{businessName}",
    "Colonie, NY",
  ].join("\n"),
};

export interface PlaceholderDef {
  token: string;
  description: string;
}

/** The placeholders offered in the editor's clickable reference. */
export const PLACEHOLDERS: PlaceholderDef[] = [
  { token: "studentName", description: "Student's full name" },
  { token: "firstName", description: "Student's first name" },
  { token: "lastName", description: "Student's last name" },
  { token: "documentType", description: '"invoice" or "receipt" (lowercase)' },
  { token: "DocumentType", description: '"Invoice" or "Receipt" (capitalized)' },
  { token: "invoiceNumber", description: "The document number" },
  { token: "amount", description: "Amount due (e.g. $120.00 or $30.00/class)" },
  { token: "classDayTime", description: "Class day and time" },
  { token: "month", description: "Billing month (e.g. April)" },
  { token: "year", description: "Billing year (e.g. 2026)" },
  { token: "monthYear", description: "Billing month and year (e.g. April 2026)" },
  { token: "period", description: "Same as monthYear" },
  { token: "businessName", description: "Your business name" },
];

/** Sample values for the Settings live preview. */
export const SAMPLE_VARS: TemplateVars = {
  firstName: "Emma",
  lastName: "Johnson",
  studentName: "Emma Johnson",
  documentType: "invoice",
  DocumentType: "Invoice",
  invoiceNumber: "EA-20260601-A1B2",
  amount: "$120.00",
  classDayTime: "Tuesdays 4:00 PM",
  month: "April",
  year: "2026",
  monthYear: "April 2026",
  period: "April 2026",
  businessName: "Excel Aquatics",
};

/**
 * Replaces every `{token}` in `text` with the matching value from `vars`.
 * Unknown or undefined tokens render as an empty string.
 */
export function renderTemplate(text: string, vars: Partial<TemplateVars>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = (vars as Record<string, unknown>)[key];
    return value == null ? "" : String(value);
  });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Derives a smart month/year label from a list of ISO date strings
 * (e.g. "2026-04-15"). Handles single-month, multi-month within one year, and
 * cross-year spans. Returns empty strings when no valid dates are present.
 */
export function deriveMonthYearFromDates(dates: string[]): {
  month: string;
  year: string;
  monthYear: string;
} {
  const valid = (dates || [])
    .filter((d) => typeof d === "string" && /^\d{4}-\d{2}/.test(d))
    .sort();

  if (valid.length === 0) return { month: "", year: "", monthYear: "" };

  const first = valid[0];
  const last = valid[valid.length - 1];
  const fy = first.slice(0, 4);
  const fm = MONTH_NAMES[parseInt(first.slice(5, 7), 10) - 1];
  const ly = last.slice(0, 4);
  const lm = MONTH_NAMES[parseInt(last.slice(5, 7), 10) - 1];

  if (fy === ly && fm === lm) {
    return { month: fm, year: fy, monthYear: `${fm} ${fy}` };
  }
  if (fy === ly) {
    return { month: `${fm}–${lm}`, year: fy, monthYear: `${fm}–${lm} ${fy}` };
  }
  return {
    month: `${fm}–${lm}`,
    year: `${fy}–${ly}`,
    monthYear: `${fm} ${fy} – ${lm} ${ly}`,
  };
}
