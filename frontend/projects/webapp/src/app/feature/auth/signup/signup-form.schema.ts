import { z } from 'zod/v4';
import { PASSWORD_MIN_LENGTH } from '@core/auth';

export interface SignupSubmit {
  readonly email: string;
  readonly password: string;
}

// Parité avec iOS PasswordValidator: 8 caractères + au moins un chiffre + une lettre.
export const PASSWORD_HAS_NUMBER = /\p{N}/u;
export const PASSWORD_HAS_LETTER = /\p{L}/u;

export const signupFormSchema = z
  .object({
    email: z.email(),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH)
      .regex(PASSWORD_HAS_NUMBER)
      .regex(PASSWORD_HAS_LETTER),
    confirmPassword: z.string(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: 'passwords do not match',
    path: ['confirmPassword'],
  })
  .transform(
    (input): SignupSubmit => ({
      email: input.email,
      password: input.password,
    }),
  );

export type SignupFormValue = z.input<typeof signupFormSchema>;
