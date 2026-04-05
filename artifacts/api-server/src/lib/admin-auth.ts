import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "tallaght-admin";
}

function computeToken(password: string): string {
  return crypto
    .createHmac("sha256", "tallaght-admin-session-v1")
    .update(password)
    .digest("hex");
}

export function getExpectedToken(): string {
  return computeToken(getAdminPassword());
}

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Admin token required" });
    return;
  }
  const token = auth.slice(7);
  if (token !== getExpectedToken()) {
    res.status(401).json({ error: "unauthorized", message: "Invalid admin token" });
    return;
  }
  next();
}

export function verifyAdminPassword(password: string): string | null {
  if (password === getAdminPassword()) {
    return getExpectedToken();
  }
  return null;
}
