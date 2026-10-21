import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';

type Details = Record<string, unknown> | undefined;

/**
 * The shared definitions speak English to REST clients. An agent relays what
 * it reads to the user, so the refusals a tool call commonly meets are reworded
 * here, once, with the tool that gives the valid ids.
 */
const AGENT_MESSAGES: Record<string, (details: Details) => string> = {
  [ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND.code]: () =>
    'Mouvement introuvable. Reprends l’id d’une ligne Mouvement de get_month, get_current_month ou search_movements ; un identifiant de prévision est refusé.',
  [ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND.code]: () =>
    'Prévision introuvable. Reprends l’id d’une ligne Prévision de get_month ou get_current_month.',
  [ERROR_DEFINITIONS.BUDGET_NOT_FOUND.code]: () =>
    'Mois introuvable. Appelle list_months pour les mois qui existent.',
  [ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND.code]: () =>
    'Modèle introuvable. Appelle list_templates pour les ids valides.',
  [ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND.code]: () =>
    'Prévision du modèle introuvable. Appelle get_template pour les ids valides.',
  [ERROR_DEFINITIONS.TEMPLATE_IN_USE.code]: (details) =>
    `Modèle non supprimé : des mois ont été créés depuis lui (${String(details?.months)}). Il reste en place tant que ces mois existent.`,
  [ERROR_DEFINITIONS.TAG_NOT_FOUND.code]: () =>
    'Tag introuvable. Appelle list_tags pour les ids valides.',
  [ERROR_DEFINITIONS.TAG_ALREADY_EXISTS.code]: (details) =>
    `Un tag « ${String(details?.name)} » existe déjà (casse ignorée). Appelle list_tags pour reprendre son id.`,
};

/** Business messages are safe for the model; anything else stays generic. */
export function describeToolError(error: unknown): string {
  const status = (error as { getStatus?: () => number })?.getStatus?.();
  if (!status || status >= 500 || !(error instanceof Error)) {
    return 'Pulpe n’a pas pu traiter cette demande.';
  }
  if (!(error instanceof BusinessException)) return error.message;
  return AGENT_MESSAGES[error.code]?.(error.details) ?? error.message;
}
