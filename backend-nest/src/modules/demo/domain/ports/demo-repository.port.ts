import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type {
  DemoBudgetLineSeed,
  DemoBudgetSeed,
  DemoSeededBudget,
  DemoSeededTemplate,
  DemoSeededTemplateLine,
  DemoTemplateSeed,
  DemoTransactionSeed,
} from '../demo.entity';

export const DEMO_REPOSITORY = Symbol('DEMO_REPOSITORY');

/**
 * Mapping from a demo template kind to its persisted id. The repo uses this to
 * load the canonical per-kind line specs from `infrastructure/persistence/demo-template-specs.ts`,
 * encrypt amounts internally, and insert them.
 */
export interface DemoTemplateIds {
  standardId: string;
  vacationId: string;
  savingsId: string;
  holidayId: string;
}

/**
 * DemoRepositoryPort — entity-shaped seed surface.
 *
 * Inputs are plain entity types (no DB row knowledge, no ciphertext). The repo
 * encrypts amounts internally with `DEMO_CLIENT_KEY_BUFFER` before writing.
 *
 * The repo accepts an explicit `supabase` client because the demo seed flow
 * runs outside the per-request CLS context (the freshly minted demo session
 * is used to author its own seed data).
 */
export interface DemoRepositoryPort {
  insertTemplates(
    templates: DemoTemplateSeed[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededTemplate[]>;
  /**
   * Insert the canonical 4-kind set of demo template lines. The repo owns the
   * per-kind spec data and encrypts amounts internally.
   */
  insertCanonicalTemplateLines(
    templateIds: DemoTemplateIds,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededTemplateLine[]>;
  insertBudgets(
    budgets: DemoBudgetSeed[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<DemoSeededBudget[]>;
  insertBudgetLines(
    lines: DemoBudgetLineSeed[],
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;
  insertTransactions(
    transactions: DemoTransactionSeed[],
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;
}
