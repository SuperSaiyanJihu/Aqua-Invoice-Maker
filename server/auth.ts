import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { randomBytes, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import { pool } from "./db";
import { z } from "zod";
import {
  exchangeGoogleCode,
  googleAuthUrl,
  isGoogleOAuthConfigured,
} from "./googleAuth";

const emailSchema = z.string().trim().email().transform((email) => email.toLowerCase());

function superAdminEmail(): string {
  return (process.env.SUPER_ADMIN_EMAIL || "info@goswimexcel.com")
    .trim()
    .toLowerCase();
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionUser(req: Request) {
  return {
    username: req.session.username,
    email: req.session.username,
    isAdmin: req.session.isAdmin ?? false,
    isSuperAdmin: req.session.isSuperAdmin ?? false,
    authMethod: req.session.authMethod,
    mustChangePin: false,
  };
}

// connect-pg-simple's default table; sessions store the lowercased email in sess->>'username'.
async function revokeSessionsFor(email: string) {
  await pool.query(`DELETE FROM "session" WHERE sess->>'username' = $1`, [
    email.toLowerCase(),
  ]);
}

async function establishSession(
  req: Request,
  identity: {
    email: string;
    userId?: number;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    authMethod: "google";
  },
) {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
  req.session.authenticated = true;
  req.session.username = identity.email;
  req.session.userId = identity.userId;
  req.session.isAdmin = identity.isAdmin;
  req.session.isSuperAdmin = identity.isSuperAdmin;
  req.session.authMethod = identity.authMethod;
  req.session.mustChangePin = false;
}

export async function setupAuth(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters in production");
    }
    if (!isGoogleOAuthConfigured() || !process.env.APP_URL?.trim()) {
      throw new Error(
        "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_URL are required for Google sign-in",
      );
    }
    if (!process.env.SUPER_ADMIN_EMAIL?.trim()) {
      throw new Error("SUPER_ADMIN_EMAIL is required in production");
    }
    app.set("trust proxy", 1);
  }

  const PgStore = connectPgSimple(session);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "local-development-session-secret-only",
      resave: false,
      saveUninitialized: false,
      store: new PgStore({ pool, createTableIfMissing: true }),
      cookie: {
        maxAge: 8 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      },
    }),
  );

  await storage.ensureEmailTemplatesTable();
  await storage.backfillArchivedPeriods();

  app.get("/api/auth/google", (req, res) => {
    if (!isGoogleOAuthConfigured()) {
      return res.status(404).json({ message: "Google sign-in is not configured" });
    }
    const state = randomBytes(32).toString("hex");
    req.session.googleOAuthState = state;
    return res.redirect(googleAuthUrl(state));
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    if (!isGoogleOAuthConfigured()) {
      return res.redirect("/?error=auth_failed");
    }
    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const expected = req.session.googleOAuthState || "";
      delete req.session.googleOAuthState;
      if (!code || !state || !expected || !safeEqual(state, expected)) {
        return res.redirect("/?error=auth_failed");
      }

      const identity = await exchangeGoogleCode(code);
      if (!identity.emailVerified) {
        return res.redirect("/?error=email_unverified");
      }
      const isSuperAdmin = identity.email === superAdminEmail();
      const user = isSuperAdmin ? undefined : await storage.getUser(identity.email);
      if (!isSuperAdmin && !user) {
        return res.redirect("/?error=unauthorized");
      }
      await establishSession(req, {
        email: identity.email,
        userId: user?.id,
        isAdmin: isSuperAdmin || Boolean(user?.isAdmin),
        isSuperAdmin,
        authMethod: "google",
      });
      return res.redirect("/");
    } catch (error: any) {
      console.error("[AUTH] Google sign-in failed:", error?.message || error);
      return res.redirect("/?error=auth_failed");
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((error) => {
      if (error) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.session.authenticated) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    return res.json({ user: sessionUser(req) });
  });

  // Retired explicitly so old bookmarked clients cannot silently downgrade auth.
  app.post("/api/login", (_req, res) =>
    res.status(410).json({ message: "PIN login has been replaced by Google sign-in" }),
  );
  app.post("/api/change-pin", (_req, res) =>
    res.status(410).json({ message: "PIN login has been replaced by Google sign-in" }),
  );
  app.post("/api/auth/clerk", (_req, res) =>
    res.status(410).json({ message: "Clerk SSO has been replaced by Google sign-in" }),
  );

  app.use("/api/admin", requireAuth, requireAdmin);

  const createUserSchema = z.object({
    email: emailSchema,
    isAdmin: z.boolean().default(false),
  });
  const updateUserSchema = z.object({
    email: emailSchema.optional(),
    isAdmin: z.boolean().optional(),
  });

  app.get("/api/admin/users", async (_req, res) => {
    const users = await storage.getAllUsers();
    const sanitized = users
      .filter((user) => z.string().email().safeParse(user.username).success)
      .filter((user) => user.username.toLowerCase() !== superAdminEmail())
      .map(({ passwordHash, ...user }) => ({
        ...user,
        email: user.username,
        isSuperAdmin: false,
      }));
    res.json([
      {
        id: 0,
        username: superAdminEmail(),
        email: superAdminEmail(),
        isAdmin: true,
        isSuperAdmin: true,
        mustChangePin: false,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      ...sanitized,
    ]);
  });

  app.post("/api/admin/users", async (req, res) => {
    try {
      const data = createUserSchema.parse(req.body);
      if (data.email === superAdminEmail()) {
        return res.status(400).json({ message: "The superadmin already has permanent access" });
      }
      if (await storage.getUser(data.email)) {
        return res.status(409).json({ message: "That email already has access" });
      }

      const unusableHash = await bcrypt.hash(
        `google-only:${randomBytes(32).toString("hex")}`,
        10,
      );
      const user = await storage.createUser(data.email, unusableHash, data.isAdmin, false);
      const { passwordHash, ...sanitized } = user;
      return res.status(201).json({ ...sanitized, email: user.username });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/users/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id)) return res.status(400).json({ message: "Invalid ID" });
      const target = await storage.getUserById(id);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.username.toLowerCase() === superAdminEmail()) {
        return res.status(403).json({ message: "The superadmin account cannot be changed" });
      }

      const data = updateUserSchema.parse(req.body);
      if (data.email && data.email !== target.username) {
        if (data.email === superAdminEmail()) {
          return res.status(400).json({ message: "That email is reserved for the superadmin" });
        }
        if (await storage.getUser(data.email)) {
          return res.status(409).json({ message: "That email already has access" });
        }
      }

      const user = await storage.updateUser(id, {
        username: data.email,
        isAdmin: data.isAdmin,
      });
      if (!user) return res.status(404).json({ message: "User not found" });
      const emailChanged = Boolean(data.email && data.email !== target.username);
      const demoted = data.isAdmin !== undefined && data.isAdmin !== target.isAdmin;
      if (emailChanged || demoted) {
        await revokeSessionsFor(target.username);
      }
      const { passwordHash, ...sanitized } = user;
      return res.json({ ...sanitized, email: user.username });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id)) return res.status(400).json({ message: "Invalid ID" });
    const target = await storage.getUserById(id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.username.toLowerCase() === superAdminEmail()) {
      return res.status(403).json({ message: "The superadmin account cannot be removed" });
    }
    if (req.session.userId === id) {
      return res.status(400).json({ message: "You cannot remove your own access" });
    }
    if (!(await storage.deleteUser(id))) {
      return res.status(404).json({ message: "User not found" });
    }
    await revokeSessionsFor(target.username);
    return res.status(204).send();
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.authenticated) return next();
  return res.status(401).json({ message: "Authentication required" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAdmin || req.session.isSuperAdmin) return next();
  return res.status(403).json({ message: "Admin access required" });
}

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    username?: string;
    userId?: number;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    authMethod?: "google";
    mustChangePin?: boolean;
    googleOAuthState?: string;
  }
}
