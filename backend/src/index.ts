import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { openAPISpecs } from "hono-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { budgetRoutes } from "./domains/budget";
import { authRoutes } from "./domains/auth";
import { userRoutes } from "./domains/user";
import { transactionRoutes } from "./domains/transaction";

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
app.get(
  "/api/openapi",
  openAPISpecs(app, {
    documentation: {
      openapi: "3.1.0",
      info: {
        title: "Pulpe Budget API",
        version: "1.0.0",
        description: "API pour la gestion des budgets personnels Pulpe",
      },
      servers: [
        { url: "http://localhost:3000", description: "Serveur de développement" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Token JWT d'authentification",
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: "Auth", description: "Authentification et gestion des sessions" },
        { name: "Budgets", description: "Gestion des budgets" },
        { name: "Users", description: "Gestion des utilisateurs" },
        { name: "Transactions", description: "Gestion des transactions" },
      ],
    },
  })
);

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
