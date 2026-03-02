# Excel Aquatics Invoice Manager

## Overview
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
- **Backend**: Express on port 5000
- **Database**: PostgreSQL via Drizzle ORM
- **PDF**: pdfkit (server-side)

## Key Files
- `shared/schema.ts` - Data models (invoices table with documentType column)
- `server/routes.ts` - API endpoints
- `server/pdf.ts` - PDF generation logic (renders INVOICE or RECEIPT in header)
- `server/storage.ts` - Database CRUD operations
- `client/src/pages/home.tsx` - Main page with tabs
- `client/src/components/invoice-form.tsx` - Invoice creation form with document type toggle
- `client/src/components/invoice-history.tsx` - Document history table with type badges

## API Endpoints
- `GET /api/invoices` - List invoices
- `POST /api/invoices/generate` - Generate PDF document (accepts `documentType: "invoice" | "receipt"`) and save record
- `DELETE /api/invoices/:id` - Delete invoice
