import { Hono } from "hono";
import { authMiddleware } from "../supabase/auth-middleware";
import {
  budgetCreateRequestSchema,
  budgetUpdateRequestSchema,
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
budgetRoutes.get("/", authMiddleware, async (c) => {
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
budgetRoutes.post("/", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");

    // Validation des données avec Zod
    const validationResult = await validateRequestBody(
      c,
      budgetCreateRequestSchema
    );
    if (!validationResult.success) {
      return validationResult.response;
    }

    // Inclure automatiquement le user_id pour le RLS
    const budgetData: BudgetInsert = {
      ...validationResult.data,
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
budgetRoutes.get("/:id", authMiddleware, async (c) => {
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
budgetRoutes.put("/:id", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const budgetId = c.req.param("id");

    // Validation des données avec Zod
    const validationResult = await validateRequestBody(
      c,
      budgetUpdateRequestSchema
    );
    if (!validationResult.success) {
      return validationResult.response;
    }

    // RLS s'assure que seuls les budgets de l'utilisateur peuvent être modifiés
    const { data: budget, error } = await supabase
      .from("budgets")
      .update({
        ...validationResult.data,
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
budgetRoutes.delete("/:id", authMiddleware, async (c) => {
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
