import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { budgetRoutes } from "./domains/budget";
import { userRoutes } from "./domains/user";
import { transactionRoutes } from "./domains/transaction";

const app = new OpenAPIHono();

// Configuration des security schemes
app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Token JWT d'authentification",
});

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
app.route("/api/transaction", transactionRoutes);

// Routes de test/santé (optionnel)
app.get("/", (c) =>
  c.json({
    message: "Pulpe Budget API",
    status: "running",
  })
);

app.get("/health", (c) => c.json({ status: "healthy" }));

// Documentation OpenAPI
app.doc("/api/openapi", {
  openapi: "3.1.0",
  info: {
    title: "Pulpe Budget API",
    version: "1.0.0",
    description: "API pour la gestion des budgets personnels Pulpe",
  },
  servers: [
    { url: "http://localhost:3000", description: "Serveur de développement" },
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Budgets", description: "Gestion des budgets" },
    { name: "Transactions", description: "Gestion des transactions" },
  ],
});

// Interface Swagger UI
app.get(
  "/api/docs",
  swaggerUI({
    url: "/api/openapi",
  })
);

export default {
  port: 3000,
  fetch: app.fetch,
};
