import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { z } from "zod";

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

  // --- Auth endpoints ---

  app.post("/api/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await storage.getUser(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    req.session.authenticated = true;
    req.session.username = user.username;
    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    return res.json({ message: "Login successful", user: { username: user.username, isAdmin: user.isAdmin } });
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
      return res.json({ user: { username: req.session.username, isAdmin: req.session.isAdmin } });
    }
    return res.status(401).json({ message: "Not authenticated" });
  });

  // --- Admin user management routes ---

  app.use("/api/admin", requireAuth, requireAdmin);

  const createUserSchema = z.object({
    username: z.string().min(1).max(50),
    password: z.string().min(6, "Password must be at least 6 characters"),
    isAdmin: z.boolean().default(false),
  });

  const updateUserSchema = z.object({
    username: z.string().min(1).max(50).optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
    isAdmin: z.boolean().optional(),
  });

  app.get("/api/admin/users", async (_req: Request, res: Response) => {
    const users = await storage.getAllUsers();
    // Omit passwordHash from response
    const sanitized = users.map(({ passwordHash, ...rest }) => rest);
    res.json(sanitized);
  });

  app.post("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const data = createUserSchema.parse(req.body);

      // Check if username already exists
      const existing = await storage.getUser(data.username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hash = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser(data.username, hash, data.isAdmin);
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

      // Cannot remove admin from the last admin
      if (data.isAdmin === false) {
        const targetUser = await storage.getUserById(id);
        if (targetUser?.isAdmin) {
          const adminCount = await storage.getAdminCount();
          if (adminCount <= 1) {
            return res.status(400).json({ message: "Cannot remove admin role from the last admin" });
          }
        }
      }

      // Check username uniqueness if changing
      if (data.username) {
        const existing = await storage.getUser(data.username);
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }

      const updates: { username?: string; passwordHash?: string; isAdmin?: boolean } = {};
      if (data.username) updates.username = data.username;
      if (data.password) updates.passwordHash = await bcrypt.hash(data.password, 10);
      if (data.isAdmin !== undefined) updates.isAdmin = data.isAdmin;

      const user = await storage.updateUser(id, updates);
      if (!user) return res.status(404).json({ message: "User not found" });

      // If the admin changed their own username, update session
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

  app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    // Cannot delete yourself
    if (req.session.userId === id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    // Cannot delete the last admin
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
  }
}
