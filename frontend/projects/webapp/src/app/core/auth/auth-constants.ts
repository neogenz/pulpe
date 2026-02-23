export const PASSWORD_MIN_LENGTH = 8;
export const VAULT_CODE_MIN_LENGTH = 4;

export const SCHEDULED_DELETION_PARAMS = {
  REASON: 'reason',
  REASON_VALUE: 'scheduled-deletion',
  DATE: 'date',
} as const;

export const AUTH_ERROR_MESSAGES = {
  OAUTH_CONNECTION_ERROR: 'La connexion a échoué — on réessaie ?',
  UNEXPECTED_LOGIN_ERROR: "Quelque chose n'a pas fonctionné — réessayons",
  UNEXPECTED_SIGNUP_ERROR:
    "La création du compte n'a pas abouti — on retente ?",
  UNEXPECTED_SESSION_ERROR: "Quelque chose n'a pas fonctionné — réessayons",
  ENCRYPTION_SETUP_ERROR:
    'La préparation de ton espace sécurisé a échoué — réessaie de te connecter. Si le problème persiste, contacte le support.',
} as const;

export function formatScheduledDeletionMessage(
  scheduledDeletionAt: unknown,
): string {
  const date = new Date(String(scheduledDeletionAt));
  const formattedDate = isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('fr-CH');
  return `Ton compte est programmé pour suppression le ${formattedDate}. Si c'est une erreur, contacte le support.`;
}
