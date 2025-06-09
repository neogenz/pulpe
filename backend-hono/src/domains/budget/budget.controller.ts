import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  budgetCreateRequestSchema,
  budgetDeleteResponseSchema,
  budgetErrorResponseSchema,
  budgetResponseSchema,
  budgetUpdateRequestSchema,
  budgetCreateFromOnboardingRequestSchema,
  budgetCreateFromOnboardingApiRequestSchema,
  type BudgetCreateFromOnboardingRequest,
  type BudgetCreateFromOnboardingApiRequest,
} from "@pulpe/shared";
import {
  authMiddleware,
  type AuthenticatedUser,
} from "../../supabase/auth-middleware";
import type { AuthenticatedSupabaseClient } from "../../supabase/client";
import { BudgetService } from "./budget.service";

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

// Route definition for creating a budget from onboarding
const createBudgetFromOnboardingRoute = createRoute({
  method: "post",
  path: "/onboarding",
  tags: ["Budgets"],
  summary:
    "Crée un nouveau budget depuis l'onboarding avec transactions automatiques",
  request: {
    body: {
      content: {
        "application/json": {
          schema: budgetCreateFromOnboardingApiRequestSchema,
        },
      },
      description: "Données du budget à créer depuis l'onboarding",
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
      description: "Budget créé avec succès avec transactions associées",
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
    const budgetService = new BudgetService(supabase);

    const budgets = await budgetService.getAllBudgets();

    return c.json(
      {
        success: true as const,
        budgets: budgets || [],
      },
      200
    );
  } catch (error) {
    console.error("CONTROLLER_ERROR: Erreur liste budgets:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur lors de la récupération des budgets",
      },
      500
    );
  }
});

// Créer un nouveau budget depuis l'onboarding
budgetRoutes.openapi(createBudgetFromOnboardingRoute, async (c) => {
  try {
    const user = c.get("user");
    const supabase = c.get("supabase");
    const budgetService = new BudgetService(supabase);

    const body = await c.req.json();
    const validation =
      budgetCreateFromOnboardingApiRequestSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false as const,
          error: "Invalid request body",
          details: validation.error.issues,
        },
        400
      );
    }

    const requestData = validation.data;
    const budgetData: BudgetCreateFromOnboardingRequest = {
      ...requestData,
      user_id: user.id,
      monthlyIncome: requestData.monthlyIncome || 0,
      housingCosts: requestData.housingCosts || 0,
      healthInsurance: requestData.healthInsurance || 0,
      leasingCredit: requestData.leasingCredit || 0,
      phonePlan: requestData.phonePlan || 0,
      transportCosts: requestData.transportCosts || 0,
    };

    const budget = await budgetService.createBudget(budgetData);

    return c.json(
      {
        success: true as const,
        budget,
      },
      201
    );
  } catch (error) {
    console.error(
      "CONTROLLER_ERROR: Erreur création budget onboarding:",
      error
    );
    return c.json(
      {
        success: false as const,
        error: "Erreur lors de la création du budget depuis l'onboarding",
      },
      400
    );
  }
});

// Créer un nouveau budget
budgetRoutes.openapi(createBudgetRoute, async (c) => {
  try {
    const user = c.get("user");
    const supabase = c.get("supabase");
    const budgetService = new BudgetService(supabase);

    const body = await c.req.json();
    const validation = budgetCreateRequestSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false as const,
          error: "Invalid request body",
          details: validation.error.issues,
        },
        400
      );
    }

    const requestData = validation.data;
    const budgetData = {
      ...requestData,
      user_id: user.id,
    };

    const budget = await budgetService.createBasicBudget(budgetData);

    return c.json(
      {
        success: true as const,
        budget,
      },
      201
    );
  } catch (error) {
    console.error("CONTROLLER_ERROR: Erreur création budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Erreur lors de la création du budget",
      },
      400
    );
  }
});

// Récupérer un budget spécifique
budgetRoutes.openapi(getBudgetRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const budgetService = new BudgetService(supabase);
    const { id: budgetId } = c.req.valid("param");

    const budget = await budgetService.getBudgetById(budgetId);

    return c.json(
      {
        success: true as const,
        budget,
      },
      200
    );
  } catch (error) {
    console.error("CONTROLLER_ERROR: Erreur récupération budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Budget introuvable ou accès non autorisé",
      },
      404
    );
  }
});

// Mettre à jour un budget
budgetRoutes.openapi(updateBudgetRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const budgetService = new BudgetService(supabase);
    const { id: budgetId } = c.req.valid("param");
    const requestData = c.req.valid("json");

    const budget = await budgetService.updateBudget(budgetId, requestData);

    return c.json(
      {
        success: true as const,
        budget,
      },
      200
    );
  } catch (error) {
    console.error("CONTROLLER_ERROR: Erreur modification budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Budget introuvable ou modification non autorisée",
      },
      404
    );
  }
});

// Supprimer un budget
budgetRoutes.openapi(deleteBudgetRoute, async (c) => {
  try {
    const supabase = c.get("supabase");
    const budgetService = new BudgetService(supabase);
    const { id: budgetId } = c.req.valid("param");

    await budgetService.deleteBudget(budgetId);

    return c.json(
      {
        success: true as const,
        message: "Budget supprimé avec succès",
      },
      200
    );
  } catch (error) {
    console.error("CONTROLLER_ERROR: Erreur suppression budget:", error);
    return c.json(
      {
        success: false as const,
        error: "Budget introuvable ou suppression non autorisée",
      },
      404
    );
  }
});

export { budgetRoutes };
