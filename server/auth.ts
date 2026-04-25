import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { z } from "zod";

const DEFAULT_PIN = "0000";
const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

export async function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "aqua-invoice-maker-secret-key",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({ checkPeriod: 86400000 }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: "lax",
    },
  };

  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));

  // Seed admin user on startup
  await storage.ensureAdminUser();
  // One-shot migration: archive pre-existing sent periods so they don't flood the dashboard.
  await storage.backfillArchivedPeriods();

  // --- Auth endpoints ---

  app.post("/api/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and PIN are required" });
    }

    const user = await storage.getUser(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid username or PIN" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid username or PIN" });
    }

    req.session.authenticated = true;
    req.session.username = user.username;
    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    req.session.mustChangePin = user.mustChangePin;
    return res.json({
      message: "Login successful",
      user: { username: user.username, isAdmin: user.isAdmin, mustChangePin: user.mustChangePin },
    });
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    if (req.session.authenticated) {
      return res.json({
        user: {
          username: req.session.username,
          isAdmin: req.session.isAdmin,
          mustChangePin: req.session.mustChangePin ?? false,
        },
      });
    }
    return res.status(401).json({ message: "Not authenticated" });
  });

  // Any authenticated user can change their own PIN
  app.post("/api/change-pin", requireAuth, async (req: Request, res: Response) => {
    try {
      const { newPin } = z.object({ newPin: pinSchema }).parse(req.body);
      const hash = await bcrypt.hash(newPin, 10);
      const user = await storage.updateUser(req.session.userId, { passwordHash: hash, mustChangePin: false });
      if (!user) return res.status(404).json({ message: "User not found" });
      req.session.mustChangePin = false;
      return res.json({ message: "PIN changed successfully" });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({ message: err.message });
    }
  });

  // --- Admin user management routes ---

  app.use("/api/admin", requireAuth, requireAdmin);

  const createUserSchema = z.object({
    username: z.string().min(1).max(50),
    isAdmin: z.boolean().default(false),
  });

  const updateUserSchema = z.object({
    username: z.string().min(1).max(50).optional(),
    isAdmin: z.boolean().optional(),
  });

  app.get("/api/admin/users", async (_req: Request, res: Response) => {
    const users = await storage.getAllUsers();
    const sanitized = users.map(({ passwordHash, ...rest }) => rest);
    res.json(sanitized);
  });

  app.post("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const data = createUserSchema.parse(req.body);

      const existing = await storage.getUser(data.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hash = await bcrypt.hash(DEFAULT_PIN, 10);
      const user = await storage.createUser(data.username, hash, data.isAdmin, true);
      const { passwordHash, ...sanitized } = user;
      res.status(201).json(sanitized);
    } catch (err: any) {
      if (err.name === "ZodError") {
        const messages = err.errors.map((e: any) => e.message).join(", ");
        return res.status(400).json({ message: messages });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const data = updateUserSchema.parse(req.body);

      if (data.isAdmin === false) {
        const targetUser = await storage.getUserById(id);
        if (targetUser?.isAdmin) {
          const adminCount = await storage.getAdminCount();
          if (adminCount <= 1) {
            return res.status(400).json({ message: "Cannot remove admin role from the last admin" });
          }
        }
      }

      if (data.username) {
        const existing = await storage.getUser(data.username);
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }

      const updates: { username?: string; isAdmin?: boolean } = {};
      if (data.username) updates.username = data.username;
      if (data.isAdmin !== undefined) updates.isAdmin = data.isAdmin;

      const user = await storage.updateUser(id, updates);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (req.session.userId === id) {
        if (data.username) req.session.username = data.username;
        if (data.isAdmin !== undefined) req.session.isAdmin = data.isAdmin;
      }

      const { passwordHash, ...sanitized } = user;
      res.json(sanitized);
    } catch (err: any) {
      if (err.name === "ZodError") {
        const messages = err.errors.map((e: any) => e.message).join(", ");
        return res.status(400).json({ message: messages });
      }
      res.status(500).json({ message: err.message });
    }
  });

  // Reset a user's PIN back to 0000 and force change on next login
  app.post("/api/admin/users/:id/reset-pin", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const targetUser = await storage.getUserById(id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const hash = await bcrypt.hash(DEFAULT_PIN, 10);
    const user = await storage.updateUser(id, { passwordHash: hash, mustChangePin: true });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "PIN reset to 0000" });
  });

  app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    if (req.session.userId === id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    const targetUser = await storage.getUserById(id);
    if (!targetUser) return res.status(404).json({ message: "User not found" });
    if (targetUser.isAdmin) {
      const adminCount = await storage.getAdminCount();
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Cannot delete the last admin" });
      }
    }

    const deleted = await storage.deleteUser(id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.status(204).send();
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ message: "Authentication required" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.isAdmin) {
    return next();
  }
  return res.status(403).json({ message: "Admin access required" });
}

declare module "express-session" {
  interface SessionData {
    authenticated: boolean;
    username: string;
    userId: number;
    isAdmin: boolean;
    mustChangePin: boolean;
  }
}
