import { Router } from "express";
import { verifyAdminPassword } from "../lib/admin-auth";

const router = Router();

// POST /admin/auth — exchange password for session token
router.post("/admin/auth", (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "validation_error", message: "password is required" });
  }

  const token = verifyAdminPassword(password);
  if (!token) {
    return res.status(401).json({ error: "unauthorized", message: "Invalid password" });
  }

  res.json({ token });
});

export default router;
