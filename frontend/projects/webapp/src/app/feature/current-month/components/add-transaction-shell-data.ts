import type { TransactionFormData } from './add-transaction-form';

/**
 * Ce que la coque reçoit de qui l'ouvre : les deux façons de disposer de la
 * saisie qu'elle détient — l'enregistrer, ou demander la permission de la
 * perdre. `persist` rend la raison d'un refus, ou `null` quand l'écriture est
 * passée ; `confirmDiscard` est vrai quand l'utilisateur accepte de tout perdre.
 *
 * Ce contrat vit à part du service qui ouvre les coques, et non chez lui : ce
 * service importe les deux coques pour les ouvrir, donc les faire dépendre de
 * lui en retour fermait un cycle d'imports que `deps:check` refuse. Le passer
 * en donnée plutôt qu'en injection rend aussi la coque indépendante de
 * l'injecteur de la route, qu'il fallait jusqu'ici lui relayer à la main.
 */
export interface AddTransactionShellData {
  readonly persist: (
    transaction: TransactionFormData,
  ) => Promise<string | null>;
  readonly confirmDiscard: () => Promise<boolean>;
}
