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
import billingDummyRoutes from "./routes/billingDummy.routes.js";
import customersRoutes from "./routes/customers.routes.js";
import filesRoutes from "./routes/files.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import orderItemsRoutes from "./routes/orderItems.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import paymentOAuthCallbackRoutes from "./routes/paymentOAuthCallback.routes.js";
import paymentReturnRoutes from "./routes/paymentReturn.routes.js";
import paymentsDummyRoutes from "./routes/paymentsDummy.routes.js";
import platformAuthRoutes from "./routes/platform/auth.routes.js";
import platformShopsRoutes from "./routes/platform/shops.routes.js";
import platformTeamRoutes from "./routes/platform/team.routes.js";
import portalRoutes from "./routes/portal.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import settingsBillingRoutes from "./routes/settingsBilling.routes.js";
import settingsPaymentsRoutes from "./routes/settingsPayments.routes.js";
import settingsStorageRoutes from "./routes/settingsStorage.routes.js";
import shopPlanRoutes from "./routes/shopPlan.routes.js";
import storageOAuthCallbackRoutes from "./routes/storageOAuthCallback.routes.js";
import stripeConnectWebhookRoutes from "./routes/stripeConnectWebhook.routes.js";
import stripeWebhookRoutes from "./routes/stripeWebhook.routes.js";
import usersRoutes from "./routes/users.routes.js";

const app = express();

// CORS_ORIGIN covers the stable production domain (comma-separate for more
// than one). Vercel additionally gives every deploy — preview or
// production — its own unique subdomain, so this project's own *.vercel.app
// deployments are allowed on top of that instead of needing a Render env
// var update every time a new deploy URL shows up.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const VERCEL_PREVIEW_PATTERN = /^https:\/\/sign-shop-management-system(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || VERCEL_PREVIEW_PATTERN.test(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);

// Mounted with a raw-body parser, and before the global express.json()
// below, since Stripe's webhook signature is computed over the exact bytes
// it sent — a JSON-parsed-then-re-stringified body would fail verification.
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRoutes);
app.use(
  "/api/webhooks/stripe-connect",
  express.raw({ type: "application/json" }),
  stripeConnectWebhookRoutes
);

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
app.use("/api/billing/dummy-checkout", billingDummyRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings/storage", settingsStorageRoutes);
app.use("/api/settings/billing", settingsBillingRoutes);
app.use("/api/storage-oauth", storageOAuthCallbackRoutes);
app.use("/api/settings/payments", settingsPaymentsRoutes);
app.use("/api/payment-oauth", paymentOAuthCallbackRoutes);
app.use("/api/payments", paymentsDummyRoutes);
app.use("/api/payment-return", paymentReturnRoutes);
app.use("/api/shop/plan", shopPlanRoutes);

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
