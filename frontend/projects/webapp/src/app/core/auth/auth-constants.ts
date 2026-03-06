export const PASSWORD_MIN_LENGTH = 8;
export const VAULT_CODE_MIN_LENGTH = 4;

export const SCHEDULED_DELETION_PARAMS = {
  REASON: 'reason',
  REASON_VALUE: 'scheduled-deletion',
  DATE: 'date',
} as const;

export const AUTH_ERROR_MESSAGES = {
  OAUTH_CONNECTION_ERROR: 'La connexion a échoué — réessaie',
  UNEXPECTED_LOGIN_ERROR: "Quelque chose n'a pas fonctionné — réessaie",
  UNEXPECTED_SIGNUP_ERROR:
    "La création du compte n'a pas abouti — on retente ?",
  UNEXPECTED_SESSION_ERROR: "Quelque chose n'a pas fonctionné — réessaie",
  ENCRYPTION_SETUP_ERROR:
    'La préparation de ton espace sécurisé a échoué — réessaie de te connecter. Si le problème persiste, contacte le support.',
} as const;

export function formatDeletionDate(
  scheduledDeletionAt: unknown,
  locale: string,
): string {
  const date = new Date(String(scheduledDeletionAt));
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale);
}
