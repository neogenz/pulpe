// src/supabase/client.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

/**
 * Crée un client Supabase avec un token d'authentification
 * Utilisé pour les requêtes authentifiées côté utilisateur
 */
export function createSupabaseClient(authToken?: string) {
  const options = authToken
    ? {
        global: {
          headers: { Authorization: `Bearer ${authToken}` },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    : {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      };

  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    options
  );
}

/**
 * Client Supabase admin avec service role key
 * Utilisé pour les opérations privilégiées (création d'utilisateurs, etc.)
 */
export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Client Supabase anonyme pour les requêtes publiques
 * Utilisé quand aucune authentification n'est requise
 */
export const supabaseAnon = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Types utilitaires exportés
export type Budget = Database["public"]["Tables"]["budgets"]["Row"];
export type BudgetInsert = Database["public"]["Tables"]["budgets"]["Insert"];
export type BudgetUpdate = Database["public"]["Tables"]["budgets"]["Update"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type TransactionInsert =
  Database["public"]["Tables"]["transactions"]["Insert"];
export type TransactionUpdate =
  Database["public"]["Tables"]["transactions"]["Update"];
export type ExpenseType = Database["public"]["Enums"]["expense_type"];
export type TransactionType = Database["public"]["Enums"]["transaction_type"];

// Type pour le client authentifié
export type AuthenticatedSupabaseClient = ReturnType<
  typeof createSupabaseClient
>;
