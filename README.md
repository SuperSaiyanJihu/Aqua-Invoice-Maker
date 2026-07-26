# Excel Aquatics Invoice Manager

Invoice management system for Excel Aquatics swimming school in Colonie, NY. Generates PDF invoices and receipts for families whose lessons are paid via direct billing.

## Features

- **Two Document Types**: Invoice or Receipt — toggle changes the PDF header text
- **Two Billing Types**:
  - **Attendance Dates**: Select individual dates on calendar, rate per class, auto-grouped by month
  - **Monthly Charge**: Enter month, year, lesson day, and a flat monthly total
- **Document Creation**: Enter student name, class day/time, choose document type and billing type, fill in details, add comments, generate PDF
- **PDF Generation**: Server-side PDF creation with pdfkit. Includes Excel Aquatics logo, student info, and type-specific content. Single-page enforced.
- **Document History**: View past invoices/receipts (shows document type and billing type badges), re-download PDFs, delete records
- **Excel Aquatics SSO**: Clerk sign-in shared with the other staff apps
- **Controlled Access**: Admins authorize an email and Clerk invites new identities
- **Protected Superadmin**: `info@goswimexcel.com` receives permanent superadmin access

## Architecture

- **Frontend**: React + Vite + shadcn/ui + TanStack Query + wouter
- **Backend**: Express on configurable PORT (default 5000)
- **Database**: PostgreSQL via Drizzle ORM
- **PDF**: pdfkit (server-side)

## Environment Variables

| Variable       | Required | Description                          |
|----------------|----------|--------------------------------------|
| `DATABASE_URL` | Yes      | PostgreSQL connection string         |
| `PORT`         | No       | Server port (default: 5000)          |
| `SESSION_SECRET` | Yes | Random value of at least 32 characters |
| `CLERK_SECRET_KEY` | Yes | Secret key for the shared Clerk application |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Publishable key from the same Clerk application |
| `SUPER_ADMIN_EMAIL` | Yes | Permanent owner email (`info@goswimexcel.com`) |
| `APP_URL` | Yes | Canonical deployed URL used for invitations and OAuth |
| `ALLOW_GOOGLE_BREAK_GLASS` | No | Set `true` only to enable Google superadmin recovery |
| `GOOGLE_CLIENT_ID` | Conditional | Required when Google recovery is enabled |
| `GOOGLE_CLIENT_SECRET` | Conditional | Required when Google recovery is enabled |

Clerk is the normal login path. Google OAuth is intentionally limited to the
configured superadmin and should be enabled only as a monitored recovery route.
Add users from **Users → Add User**. Existing Clerk identities are authorized
immediately; new identities receive a Clerk invitation.

## Local Development

```bash
npm install
npm run dev
```

## Deployment (Railway)

This app is configured for Railway deployment via `railway.json`:

1. Connect the GitHub repo to a Railway project
2. Add a PostgreSQL plugin in Railway
3. Railway automatically sets `DATABASE_URL`
4. The app builds and starts via the commands in `railway.json`

To push the database schema:

```bash
npm run db:push
```

## API Endpoints

- `GET /api/invoices` — List invoices
- `GET /api/invoices/:id/pdf` — Download PDF for an existing invoice
- `POST /api/invoices/generate` — Generate PDF document and save record
- `DELETE /api/invoices/:id` — Delete invoice
