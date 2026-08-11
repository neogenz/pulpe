export const PASSWORD_MIN_LENGTH = 8;

/**
 * Mirrors `PasswordValidator` on iOS. One rule set for every screen that asks
 * the user to choose a password — signup and reset — so the two can never drift
 * into accepting different things.
 */
export function isAcceptablePassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /\d/.test(password) &&
    /[a-zA-Z]/.test(password)
  );
}

/** The three rules, in the order the screens list them. */
export const PASSWORD_CRITERIA: readonly {
  label: string;
  isMet: (password: string) => boolean;
}[] = [
  {
    label: `${PASSWORD_MIN_LENGTH} caractères minimum`,
    isMet: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: "Au moins une lettre",
    isMet: (password) => /[a-zA-Z]/.test(password),
  },
  { label: "Au moins un chiffre", isMet: (password) => /\d/.test(password) },
];
