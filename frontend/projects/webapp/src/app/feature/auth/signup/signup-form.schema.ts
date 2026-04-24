import { z } from 'zod/v4';
import { PASSWORD_MIN_LENGTH } from '@core/auth';

export interface SignupSubmit {
  readonly email: string;
  readonly password: string;
}

export const signupFormSchema = z
  .object({
    email: z.email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true),
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
