import "dotenv/config";
// Patches Express so a rejected promise in an async route handler is
// forwarded to the error middleware below instead of becoming an
// unhandled rejection that crashes the whole process — one request
// hitting a DB hiccup used to take the entire server down.
import "express-async-errors";
import http from "node:http";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { connectDB, getMongoUri } from "./config/db.js";
import { initSockets } from "./sockets/index.js";

import authRoutes from "./routes/auth.routes.js";
import customersRoutes from "./routes/customers.routes.js";
import filesRoutes from "./routes/files.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import orderItemsRoutes from "./routes/orderItems.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import platformAuthRoutes from "./routes/platform/auth.routes.js";
import platformShopsRoutes from "./routes/platform/shops.routes.js";
import platformTeamRoutes from "./routes/platform/team.routes.js";
import portalRoutes from "./routes/portal.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import stripeWebhookRoutes from "./routes/stripeWebhook.routes.js";
import usersRoutes from "./routes/users.routes.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN }));

// Mounted with a raw-body parser, and before the global express.json()
// below, since Stripe's webhook signature is computed over the exact bytes
// it sent — a JSON-parsed-then-re-stringified body would fail verification.
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRoutes);

// Design files are uploaded as base64 in the JSON body, which inflates
// size by ~33% — 25mb here caps real uploads around 18mb.
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/order-items", orderItemsRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/platform/auth", platformAuthRoutes);
app.use("/api/platform/team", platformTeamRoutes);
app.use("/api/platform/shops", platformShopsRoutes);
app.use("/api/portal/:shopId", portalRoutes);
app.use("/api/reports", reportsRoutes);

// Catches errors forwarded by express-async-errors (and anything passed to
// next(err) directly) so a failed request returns a normal 500 instead of
// crashing the process.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 4000);
const httpServer = http.createServer(app);
initSockets(httpServer);

connectDB(getMongoUri(process.env.MONGODB_URI))
  .then(() => {
    httpServer.listen(port, () => console.log(`API listening on :${port}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed. Continuing without database for now.", err);
    httpServer.listen(port, () => console.log(`API listening on :${port} (MongoDB unavailable)`));
  });
