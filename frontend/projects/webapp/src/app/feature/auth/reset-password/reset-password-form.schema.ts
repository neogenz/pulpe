import { z } from 'zod/v4';
import { PASSWORD_MIN_LENGTH } from '@core/auth';

export interface ResetPasswordSubmit {
  readonly newPassword: string;
}

export const resetPasswordFormSchema = z
  .object({
    newPassword: z.string().min(PASSWORD_MIN_LENGTH),
    confirmPassword: z.string(),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    message: 'passwords do not match',
    path: ['confirmPassword'],
  })
  .transform(
    (input): ResetPasswordSubmit => ({
      newPassword: input.newPassword,
    }),
  );

export type ResetPasswordFormValue = z.input<typeof resetPasswordFormSchema>;
