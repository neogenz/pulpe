import { z } from 'zod/v4';
import { PASSWORD_MIN_LENGTH } from '@core/auth';
// Règles définies dans ui/password-criteria (source unique avec la checklist
// visuelle — parité iOS PasswordValidator) ; ré-exportées pour les consommateurs
// existants du schema.
import {
  PASSWORD_HAS_LETTER,
  PASSWORD_HAS_NUMBER,
} from '@ui/password-criteria';

export { PASSWORD_HAS_LETTER, PASSWORD_HAS_NUMBER };

export const signupFormSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .regex(PASSWORD_HAS_NUMBER)
    .regex(PASSWORD_HAS_LETTER),
});

export type SignupFormValue = z.input<typeof signupFormSchema>;
