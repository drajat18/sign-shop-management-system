import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.use(requireAuth, requireRole("admin", "manager", "front_desk"));

router.get("/", async (req, res) => {
  res.json(await req.models!.Customer.find());
});

router.post("/", async (req, res) => {
  res.status(201).json(await req.models!.Customer.create(req.body));
});

router.get("/:id", async (req, res) => {
  const customer = await req.models!.Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json(customer);
});

router.patch("/:id", async (req, res) => {
  const customer = await req.models!.Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json(customer);
});

export default router;
