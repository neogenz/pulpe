// authors.ts
import { Hono } from "hono";
import { authMiddleware } from "../supabase/auth-middleware";
import type { Budget, BudgetInsert } from "../supabase/client";

interface BudgetResponse {
  readonly success: boolean;
  readonly budget?: Budget;
  readonly budgets?: Budget[];
}

interface ErrorResponse {
  readonly success: false;
  readonly error: string;
}

const budgetRoutes = new Hono();

// Lister tous les budgets de l'utilisateur connecté
budgetRoutes.get("/", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");

    const { data: budgets, error } = await supabase
      .from("budgets")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) {
      return c.json<ErrorResponse>(
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
    return c.json<ErrorResponse>(
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
    const body = await c.req.json();

    const budgetData: BudgetInsert = {
      month: body.month,
      year: body.year,
      description: body.description,
    };

    const { data: budget, error } = await supabase
      .from("budgets")
      .insert(budgetData)
      .select()
      .single();

    if (error) {
      return c.json<ErrorResponse>(
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
    return c.json<ErrorResponse>(
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
    const budgetId = c.req.param("id");

    const { data: budget, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", budgetId)
      .single();

    if (error || !budget) {
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Budget introuvable",
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
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

export { budgetRoutes };
