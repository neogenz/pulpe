/**
 * PUL-292 idempotency signal: the pair insert violated the partial UNIQUE index
 * `(savings_withdrawal_group_id, kind)` — the group already has rows. Thrown by
 * the repository (the ONE place that translates the Postgres 23505 into a typed
 * error) and caught by the create use case (`instanceof`, no string-sniffing in
 * the application layer) to REPLAY the request: return the existing pair and
 * re-run the idempotent recalculation instead of creating a second couple.
 *
 * Control-flow signal, NOT a client-facing error: on a legitimate replay it
 * becomes a 201 with the original result. It only surfaces as a 409 when the
 * group exists but is not the caller's, or is no longer a complete pair.
 */
export class SavingsWithdrawalPairExistsError extends Error {
  constructor(readonly groupId: string) {
    super(`Savings withdrawal group '${groupId}' already exists`);
    this.name = 'SavingsWithdrawalPairExistsError';
  }
}
