import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

/**
 * SQLSTATE class 40 — PostgreSQL rolled the whole transaction back because
 * another one got in the way.
 *
 * - `40P01` deadlock_detected: two transactions took the same rows in opposite
 *   orders; the engine picks a victim and aborts it.
 * - `40001` serialization_failure: a serializable transaction could not be
 *   ordered against a concurrent one.
 *
 * Only these two are listed. `40002` (deferred constraint violated on commit)
 * and `40003` (outcome unknown) are in the same class but reissuing them is not
 * safe, so they keep falling through to their caller's generic failure.
 */
const RETRYABLE_TRANSACTION_CONFLICT_CODES = new Set(['40001', '40P01']);

/**
 * The victim's transaction is rolled back entirely, so nothing was half-written
 * and the exact same request can be reissued. Callers map it to a conflict the
 * client replays, never to a generic server fault: a 500 tells the client to
 * give up on a call that would very likely succeed on the next try.
 */
export function isRetryableTransactionConflict(error: unknown): boolean {
  const { code } = (error ?? {}) as { code?: string };
  return code !== undefined && RETRYABLE_TRANSACTION_CONFLICT_CODES.has(code);
}

/**
 * Le premier réflexe de tout gestionnaire d'erreur qui écrit sur une table
 * reliée à un objectif d'épargne.
 *
 * Depuis PUL-329, une écriture ordinaire sur une ligne ou une transaction
 * rattachée à un objectif prend son propre verrou puis celui de l'objectif, via
 * les triggers de révision — l'ordre inverse des RPC objectif, qui verrouillent
 * l'objectif d'abord. Les deux se croisent, PostgreSQL annule un côté entier.
 *
 * Sans cette garde, la victime remonte au client dans l'habit de la panne
 * générique du gestionnaire : un 500 « échec de mise à jour », voire un 404
 * « transaction introuvable » qui laisse croire que la ligne a disparu. Rien
 * n'a été écrit : la même requête réussira au prochain essai, et c'est ce que
 * `CONCURRENT_MODIFICATION` (409) dit au client.
 */
export function throwIfRetryableConflict(
  error: unknown,
  resource: string,
  loggingContext: Record<string, unknown>,
): void {
  if (!isRetryableTransactionConflict(error)) return;
  throw new BusinessException(
    ERROR_DEFINITIONS.CONCURRENT_MODIFICATION,
    { resource },
    loggingContext,
    { cause: error ?? undefined },
  );
}
