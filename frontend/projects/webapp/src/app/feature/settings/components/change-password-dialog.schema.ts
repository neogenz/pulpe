import { z } from 'zod/v4';
import { PASSWORD_MIN_LENGTH } from '@core/auth';

export interface ChangePasswordSubmit {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH),
    confirmPassword: z.string(),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    message: 'passwords do not match',
    path: ['confirmPassword'],
  })
  .transform(
    (input): ChangePasswordSubmit => ({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    }),
  );

export type ChangePasswordFormValue = z.input<typeof changePasswordFormSchema>;
