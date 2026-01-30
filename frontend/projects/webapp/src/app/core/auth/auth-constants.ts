export const PASSWORD_MIN_LENGTH = 8;

export const AUTH_ERROR_MESSAGES = {
  GOOGLE_CONNECTION_ERROR: 'La connexion avec Google a échoué — on réessaie ?',
  UNEXPECTED_LOGIN_ERROR: "Quelque chose n'a pas fonctionné — réessayons",
  UNEXPECTED_SIGNUP_ERROR:
    "La création du compte n'a pas abouti — on retente ?",
  UNEXPECTED_SESSION_ERROR: "Quelque chose n'a pas fonctionné — réessayons",
} as const;
