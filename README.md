# Excel Aquatics Invoice Maker

Invoice and receipt generator for Excel Aquatics swim school (Colonie, NY). Supports attendance-based and monthly billing, server-side PDF generation, and document history.

## Tech Stack

- **Frontend:** React + Vite + shadcn/ui + TanStack Query + Wouter
- **Backend:** Express (Node.js)
- **Database:** PostgreSQL via Drizzle ORM
- **PDF Generation:** pdfkit (server-side)
- **Language:** TypeScript throughout

---

## Deploying to Railway (Step-by-Step)

### Prerequisites
- Your code pushed to GitHub (this repo)
- A free [Railway account](https://railway.app) — sign up with GitHub

---

### Step 1 — Create a New Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"** in the top right
3. Select **"Deploy from GitHub repo"**
4. Find and select **`Aqua-Invoice-Maker`** from the list
5. Click **"Deploy Now"**

Railway will immediately start trying to build. That's fine — it will fail at first because we haven't added the database yet. Continue to Step 2.

---

### Step 2 — Add a PostgreSQL Database

1. Inside your Railway project, click **"+ New"** (top right of the project canvas)
2. Select **"Database"**
3. Select **"Add PostgreSQL"**
4. Railway will spin up a Postgres instance and automatically create a `DATABASE_URL` variable

To verify the variable was created:
- Click on the **Postgres** service in your project canvas
- Go to the **"Variables"** tab
- You should see `DATABASE_URL` listed there

---

### Step 3 — Link DATABASE_URL to Your App

Railway keeps service variables separate. You need to share the database URL with your app service:

1. Click on your **app service** (not the Postgres one) in the project canvas
2. Go to the **"Variables"** tab
3. Click **"+ New Variable"**
4. In the variable name field, type: `DATABASE_URL`
5. In the value field, click the **"Add Reference"** button (the link icon)
6. Select the Postgres service's `DATABASE_URL`
7. Click **"Add"**

Also add this variable while you're here:
- Name: `NODE_ENV`
- Value: `production`

---

### Step 4 — Trigger a Redeploy

1. Go to your app service's **"Deployments"** tab
2. Click the **"Redeploy"** button on the most recent deployment (or just push a new commit to GitHub)
3. Watch the build logs — it should now successfully run `npm install && npm run build`

---

### Step 5 — Run the Database Migration (One Time Only)

Once the app deploys successfully, you need to create the database tables:

1. Click on your **app service** in the Railway canvas
2. Click the **"Settings"** tab
3. Scroll down to find the **"Deploy"** section, then look for the **shell** option — OR use the Railway CLI (see below)

**Using the Railway CLI (recommended):**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Log in
railway login

# Link to your project (run from inside the project folder)
railway link

# Run the migration
railway run npm run db:push
```

**Alternatively, temporarily change the start command:**
1. In your app service → Settings → Deploy → Start Command
2. Change it to: `npm run db:push && npm run start`
3. Redeploy once
4. After the tables are created, change it back to: `npm run start`

---

### Step 6 — Get Your Public URL

1. Click on your app service
2. Go to the **"Settings"** tab
3. Under **"Networking"**, click **"Generate Domain"**
4. Railway will give you a URL like `aqua-invoice-maker-production.up.railway.app`
5. Open it in your browser — the app should be live!

---

## Local Development

### 1. Clone and install
```bash
git clone https://github.com/SuperSaiyanJihu/Aqua-Invoice-Maker.git
cd Aqua-Invoice-Maker
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env and fill in your DATABASE_URL
```

You can get a free local Postgres from:
- [Postgres.app](https://postgresapp.com) (Mac)
- `brew install postgresql` (Mac with Homebrew)
- Docker: `docker run --name aqua-pg -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres`

Your local `DATABASE_URL` would look like:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/aqua_invoices
```

### 3. Create the database tables
```bash
npm run db:push
```

### 4. Start the dev server
```bash
npm run dev
```

App will be available at `http://localhost:5000`

---

## Project Structure

```
├── client/                  # React frontend
│   ├── public/images/       # Logo and static assets
│   └── src/
│       ├── components/      # invoice-form.tsx, invoice-history.tsx, ui/
│       ├── pages/           # home.tsx, not-found.tsx
│       └── lib/             # queryClient.ts, utils.ts
├── server/                  # Express backend
│   ├── index.ts             # App entry point
│   ├── routes.ts            # API endpoints
│   ├── pdf.ts               # pdfkit PDF generation
│   ├── storage.ts           # Database CRUD via Drizzle
│   ├── db.ts                # PostgreSQL connection
│   └── static.ts            # Serve built frontend in production
├── shared/
│   └── schema.ts            # Drizzle schema + Zod types (shared by client + server)
├── script/
│   └── build.ts             # Custom build script (Vite + esbuild)
├── railway.json             # Railway deployment config
├── .env.example             # Environment variable template
└── package.json
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/invoices` | List all invoices/receipts |
| `POST` | `/api/invoices/generate` | Generate a new PDF and save record |
| `GET` | `/api/invoices/:id/pdf` | Re-download PDF for existing record |
| `DELETE` | `/api/invoices/:id` | Delete a record |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `PORT` | No | Server port (default: 5000; Railway sets this automatically) |
| `NODE_ENV` | No | Set to `production` when deploying |
