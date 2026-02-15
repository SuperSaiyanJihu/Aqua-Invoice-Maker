# Excel Aquatics Invoice Manager

## Overview
Invoice management system for Excel Aquatics swimming school in Colonie, NY. Generates PDF invoices for families whose lessons are paid via direct billing.

## Features
- **Student Management**: Add, edit, delete students with class day/time and rate per class
- **Invoice Creation**: Select a student (or enter manually), pick attendance dates on a calendar, add comments, generate PDF
- **PDF Generation**: Server-side PDF creation with pdfkit. Dates auto-grouped by month. Includes logo, student info, itemized attendance, total cost, and comments
- **Invoice History**: View past invoices, re-download PDFs, delete records

## Architecture
- **Frontend**: React + Vite + shadcn/ui + TanStack Query + wouter
- **Backend**: Express on port 5000
- **Database**: PostgreSQL via Drizzle ORM
- **PDF**: pdfkit (server-side)

## Key Files
- `shared/schema.ts` - Data models (students, invoices)
- `server/routes.ts` - API endpoints
- `server/pdf.ts` - PDF generation logic
- `server/storage.ts` - Database CRUD operations
- `server/seed.ts` - Seed data (4 sample students)
- `client/src/pages/home.tsx` - Main page with tabs
- `client/src/components/invoice-form.tsx` - Invoice creation form
- `client/src/components/student-manager.tsx` - Student CRUD UI
- `client/src/components/invoice-history.tsx` - Invoice history table

## API Endpoints
- `GET /api/students` - List students
- `POST /api/students` - Create student
- `PATCH /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `GET /api/invoices` - List invoices
- `POST /api/invoices/generate` - Generate PDF invoice and save record
- `DELETE /api/invoices/:id` - Delete invoice
