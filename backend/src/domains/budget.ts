import type {
  BudgetErrorResponse,
  BudgetInsert,
  BudgetResponse,
} from "@pulpe/shared";
import {
  budgetCreateRequestSchema,
  budgetDeleteResponseSchema,
  budgetErrorResponseSchema,
  budgetResponseSchema,
  budgetUpdateRequestSchema,
} from "@pulpe/shared";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  authMiddleware,
  type AuthenticatedUser,
} from "../supabase/auth-middleware";
import type { AuthenticatedSupabaseClient } from "../supabase/client";

const budgetRoutes = new OpenAPIHono<{
  Variables: {
    user: AuthenticatedUser;
    supabase: AuthenticatedSupabaseClient;
  };
}>();

// Parameter schema for ID routes
const BudgetParamsSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({
      param: { name: "id", in: "path" },
      description: "Identifiant unique du budget",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
});

// Route definition for listing all budgets
const listBudgetsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Budgets"],
  summary: "Liste tous les budgets de l'utilisateur connecté",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: budgetResponseSchema,
        },
      },
      description: "Liste des budgets récupérée avec succès",
    },
    500: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

// Route definition for creating a budget
const createBudgetRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Budgets"],
  summary: "Crée un nouveau budget pour l'utilisateur connecté",
  request: {
    body: {
      content: {
        "application/json": {
          schema: budgetCreateRequestSchema,
        },
      },
      description: "Données du budget à créer",
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: budgetResponseSchema,
        },
      },
      description: "Budget créé avec succès",
    },
    400: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Données invalides",
    },
    500: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

// Route definition for getting a specific budget
const getBudgetRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["Budgets"],
  summary: "Récupère un budget spécifique par son ID",
  request: {
    params: BudgetParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: budgetResponseSchema,
        },
      },
      description: "Budget récupéré avec succès",
    },
    404: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Budget non trouvé",
    },
    500: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

// Route definition for updating a budget
const updateBudgetRoute = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["Budgets"],
  summary: "Met à jour un budget existant",
  request: {
    params: BudgetParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: budgetUpdateRequestSchema,
        },
      },
      description: "Données du budget à mettre à jour",
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: budgetResponseSchema,
        },
      },
      description: "Budget mis à jour avec succès",
    },
    404: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Budget non trouvé",
    },
    500: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

// Route definition for deleting a budget
const deleteBudgetRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["Budgets"],
  summary: "Supprime un budget existant",
  request: {
    params: BudgetParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: budgetDeleteResponseSchema,
        },
      },
      description: "Budget supprimé avec succès",
    },
    404: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Budget non trouvé",
    },
    500: {
      content: {
        "application/json": {
          schema: budgetErrorResponseSchema,
        },
      },
      description: "Erreur interne du serveur",
    },
  },
});

// Apply auth middleware to all routes
budgetRoutes.use("/*", authMiddleware);

// Lister tous les budgets de l'utilisateur connecté
budgetRoutes.openapi(listBudgetsRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");

    // RLS s'assure automatiquement que seuls les budgets de l'utilisateur sont retournés
    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) {
      console.error("Erreur récupération budgets:", error);
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la récupération des budgets",
        },
        500
      );
    }

    return c.json(
      {
        success: true as const,
        budgets: budgets || [],
      },
      200
    );
  } catch (error) {
    console.error("Erreur liste budgets:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Créer un nouveau budget
budgetRoutes.openapi(createBudgetRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");

    const requestData = c.req.valid("json");

    // Inclure automatiquement le user_id pour le RLS
    const budgetData: BudgetInsert = {
      ...requestData,
      user_id: user.id, // Ajout automatique du user_id
    };

    const { data: budget, error } = await supabase
      .from("budgets")
      .insert(budgetData)
      .select()
      .single();

    if (error) {
      console.error("Erreur création budget:", error);
      return c.json(
        {
          success: false as const,
          error: "Erreur lors de la création du budget",
        },
        400
      );
    }

    return c.json(
      {
        success: true as const,
        budget,
      },
      201
    );
  } catch (error) {
    console.error("Erreur création budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Récupérer un budget spécifique
budgetRoutes.openapi(getBudgetRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const { id: budgetId } = c.req.valid("param");

    // RLS s'assure automatiquement que seuls les budgets de l'utilisateur sont accessibles
    const { data: budget, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", budgetId)
      .single();

    if (error || !budget) {
      return c.json(
        {
          success: false as const,
          error: "Budget introuvable ou accès non autorisé",
        },
        404
      );
    }

    return c.json(
      {
        success: true as const,
        budget,
      },
      200
    );
  } catch (error) {
    console.error("Erreur récupération budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Mettre à jour un budget
budgetRoutes.openapi(updateBudgetRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const { id: budgetId } = c.req.valid("param");

    const requestData = c.req.valid("json");

    // RLS s'assure que seuls les budgets de l'utilisateur peuvent être modifiés
    const { data: budget, error } = await supabase
      .from("budgets")
      .update({
        ...requestData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", budgetId)
      .select()
      .single();

    if (error || !budget) {
      console.error("Erreur modification budget:", error);
      return c.json(
        {
          success: false as const,
          error: "Budget introuvable ou modification non autorisée",
        },
        404
      );
    }

    return c.json(
      {
        success: true as const,
        budget,
      },
      200
    );
  } catch (error) {
    console.error("Erreur modification budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Supprimer un budget
budgetRoutes.openapi(deleteBudgetRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const { id: budgetId } = c.req.valid("param");

    // RLS s'assure que seuls les budgets de l'utilisateur peuvent être supprimés
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", budgetId);

    if (error) {
      console.error("Erreur suppression budget:", error);
      return c.json(
        {
          success: false as const,
          error: "Budget introuvable ou suppression non autorisée",
        },
        404
      );
    }

    return c.json(
      {
        success: true as const,
        message: "Budget supprimé avec succès",
      },
      200
    );
  } catch (error) {
    console.error("Erreur suppression budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

export { budgetRoutes };
