import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authMiddleware } from "../supabase/auth-middleware";
import {
  budgetCreateRequestSchema,
  budgetUpdateRequestSchema,
  budgetResponseSchema,
  budgetErrorResponseSchema,
  budgetDeleteResponseSchema,
} from "@pulpe/shared";
import type {
  Budget,
  BudgetInsert,
  BudgetResponse,
  BudgetErrorResponse,
  BudgetCreateRequest,
  BudgetUpdateRequest,
} from "@pulpe/shared";
import { validateRequestBody } from "../utils/validation";

const budgetRoutes = new Hono();

// Lister tous les budgets de l'utilisateur connecté
budgetRoutes.get(
  "/",
  describeRoute({
    description: "Liste tous les budgets de l'utilisateur connecté",
    responses: {
      200: {
        description: "Liste des budgets récupérée avec succès",
        content: {
          "application/json": { schema: resolver(budgetResponseSchema) },
        },
      },
      500: {
        description: "Erreur interne du serveur",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
    },
    tags: ["Budgets"],
  }),
  authMiddleware,
  async (c) => {
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
      return c.json<BudgetErrorResponse>(
        {
          success: false,
          error: "Erreur lors de la récupération des budgets",
        },
        500
      );
    }

    return c.json<BudgetResponse>({
      success: true,
      budgets: budgets || [],
    });
  } catch (error) {
    console.error("Erreur liste budgets:", error);
    return c.json<BudgetErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Créer un nouveau budget
budgetRoutes.post(
  "/",
  describeRoute({
    description: "Crée un nouveau budget pour l'utilisateur connecté",
    requestBody: {
      description: "Données du budget à créer",
      content: {
        "application/json": { schema: resolver(budgetCreateRequestSchema) },
      },
      required: true,
    },
    responses: {
      201: {
        description: "Budget créé avec succès",
        content: {
          "application/json": { schema: resolver(budgetResponseSchema) },
        },
      },
      400: {
        description: "Données invalides",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
      500: {
        description: "Erreur interne du serveur",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
    },
    tags: ["Budgets"],
  }),
  authMiddleware,
  zValidator("json", budgetCreateRequestSchema),
  async (c) => {
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
      return c.json<BudgetErrorResponse>(
        {
          success: false,
          error: "Erreur lors de la création du budget",
        },
        400
      );
    }

    return c.json<BudgetResponse>(
      {
        success: true,
        budget,
      },
      201
    );
  } catch (error) {
    console.error("Erreur création budget:", error);
    return c.json<BudgetErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Récupérer un budget spécifique
budgetRoutes.get(
  "/:id",
  describeRoute({
    description: "Récupère un budget spécifique par son ID",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Identifiant unique du budget",
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: {
      200: {
        description: "Budget récupéré avec succès",
        content: {
          "application/json": { schema: resolver(budgetResponseSchema) },
        },
      },
      404: {
        description: "Budget non trouvé",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
      500: {
        description: "Erreur interne du serveur",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
    },
    tags: ["Budgets"],
  }),
  authMiddleware,
  async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const budgetId = c.req.param("id");

    // RLS s'assure automatiquement que seuls les budgets de l'utilisateur sont accessibles
    const { data: budget, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", budgetId)
      .single();

    if (error || !budget) {
      return c.json<BudgetErrorResponse>(
        {
          success: false,
          error: "Budget introuvable ou accès non autorisé",
        },
        404
      );
    }

    return c.json<BudgetResponse>({
      success: true,
      budget,
    });
  } catch (error) {
    console.error("Erreur récupération budget:", error);
    return c.json<BudgetErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Mettre à jour un budget
budgetRoutes.put(
  "/:id",
  describeRoute({
    description: "Met à jour un budget existant",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Identifiant unique du budget",
        schema: { type: "string", format: "uuid" },
      },
    ],
    requestBody: {
      description: "Données du budget à mettre à jour",
      content: {
        "application/json": { schema: resolver(budgetUpdateRequestSchema) },
      },
      required: true,
    },
    responses: {
      200: {
        description: "Budget mis à jour avec succès",
        content: {
          "application/json": { schema: resolver(budgetResponseSchema) },
        },
      },
      404: {
        description: "Budget non trouvé",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
      500: {
        description: "Erreur interne du serveur",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
    },
    tags: ["Budgets"],
  }),
  authMiddleware,
  zValidator("json", budgetUpdateRequestSchema),
  async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const budgetId = c.req.param("id");

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
      return c.json<BudgetErrorResponse>(
        {
          success: false,
          error: "Budget introuvable ou modification non autorisée",
        },
        404
      );
    }

    return c.json<BudgetResponse>({
      success: true,
      budget,
    });
  } catch (error) {
    console.error("Erreur modification budget:", error);
    return c.json<BudgetErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Supprimer un budget
budgetRoutes.delete(
  "/:id",
  describeRoute({
    description: "Supprime un budget existant",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Identifiant unique du budget",
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: {
      200: {
        description: "Budget supprimé avec succès",
        content: {
          "application/json": { schema: resolver(budgetDeleteResponseSchema) },
        },
      },
      404: {
        description: "Budget non trouvé",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
      500: {
        description: "Erreur interne du serveur",
        content: {
          "application/json": { schema: resolver(budgetErrorResponseSchema) },
        },
      },
    },
    tags: ["Budgets"],
  }),
  authMiddleware,
  async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const budgetId = c.req.param("id");

    // RLS s'assure que seuls les budgets de l'utilisateur peuvent être supprimés
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", budgetId);

    if (error) {
      console.error("Erreur suppression budget:", error);
      return c.json<BudgetErrorResponse>(
        {
          success: false,
          error: "Budget introuvable ou suppression non autorisée",
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "Budget supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur suppression budget:", error);
    return c.json<BudgetErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

export { budgetRoutes };
