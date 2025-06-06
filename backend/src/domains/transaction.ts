import { Hono } from "hono";
import { authMiddleware } from "../supabase/auth-middleware";
import type { Transaction, TransactionInsert } from "../supabase/client";

interface TransactionResponse {
  readonly success: boolean;
  readonly transaction?: Transaction;
  readonly transactions?: Transaction[];
}

interface ErrorResponse {
  readonly success: false;
  readonly error: string;
}

const transactionRoutes = new Hono();

// Lister toutes les transactions de l'utilisateur connecté
transactionRoutes.get("/", authMiddleware, async (c) => {
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
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Erreur lors de la récupération des transactions",
        },
        500
      );
    }

    return c.json<TransactionResponse>({
      success: true,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Erreur liste transactions:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Lister les transactions d'un budget spécifique
transactionRoutes.get("/budget/:budgetId", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const budgetId = c.req.param("budgetId");

    // RLS s'assure que seules les transactions de l'utilisateur pour le budget spécifié sont retournées
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("budget_id", budgetId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur récupération transactions budget:", error);
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Erreur lors de la récupération des transactions du budget",
        },
        500
      );
    }

    return c.json<TransactionResponse>({
      success: true,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Erreur liste transactions budget:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Créer une nouvelle transaction
transactionRoutes.post("/", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const body = await c.req.json();

    // Inclure automatiquement le user_id pour le RLS
    const transactionData: TransactionInsert = {
      budget_id: body.budget_id,
      amount: body.amount,
      type: body.type,
      expense_type: body.expense_type,
      description: body.description,
      is_recurring: body.is_recurring || false,
      user_id: user.id, // Ajout automatique du user_id
    };

    const { data: transaction, error } = await supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error("Erreur création transaction:", error);
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Erreur lors de la création de la transaction",
        },
        400
      );
    }

    return c.json<TransactionResponse>(
      {
        success: true,
        transaction,
      },
      201
    );
  } catch (error) {
    console.error("Erreur création transaction:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Récupérer une transaction spécifique
transactionRoutes.get("/:id", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const transactionId = c.req.param("id");

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
transactionRoutes.put("/:id", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const transactionId = c.req.param("id");
    const body = await c.req.json();

    // RLS s'assure que seules les transactions de l'utilisateur peuvent être modifiées
    const { data: transaction, error } = await supabase
      .from("transactions")
      .update({
        budget_id: body.budget_id,
        amount: body.amount,
        type: body.type,
        expense_type: body.expense_type,
        description: body.description,
        is_recurring: body.is_recurring,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .select()
      .single();

    if (error || !transaction) {
      console.error("Erreur modification transaction:", error);
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Transaction introuvable ou modification non autorisée",
        },
        404
      );
    }

    return c.json<TransactionResponse>({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("Erreur modification transaction:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

// Supprimer une transaction
transactionRoutes.delete("/:id", authMiddleware, async (c) => {
  try {
    const supabase = c.get("supabase");
    const user = c.get("user");
    const transactionId = c.req.param("id");

    // RLS s'assure que seules les transactions de l'utilisateur peuvent être supprimées
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId);

    if (error) {
      console.error("Erreur suppression transaction:", error);
      return c.json<ErrorResponse>(
        {
          success: false,
          error: "Transaction introuvable ou suppression non autorisée",
        },
        404
      );
    }

    return c.json({
      success: true,
      message: "Transaction supprimée avec succès",
    });
  } catch (error) {
    console.error("Erreur suppression transaction:", error);
    return c.json<ErrorResponse>(
      {
        success: false,
        error: "Erreur interne du serveur",
      },
      500
    );
  }
});

export { transactionRoutes };
