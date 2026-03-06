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
