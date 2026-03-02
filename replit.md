# Excel Aquatics Invoice Manager

## Overview
Invoice management system for Excel Aquatics swimming school in Colonie, NY. Generates PDF invoices for families whose lessons are paid via direct billing.

## Features
- **Two Invoice Types**:
  - **Attendance Dates**: Select individual dates on calendar, rate per class, auto-grouped by month
  - **Monthly Charge**: Enter month, year, lesson day, and a flat monthly total
- **Invoice Creation**: Enter student name, class day/time, choose invoice type, fill in details, add comments, generate PDF
- **PDF Generation**: Server-side PDF creation with pdfkit. Includes Excel Aquatics logo, student info, and type-specific content
- **Invoice History**: View past invoices (shows type), re-download PDFs, delete records

## Architecture
- **Frontend**: React + Vite + shadcn/ui + TanStack Query + wouter
- **Backend**: Express on port 5000
- **Database**: PostgreSQL via Drizzle ORM
- **PDF**: pdfkit (server-side)

## Key Files
- `shared/schema.ts` - Data models (invoices)
- `server/routes.ts` - API endpoints
- `server/pdf.ts` - PDF generation logic
- `server/storage.ts` - Database CRUD operations
- `client/src/pages/home.tsx` - Main page with tabs
- `client/src/components/invoice-form.tsx` - Invoice creation form
- `client/src/components/invoice-history.tsx` - Invoice history table

## API Endpoints
- `GET /api/invoices` - List invoices
- `POST /api/invoices/generate` - Generate PDF invoice and save record
- `DELETE /api/invoices/:id` - Delete invoice
