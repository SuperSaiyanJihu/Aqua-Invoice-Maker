/**
 * Email feature test.
 *
 *   Dry run (no network, no API key needed — safe for CI):
 *     npx tsx script/test-email.ts
 *
 *   Live send (actually delivers through Resend):
 *     Invoice_Email=re_xxx npx tsx script/test-email.ts --live --to you@example.com
 *
 * The dry run asserts the email payload is correct (student first + last name in
 * subject/body, exactly one PDF attachment, reply-to set, to/cc wired from the
 * family record). The live run additionally performs a real end-to-end send and
 * prints the Resend message id.
 */
import { buildInvoiceEmail, sendInvoiceEmail, splitStudentName } from "../server/email";
import { generateInvoicePdf } from "../server/pdf";
import type { Invoice, Family } from "../shared/schema";

const args = process.argv.slice(2);
const live = args.includes("--live");
const toArg = args[args.indexOf("--to") + 1];

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures++;
  }
}

// --- Sample data ---
const sampleInvoice: Invoice = {
  id: 999,
  invoiceNumber: "EA-20260613-TEST",
  invoiceType: "attendance",
  documentType: "invoice",
  studentName: "Jordan Rivera",
  classDayTime: "Tuesdays 5:00 PM",
  ratePerClass: "35.00",
  attendanceDates: ["2026-06-02", "2026-06-09", "2026-06-16"],
  monthlyMonth: null,
  monthlyYear: null,
  monthlyDay: null,
  monthlyTotal: null,
  comments: "Test invoice — please ignore.",
  familyId: 1,
  createdAt: new Date(),
};

const sampleFamily: Family = {
  id: 1,
  familyName: "Rivera Family",
  studentNames: "Jordan Rivera",
  classDayTime: "Tuesdays 5:00 PM",
  billingType: "attendance",
  documentType: "invoice",
  ratePerClass: "35.00",
  monthlyTotal: null,
  emailAddresses: ["parent@example.com"],
  brokerEmails: ["broker@example.com"],
  notes: null,
  reminderFrequency: "monthly",
  reminderDayOfMonth: 1,
  reminderDayOfWeek: null,
  reminderAnchorDate: null,
  reminderTargetOffset: "previous",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function main() {
  console.log("Generating sample invoice PDF...");
  const pdfBuffer = await generateInvoicePdf({
    invoiceType: "attendance",
    documentType: "invoice",
    invoiceNumber: sampleInvoice.invoiceNumber,
    studentName: sampleInvoice.studentName,
    classDayTime: sampleInvoice.classDayTime,
    ratePerClass: parseFloat(sampleInvoice.ratePerClass),
    attendanceDates: sampleInvoice.attendanceDates,
    comments: sampleInvoice.comments,
  });

  const { first, last } = splitStudentName(sampleInvoice.studentName);

  console.log("\nDry-run payload assertions:");
  const email = buildInvoiceEmail({
    invoice: sampleInvoice,
    family: sampleFamily,
    to: sampleFamily.emailAddresses,
    cc: sampleFamily.brokerEmails,
    periodLabel: "June 2026",
    pdfBuffer,
  });

  check(`first name parsed ("${first}")`, first === "Jordan");
  check(`last name parsed ("${last}")`, last === "Rivera");
  check("subject contains first name", email.subject.includes(first));
  check("subject contains last name", email.subject.includes(last));
  check("subject contains invoice number", email.subject.includes(sampleInvoice.invoiceNumber));
  check("body (html) contains full student name", email.html.includes(`${first} ${last}`));
  check("body (text) contains full student name", email.text.includes(`${first} ${last}`));
  check("body mentions the billing period", email.html.includes("June 2026"));
  check("recipients (to) = family parent emails", JSON.stringify(email.to) === JSON.stringify(sampleFamily.emailAddresses));
  check("cc = family broker emails", JSON.stringify(email.cc) === JSON.stringify(sampleFamily.brokerEmails));
  check("reply-to is set", !!email.replyTo && email.replyTo.includes("@"));
  check("from address is set", !!email.from && email.from.includes("@"));
  check("exactly one attachment", email.attachments.length === 1);
  check("attachment is a PDF", email.attachments[0]?.filename.endsWith(".pdf"));
  check("attachment has content", (email.attachments[0]?.content?.length ?? 0) > 100);

  console.log(`\n  From:     ${email.from}`);
  console.log(`  Reply-To: ${email.replyTo}`);
  console.log(`  Subject:  ${email.subject}`);
  console.log(`  Attach:   ${email.attachments[0]?.filename} (${email.attachments[0]?.content.length} bytes)`);

  if (live) {
    if (!toArg) {
      console.error("\n--live requires --to <email>");
      process.exit(1);
    }
    if (!process.env.Invoice_Email) {
      console.error("\n--live requires the Invoice_Email (Resend API key) env var");
      process.exit(1);
    }
    console.log(`\nSending a real test email to ${toArg} ...`);
    const result = await sendInvoiceEmail({
      invoice: sampleInvoice,
      family: sampleFamily,
      to: [toArg],
      cc: [],
      periodLabel: "June 2026",
      pdfBuffer,
    });
    check("Resend returned a message id", !!result.messageId);
    console.log(`  Resend message id: ${result.messageId}`);
  } else {
    console.log("\n(Skipping live send — pass --live --to <email> to actually deliver.)");
  }

  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED.`);
    process.exit(1);
  }
  console.log("All checks passed. ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
