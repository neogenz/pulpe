/**
 * PUL-17 idempotency signal: the `create_budget_lines_spread` RPC RAISEd because
 * `spreadGroupId` already has rows (its dup-group guard). Thrown by the repository
 * — the ONE place that translates the RPC's string message into a typed error —
 * and caught by the additive create use case (`instanceof`, no string-sniffing in
 * the application layer) to REPLAY the request: return the existing group's lines
 * and re-run the idempotent recalculation instead of creating a second group.
 *
 * This is a control-flow signal, NOT a client-facing error: on a legitimate replay
 * it never reaches the client (it becomes a 200). It only surfaces as a conflict if
 * the group exists but is not the caller's (the use case maps that to a 409).
 */
export class SpreadGroupAlreadyExistsError extends Error {
  constructor(readonly spreadGroupId: string) {
    super(`Spread group '${spreadGroupId}' already exists`);
    this.name = 'SpreadGroupAlreadyExistsError';
  }
}
