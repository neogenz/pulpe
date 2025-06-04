import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { budgetRoutes } from "./domains/budget";
import { authRoutes } from "./domains/auth";
import { userRoutes } from "./domains/user";

const app = new Hono();

app.use(logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:4200"],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
app.route("/api/auth", authRoutes);
app.route("/api/user", userRoutes);
app.route("/api/budget", budgetRoutes);

// Routes de test/santé (optionnel)
app.get("/", (c) =>
  c.json({
    message: "Pulpe Budget API",
    status: "running",
  })
);

app.get("/health", (c) => c.json({ status: "healthy" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
