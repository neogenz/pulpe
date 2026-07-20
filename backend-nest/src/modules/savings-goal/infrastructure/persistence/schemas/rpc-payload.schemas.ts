import { z } from 'zod';

// ----------------------------------------------------------------------------
// apply_savings_goal_plan — JSONB item shapes (PUL-12 plan apply).
//
// One `line` item = one budget_line UPDATE. `amount` is an AES-256-GCM ciphertext produced via
// ENCRYPTION_PORT and stored as-is by the RPC (no SQL-side crypto). The column
// lists match the `jsonb_to_recordset(...)` signatures in migration
// 20260706120000_apply_savings_goal_plan.
//
// `.strict()` rejects extra keys so a typo can't silently NULL an encrypted
// column (ADR-0007 / supabase.md RPC rule).
// ----------------------------------------------------------------------------
export const applySavingsGoalPlanLineSchema = z
  .object({
    budget_line_id: z.uuid(),
    amount: z.string().min(1),
  })
  .strict();

export const applySavingsGoalPlanLineListSchema = z.array(
  applySavingsGoalPlanLineSchema,
);

export type ApplySavingsGoalPlanLine = z.infer<
  typeof applySavingsGoalPlanLineSchema
>;

// Exact messages the RPC RAISEs (P0001) when a requested line fails a WHERE
// guard. Mirrored verbatim by migration apply_savings_goal_plan and pinned by
// its SQL test; the repository matches on them to pick the HTTP status. Named
// here, next to the payload contract, so the SQL↔TS coupling is greppable from
// one place.
//
// - NOT_LINKED → 422 (refetch + resimulate): the line does
//   not exist, is foreign, is not tagged to this goal, or is not a saving line.
// - CHECKED / PAST → 409 (the plan drifted during the simulation): the line was
//   pointed, or its cycle rolled into the past.
export const PLAN_LINE_NOT_LINKED_RPC_MESSAGE = 'Plan line not linked';
export const PLAN_LINE_CHECKED_RPC_MESSAGE = 'Plan line already checked';
export const PLAN_LINE_PAST_RPC_MESSAGE = 'Plan line in past period';

// apply_savings_goal_generation_stop (PUL-285 CA5) — scalar params only, no
// JSONB ciphertext payload, so no Zod payload schema. The RAISE messages are
// mirrored verbatim from migration 20260716091000; the repository matches on
// them to pick the HTTP status:
// - NOT_LINKED → 422 (refetch the candidates);
// - CHECKED / ADJUSTED / PAST → 409 (the candidate list drifted).
export const GENERATION_STOP_NOT_LINKED_RPC_MESSAGE =
  'Generation stop line not linked';
export const GENERATION_STOP_CHECKED_RPC_MESSAGE =
  'Generation stop line already checked';
export const GENERATION_STOP_ADJUSTED_RPC_MESSAGE =
  'Generation stop line manually adjusted';
export const GENERATION_STOP_PAST_RPC_MESSAGE =
  'Generation stop line in past period';
