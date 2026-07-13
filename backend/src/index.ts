import "dotenv/config";
import http from "node:http";
import cors from "cors";
import express from "express";
import { connectDB, getMongoUri } from "./config/db.js";
import { initSockets } from "./sockets/index.js";

import authRoutes from "./routes/auth.routes.js";
import customersRoutes from "./routes/customers.routes.js";
import filesRoutes from "./routes/files.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import orderItemsRoutes from "./routes/orderItems.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import usersRoutes from "./routes/users.routes.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN }));
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
