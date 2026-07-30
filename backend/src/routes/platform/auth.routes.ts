import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import PlatformUser from "../../models/platform/PlatformUser.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await PlatformUser.findOne({ email: email.toLowerCase(), active: true });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { type: "platform", platformUserId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "12h" }
  );

  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

export default router;
