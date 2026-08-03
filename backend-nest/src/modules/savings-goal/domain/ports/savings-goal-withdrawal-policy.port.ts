import type { AuthenticatedUser } from '@common/decorators/user.decorator';

export const SAVINGS_GOAL_WITHDRAWAL_POLICY = Symbol(
  'SAVINGS_GOAL_WITHDRAWAL_POLICY',
);

/**
 * Une mutation de retrait, décrite par son effet sur le stock plutôt que par
 * son verbe. Création : `debit` = montant, pas de `creditBack`. Édition :
 * `creditBack` = ancien montant, `debit` = nouveau (le disponible est donc
 * `confirmé + ancien`). Suppression : `debit` = 0.
 *
 * `write` reçoit la révision de solde lue pendant la validation et la porte
 * jusqu'à la RPC, seule à pouvoir refuser une écriture devenue périmée : les
 * colonnes de montant sont chiffrées, PostgreSQL ne peut pas recalculer le
 * solde lui-même pour se défendre.
 */
export interface SavingsGoalWithdrawalWrite<T> {
  goalId: string;
  debit: number;
  creditBack?: number;
  /** Le solde est payDay-aware : le cycle de l'utilisateur situe chaque mouvement. */
  user: AuthenticatedUser;
  write: (expectedRevision: number) => Promise<T>;
}

/**
 * Seam exporté par le module objectif vers le module transaction : la règle de
 * solde reste la propriété de l'objectif, l'écriture reste celle de la
 * transaction. Aucun des deux modules n'importe le service de l'autre.
 */
export interface SavingsGoalWithdrawalPolicyPort {
  /**
   * Lit le solde, refuse un prélèvement qui le dépasse, puis exécute `write`
   * avec la révision lue. Une révision devenue périmée — ou un conflit
   * PostgreSQL rejouable — déclenche UNE relecture et un seul nouvel essai :
   * le montant est revalidé contre le solde frais, donc un retrait concurrent
   * qui a vidé le pot ressort en solde insuffisant, pas en conflit trompeur.
   */
  runAgainstBalance<T>(input: SavingsGoalWithdrawalWrite<T>): Promise<T>;
}
