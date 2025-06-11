import type {
  ErrorResponse,
  TransactionCreate,
  TransactionResponse,
} from "@pulpe/shared";
import {
  transactionCreateSchema,
  deleteResponseSchema,
  errorResponseSchema,
  successResponseSchema,
  transactionUpdateSchema,
} from "@pulpe/shared";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  authMiddleware,
  type AuthenticatedUser,
} from "../supabase/auth-middleware";
import type { AuthenticatedSupabaseClient } from "../supabase/client";

const transactionRoutes = new OpenAPIHono<{
  Variables: {
    user: AuthenticatedUser;
    supabase: AuthenticatedSupabaseClient;
  };
}>();

// Parameter schema for ID routes
const TransactionParamsSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({
      param: { name: "id", in: "path" },
      description: "Identifiant unique de la transaction",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
});

const BudgetParamsSchema = z.object({
  budgetId: z
    .string()
    .uuid()
    .openapi({
      param: { name: "budgetId", in: "path" },
      description: "Identifiant unique du budget",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
});

// Route definitions
const listTransactionsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Transactions"],
  summary: "Liste toutes les transactions de l'utilisateur connecté",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: successResponseSchema,
        },
      },
      description: "Liste des transactions récupérée avec succès",
    },
    500: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

const listTransactionsByBudgetRoute = createRoute({
  method: "get",
  path: "/budget/{budgetId}",
  tags: ["Transactions"],
  summary: "Liste les transactions d'un budget spécifique",
  request: {
    params: BudgetParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: successResponseSchema,
        },
      },
      description: "Liste des transactions du budget récupérée avec succès",
    },
    500: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

const createTransactionRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Transactions"],
  summary: "Crée une nouvelle transaction",
  request: {
    body: {
      content: {
        "application/json": {
          schema: transactionCreateSchema,
        },
      },
      description: "Données de la transaction à créer",
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: successResponseSchema,
        },
      },
      description: "Transaction créée avec succès",
    },
    400: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Données invalides",
    },
    500: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

const getTransactionRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Transactions"],
  summary: "Récupère une transaction spécifique par son ID",
  request: {
    params: TransactionParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: successResponseSchema,
        },
      },
      description: "Transaction récupérée avec succès",
    },
    404: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Transaction non trouvée",
    },
    500: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

const updateTransactionRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Transactions"],
  summary: "Met à jour une transaction existante",
  request: {
    params: TransactionParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: transactionUpdateSchema,
        },
      },
      description: "Données de la transaction à mettre à jour",
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: successResponseSchema,
        },
      },
      description: "Transaction mise à jour avec succès",
    },
    404: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Transaction non trouvée",
    },
    500: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

const deleteTransactionRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Transactions"],
  summary: "Supprime une transaction existante",
  request: {
    params: TransactionParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: deleteResponseSchema,
        },
      },
      description: "Transaction supprimée avec succès",
    },
    404: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Transaction non trouvée",
    },
    500: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

// Apply auth middleware to all routes
transactionRoutes.use("/*", authMiddleware);

// Lister toutes les transactions de l'utilisateur connecté
transactionRoutes.openapi(listTransactionsRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");

    // RLS s'assure automatiquement que seules les transactions de l'utilisateur sont retournées
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur récupération transactions:", error);
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la récupération des transactions",
        },
        500
      );
    }

    return c.json(
      {
        success: true as const,
        transactions: transactions || [],
      },
      200
    );
  } catch (error) {
    console.error("Erreur liste transactions:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Lister les transactions d'un budget spécifique
transactionRoutes.openapi(listTransactionsByBudgetRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const { budgetId } = c.req.valid("param");

    // RLS s'assure que seules les transactions de l'utilisateur pour le budget spécifié sont retournées
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("budget_id", budgetId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur récupération transactions budget:", error);
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la récupération des transactions du budget",
        },
        500
      );
    }

    return c.json(
      {
        success: true as const,
        transactions: transactions || [],
      },
      200
    );
  } catch (error) {
    console.error("Erreur liste transactions budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Créer une nouvelle transaction
transactionRoutes.openapi(createTransactionRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const requestData = c.req.valid("json");

    // Inclure automatiquement le user_id pour le RLS
    const transactionData: TransactionCreate = {
      ...requestData,
      user_id: user.id, // Ajout automatique du user_id
    };

    const { data: transaction, error } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error("Erreur création transaction:", error);
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la création de la transaction",
        },
        400
      );
    }

    return c.json(
      {
        success: true as const,
        transaction,
      },
      201
    );
  } catch (error) {
    console.error("Erreur création transaction:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Récupérer une transaction spécifique
transactionRoutes.openapi(getTransactionRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const { id: transactionId } = c.req.valid("param");

    // RLS s'assure automatiquement que seules les transactions de l'utilisateur sont accessibles
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (error || !transaction) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Transaction introuvable ou accès non autorisé",
        },
        404
      );
    }

    return c.json<TransactionResponse>({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("Erreur récupération transaction:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Mettre à jour une transaction
transactionRoutes.openapi(updateTransactionRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const { id: transactionId } = c.req.valid("param");
    const requestData = c.req.valid("json");

    // RLS s'assure que seules les transactions de l'utilisateur peuvent être modifiées
    const { data: transaction, error } = await supabase
      .from("transactions")
      .update({
        ...requestData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .select()
      .single();

    if (error || !transaction) {
      console.error("Erreur modification transaction:", error);
      return c.json(
        {
          success: false as const,
          error: "Transaction introuvable ou modification non autorisée",
        },
        404
      );
    }

    return c.json(
      {
        success: true as const,
        transaction,
      },
      200
    );
  } catch (error) {
    console.error("Erreur modification transaction:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Supprimer une transaction
transactionRoutes.openapi(deleteTransactionRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const { id: transactionId } = c.req.valid("param");

    // RLS s'assure que seules les transactions de l'utilisateur peuvent être supprimées
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId);

    if (error) {
      console.error("Erreur suppression transaction:", error);
      return c.json(
        {
          success: false as const,
          error: "Transaction introuvable ou suppression non autorisée",
        },
        404
      );
    }

    return c.json(
      {
        success: true as const,
        message: "Transaction supprimée avec succès",
      },
      200
    );
  } catch (error) {
    console.error("Erreur suppression transaction:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

export { transactionRoutes };
